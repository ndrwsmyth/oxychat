import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Hono } from 'hono';
import type { AppVariables } from '../../types.js';
import { adminTranscriptsRouter } from '../admin-transcripts.js';
import { assertTranscriptRelinkAllowed } from '../../lib/transcript-policy.js';
import { withDbClient } from '../../lib/db.js';
import { writeAuditEvent } from '../../lib/audit.js';
import { AccessDeniedError } from '../../lib/acl.js';
import {
  LockConflictError,
  acquireTranscriptRelinkLock,
  releaseTranscriptRelinkLock,
} from '../../lib/transcript-relink-lock.js';

vi.mock('../../lib/transcript-policy.js', () => ({
  assertTranscriptRelinkAllowed: vi.fn(),
}));

vi.mock('../../lib/db.js', () => ({
  withDbClient: vi.fn(),
}));

vi.mock('../../lib/audit.js', () => ({
  writeAuditEvent: vi.fn(async () => undefined),
}));

vi.mock('../../lib/transcript-relink-lock.js', () => ({
  LockConflictError: class LockConflictError extends Error {
    constructor(message = 'Transcript relink is already in progress') {
      super(message);
      this.name = 'LockConflictError';
    }
  },
  acquireTranscriptRelinkLock: vi.fn(),
  releaseTranscriptRelinkLock: vi.fn(),
}));

const mockUser = {
  id: 'admin-1',
  clerkId: 'clerk-1',
  email: 'admin@oxy.so',
  fullName: 'Admin',
  avatarUrl: null,
  context: null,
};

const VALID_TRANSCRIPT_ID = '00000000-0000-4000-8000-000000000001';
const VALID_PROJECT_ID = '00000000-0000-4000-8000-000000000002';

function createAuthedApp() {
  const app = new Hono<{ Variables: AppVariables }>();
  app.onError((err, c) => c.json({ error: err.message }, 500));
  app.use('*', async (c, next) => {
    c.set('user', mockUser);
    await next();
  });
  app.route('/api', adminTranscriptsRouter);
  return app;
}

describe('POST /api/admin/transcripts/:transcriptId/relink', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(acquireTranscriptRelinkLock).mockResolvedValue(undefined);
    vi.mocked(releaseTranscriptRelinkLock).mockResolvedValue(undefined);
  });

  it('returns relink contract on success', async () => {
    vi.mocked(assertTranscriptRelinkAllowed).mockResolvedValue(undefined);
    const query = vi.fn(async () => ({
      rows: [
        {
          transcript_id: VALID_TRANSCRIPT_ID,
          project_id: VALID_PROJECT_ID,
          link_source: 'admin_manual',
          updated_at: '2026-03-02T00:00:00.000Z',
        },
      ],
    }));

    vi.mocked(withDbClient).mockImplementation(async (fn) => fn({ query } as never));

    const app = createAuthedApp();
    const response = await app.request(`/api/admin/transcripts/${VALID_TRANSCRIPT_ID}/relink`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ project_id: VALID_PROJECT_ID }),
    });

    expect(response.status).toBe(200);
    expect(vi.mocked(assertTranscriptRelinkAllowed)).toHaveBeenCalledWith(VALID_TRANSCRIPT_ID);
    expect(vi.mocked(acquireTranscriptRelinkLock)).toHaveBeenCalledWith({
      transcriptId: VALID_TRANSCRIPT_ID,
      userId: 'admin-1',
    });
    expect(query).toHaveBeenCalledTimes(1);
    const firstQuerySql = (query as unknown as { mock: { calls: Array<[string]> } }).mock.calls[0]?.[0];
    expect(firstQuerySql).toContain('ON CONFLICT (transcript_id)');
    const body = await response.json();
    expect(body).toEqual({
      transcript_id: VALID_TRANSCRIPT_ID,
      project_id: VALID_PROJECT_ID,
      link_source: 'admin_manual',
      updated_at: '2026-03-02T00:00:00.000Z',
    });
    expect(vi.mocked(writeAuditEvent)).toHaveBeenCalledWith(
      expect.objectContaining({
        actorUserId: 'admin-1',
        eventType: 'transcript.routed',
        entityType: 'transcript',
        entityId: VALID_TRANSCRIPT_ID,
        payload: {
          project_id: VALID_PROJECT_ID,
          link_source: 'admin_manual',
        },
      })
    );
    expect(vi.mocked(releaseTranscriptRelinkLock)).toHaveBeenCalledWith({
      transcriptId: VALID_TRANSCRIPT_ID,
      userId: 'admin-1',
    });
  });

  it('returns 400 for invalid transcript UUID', async () => {
    const app = createAuthedApp();
    const response = await app.request('/api/admin/transcripts/not-a-uuid/relink', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ project_id: VALID_PROJECT_ID }),
    });

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body).toEqual({
      error: {
        code: 'admin_bad_request',
        message: 'transcriptId must be a valid UUID',
        details: { field: 'transcriptId' },
      },
    });
    expect(vi.mocked(assertTranscriptRelinkAllowed)).not.toHaveBeenCalled();
    expect(vi.mocked(acquireTranscriptRelinkLock)).not.toHaveBeenCalled();
    expect(vi.mocked(withDbClient)).not.toHaveBeenCalled();
  });

  it('returns 400 for invalid project UUID', async () => {
    const app = createAuthedApp();
    const response = await app.request(`/api/admin/transcripts/${VALID_TRANSCRIPT_ID}/relink`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ project_id: 'invalid-project-id' }),
    });

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body).toEqual({
      error: {
        code: 'admin_bad_request',
        message: 'project_id must be a valid UUID',
        details: { field: 'project_id' },
      },
    });
    expect(vi.mocked(assertTranscriptRelinkAllowed)).not.toHaveBeenCalled();
    expect(vi.mocked(acquireTranscriptRelinkLock)).not.toHaveBeenCalled();
    expect(vi.mocked(withDbClient)).not.toHaveBeenCalled();
  });

  it('returns 403 when transcript cannot be relinked', async () => {
    vi.mocked(assertTranscriptRelinkAllowed).mockRejectedValue(
      new AccessDeniedError('Private transcripts cannot be relinked')
    );

    const app = createAuthedApp();
    const response = await app.request(`/api/admin/transcripts/${VALID_TRANSCRIPT_ID}/relink`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ project_id: VALID_PROJECT_ID }),
    });

    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body).toEqual({
      error: {
        code: 'admin_forbidden',
        message: 'Private transcripts cannot be relinked',
      },
    });
    expect(vi.mocked(acquireTranscriptRelinkLock)).not.toHaveBeenCalled();
    expect(vi.mocked(withDbClient)).not.toHaveBeenCalled();
  });

  it('returns 409 on lock contention and does not attempt relink write or release', async () => {
    vi.mocked(assertTranscriptRelinkAllowed).mockResolvedValue(undefined);
    vi.mocked(acquireTranscriptRelinkLock).mockRejectedValue(new LockConflictError());

    const app = createAuthedApp();
    const response = await app.request(`/api/admin/transcripts/${VALID_TRANSCRIPT_ID}/relink`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ project_id: VALID_PROJECT_ID }),
    });

    expect(response.status).toBe(409);
    const body = await response.json();
    expect(body).toEqual({
      error: {
        code: 'admin_conflict',
        message: 'Transcript relink is already in progress',
      },
    });
    expect(vi.mocked(withDbClient)).not.toHaveBeenCalled();
    expect(vi.mocked(releaseTranscriptRelinkLock)).not.toHaveBeenCalled();
  });

  it('maps expected unique conflicts to 409', async () => {
    vi.mocked(assertTranscriptRelinkAllowed).mockResolvedValue(undefined);
    const expectedConflict = Object.assign(new Error('duplicate key value violates unique constraint'), {
      code: '23505',
      constraint: 'idx_transcript_project_links_transcript_unique',
    });
    vi.mocked(withDbClient).mockRejectedValue(expectedConflict);

    const app = createAuthedApp();
    const response = await app.request(`/api/admin/transcripts/${VALID_TRANSCRIPT_ID}/relink`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ project_id: VALID_PROJECT_ID }),
    });

    expect(response.status).toBe(409);
    const body = await response.json();
    expect(body).toEqual({
      error: {
        code: 'admin_conflict',
        message: 'Transcript relink conflict',
      },
    });
    expect(vi.mocked(releaseTranscriptRelinkLock)).toHaveBeenCalledWith({
      transcriptId: VALID_TRANSCRIPT_ID,
      userId: 'admin-1',
    });
  });

  it('returns 500 for unknown errors', async () => {
    vi.mocked(assertTranscriptRelinkAllowed).mockResolvedValue(undefined);
    vi.mocked(withDbClient).mockRejectedValue(new Error('boom'));

    const app = createAuthedApp();
    const response = await app.request(`/api/admin/transcripts/${VALID_TRANSCRIPT_ID}/relink`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ project_id: VALID_PROJECT_ID }),
    });

    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body).toEqual({
      error: {
        code: 'admin_internal_error',
        message: 'boom',
      },
    });
    expect(vi.mocked(releaseTranscriptRelinkLock)).toHaveBeenCalledWith({
      transcriptId: VALID_TRANSCRIPT_ID,
      userId: 'admin-1',
    });
  });
});

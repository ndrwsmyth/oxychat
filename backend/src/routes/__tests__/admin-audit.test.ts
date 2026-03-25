import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Hono } from 'hono';
import type { AppVariables } from '../../types.js';
import { adminAuditRouter } from '../admin-audit.js';
import { withDbClient } from '../../lib/db.js';
import { redactAuditEventsForViewer } from '../../lib/admin-audit-redaction.js';

vi.mock('../../lib/db.js', () => ({
  withDbClient: vi.fn(),
}));

vi.mock('../../lib/admin-audit-redaction.js', () => ({
  redactAuditEventsForViewer: vi.fn(),
}));

const mockUser = {
  id: 'admin-1',
  clerkId: 'clerk-1',
  email: 'admin@oxy.so',
  fullName: 'Admin',
  avatarUrl: null,
  context: null,
};

const SAME_TIMESTAMP = '2026-03-02T00:00:00.000Z';

function buildAuditRow(idSuffix: string) {
  return {
    id: `00000000-0000-4000-8000-0000000000${idSuffix}`,
    actor_user_id: '00000000-0000-4000-8000-000000000099',
    event_type: 'transcript.routed',
    entity_type: 'transcript',
    entity_id: `00000000-0000-4000-8000-0000000001${idSuffix}`,
    request_id: `req-${idSuffix}`,
    payload: { index: Number(idSuffix) },
    created_at: SAME_TIMESTAMP,
  };
}

function createAuthedApp() {
  const app = new Hono<{ Variables: AppVariables }>();
  app.use('*', async (c, next) => {
    c.set('user', mockUser);
    await next();
  });
  app.route('/api', adminAuditRouter);
  return app;
}

describe('GET /api/admin/audit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(redactAuditEventsForViewer).mockImplementation(async (rows) =>
      rows.map((row) => ({
        ...row,
        redacted: false,
        redaction_reason: null,
      }))
    );
  });

  it('paginates same-timestamp rows with tuple cursor and no skips/dupes', async () => {
    const rows = {
      r6: buildAuditRow('06'),
      r5: buildAuditRow('05'),
      r4: buildAuditRow('04'),
      r3: buildAuditRow('03'),
      r2: buildAuditRow('02'),
      r1: buildAuditRow('01'),
    };

    const query = vi.fn(async (sql: string, params: Array<string | number>) => {
      const cursorId = params.length >= 3 ? String(params[1]) : null;

      if (!cursorId) {
        return { rows: [rows.r6, rows.r5, rows.r4] };
      }
      if (cursorId === rows.r5.id) {
        return { rows: [rows.r4, rows.r3, rows.r2] };
      }
      if (cursorId === rows.r3.id) {
        return { rows: [rows.r2, rows.r1] };
      }
      return { rows: [] };
    });

    vi.mocked(withDbClient).mockImplementation(async (fn) => fn({ query } as never));

    const app = createAuthedApp();

    const firstResponse = await app.request('/api/admin/audit?limit=2');
    expect(firstResponse.status).toBe(200);
    const firstBody = await firstResponse.json() as {
      items: Array<{ id: string }>;
      next_cursor: string | null;
    };
    expect(firstBody.items.map((item) => item.id)).toEqual([rows.r6.id, rows.r5.id]);
    expect(firstBody.next_cursor).not.toBeNull();

    const secondResponse = await app.request(`/api/admin/audit?limit=2&cursor=${encodeURIComponent(firstBody.next_cursor ?? '')}`);
    expect(secondResponse.status).toBe(200);
    const secondBody = await secondResponse.json() as {
      items: Array<{ id: string }>;
      next_cursor: string | null;
    };
    expect(secondBody.items.map((item) => item.id)).toEqual([rows.r4.id, rows.r3.id]);
    expect(secondBody.next_cursor).not.toBeNull();

    const thirdResponse = await app.request(`/api/admin/audit?limit=2&cursor=${encodeURIComponent(secondBody.next_cursor ?? '')}`);
    expect(thirdResponse.status).toBe(200);
    const thirdBody = await thirdResponse.json() as {
      items: Array<{ id: string }>;
      next_cursor: string | null;
    };
    expect(thirdBody.items.map((item) => item.id)).toEqual([rows.r2.id, rows.r1.id]);
    expect(thirdBody.next_cursor).toBeNull();

    const allIds = [
      ...firstBody.items.map((item) => item.id),
      ...secondBody.items.map((item) => item.id),
      ...thirdBody.items.map((item) => item.id),
    ];

    expect(allIds).toEqual([rows.r6.id, rows.r5.id, rows.r4.id, rows.r3.id, rows.r2.id, rows.r1.id]);
    expect(new Set(allIds).size).toBe(6);

    const firstSql = (query as unknown as { mock: { calls: Array<[string]> } }).mock.calls[0]?.[0] ?? '';
    const secondSql = (query as unknown as { mock: { calls: Array<[string]> } }).mock.calls[1]?.[0] ?? '';
    expect(firstSql).not.toContain('(created_at, id) <');
    expect(secondSql).toContain('(created_at, id) <');
  });

  it('returns typed bad request envelope for invalid cursor', async () => {
    const app = createAuthedApp();
    const response = await app.request('/api/admin/audit?cursor=not-valid-base64');

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body).toEqual({
      error: {
        code: 'admin_bad_request',
        message: 'cursor is invalid',
      },
    });
  });
});

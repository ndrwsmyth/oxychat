import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Hono } from 'hono';
import { transcriptsRouter } from '../transcripts.js';
import type { AppVariables } from '../../types.js';
import { getSupabase } from '../../lib/supabase.js';
import {
  canUserViewTranscript,
  filterVisibleTranscriptIdsForUser,
} from '../../lib/transcript-visibility.js';
import {
  AccessDeniedError,
  assertConversationOwnership,
  assertProjectAccess,
} from '../../lib/acl.js';

vi.mock('../../lib/supabase.js', () => ({
  getSupabase: vi.fn(),
}));

vi.mock('../../lib/transcript-visibility.js', () => ({
  canUserViewTranscript: vi.fn(),
  filterVisibleTranscriptIdsForUser: vi.fn(),
}));

vi.mock('../../lib/acl.js', () => ({
  AccessDeniedError: class AccessDeniedError extends Error {},
  assertProjectAccess: vi.fn(async () => undefined),
  assertConversationOwnership: vi.fn(async () => ({
    id: 'conv-1',
    model: 'gpt-5.2',
    project_id: 'project-1',
  })),
}));

const mockUser = {
  id: 'user-1',
  clerkId: 'clerk-1',
  email: 'member@oxy.so',
  fullName: 'Member',
  avatarUrl: null,
  context: null,
};

function createAuthedApp() {
  const app = new Hono<{ Variables: AppVariables }>();
  app.use('*', async (c, next) => {
    c.set('user', mockUser);
    await next();
  });
  app.route('/api', transcriptsRouter);
  return app;
}

interface TranscriptListRow {
  id: string;
  title: string;
  date: string;
  summary: string | null;
}

interface TagFixture {
  links: Array<{ transcript_id: string; project_id: string }>;
  projects: Array<{ id: string; name: string; scope: 'personal' | 'client' | 'global'; client_id: string }>;
  clients: Array<{ id: string; name: string; scope: 'personal' | 'client' | 'global' }>;
}

function createTranscriptSupabaseMock(
  listRows: TranscriptListRow[],
  detailRow: Record<string, unknown> | null = null,
  tags: TagFixture = {
    links: [{ transcript_id: 't1', project_id: 'project-1' }],
    projects: [
      {
        id: 'project-1',
        name: 'Acme Core',
        scope: 'client',
        client_id: 'client-1',
      },
    ],
    clients: [{ id: 'client-1', name: 'Acme', scope: 'client' }],
  }
) {
  return {
    from: vi.fn((table: string) => {
      if (table === 'transcripts') {
        const query = {
          eq: vi.fn(() => query),
          order: vi.fn(() => query),
          textSearch: vi.fn(() => query),
          limit: vi.fn(async () => ({ data: listRows, error: null })),
          maybeSingle: vi.fn(async () => ({ data: detailRow, error: null })),
        };
        return {
          select: vi.fn(() => query),
        };
      }

      if (table === 'transcript_project_links') {
        let scopedProjectId: string | null = null;
        const query = {
          eq: vi.fn((_field: string, projectId: string) => {
            scopedProjectId = projectId;
            return query;
          }),
          in: vi.fn(async (_field: string, transcriptIds: string[]) => {
            let scoped = tags.links;
            if (scopedProjectId) {
              scoped = scoped.filter((row) => row.project_id === scopedProjectId);
            }
            return {
              data: scoped.filter((row) => transcriptIds.includes(row.transcript_id)),
              error: null,
            };
          }),
        };
        return {
          select: vi.fn(() => query),
        };
      }

      if (table === 'projects') {
        const query = {
          in: vi.fn(async (_field: string, projectIds: string[]) => ({
            data: tags.projects.filter((row) => projectIds.includes(row.id)),
            error: null,
          })),
          eq: vi.fn((_field: string, projectId: string) => ({
            maybeSingle: async () => ({
              data: tags.projects.find((row) => row.id === projectId) ?? null,
              error: null,
            }),
          })),
        };
        return {
          select: vi.fn(() => query),
        };
      }

      if (table === 'clients') {
        const query = {
          in: vi.fn(async (_field: string, clientIds: string[]) => ({
            data: tags.clients.filter((row) => clientIds.includes(row.id)),
            error: null,
          })),
        };
        return {
          select: vi.fn(() => query),
        };
      }

      throw new Error(`Unexpected table: ${table}`);
    }),
  };
}

describe('transcript visibility routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(assertProjectAccess).mockResolvedValue(undefined);
    vi.mocked(assertConversationOwnership).mockResolvedValue({
      id: 'conv-1',
      model: 'gpt-5.2',
      project_id: 'project-1',
    });
  });

  it('filters transcript list by centralized visibility function and returns client/project tags', async () => {
    vi.mocked(filterVisibleTranscriptIdsForUser).mockResolvedValue(['t2']);
    vi.mocked(getSupabase).mockReturnValue(
      createTranscriptSupabaseMock(
        [
          { id: 't1', title: 'Hidden', date: '2026-02-19T10:00:00Z', summary: null },
          { id: 't2', title: 'Visible', date: '2026-02-19T09:00:00Z', summary: null },
        ],
        null,
        {
          links: [{ transcript_id: 't2', project_id: 'project-2' }],
          projects: [{ id: 'project-2', name: 'Client Inbox', scope: 'client', client_id: 'client-2' }],
          clients: [{ id: 'client-2', name: 'Bravo', scope: 'client' }],
        }
      ) as never
    );

    const app = createAuthedApp();
    const response = await app.request('/api/transcripts');

    expect(response.status).toBe(200);
    const body = (await response.json()) as Array<{ id: string; project_tag: { id: string } | null }>;
    expect(body.map((row) => row.id)).toEqual(['t2']);
    expect(body[0].project_tag?.id).toBe('project-2');
  });

  it('applies project filter for transcript panel scope', async () => {
    vi.mocked(filterVisibleTranscriptIdsForUser).mockResolvedValue(['t1', 't2']);
    vi.mocked(getSupabase).mockReturnValue(
      createTranscriptSupabaseMock(
        [
          { id: 't1', title: 'Project match', date: '2026-02-20T10:00:00Z', summary: null },
          { id: 't2', title: 'Other project', date: '2026-02-19T10:00:00Z', summary: null },
        ],
        null,
        {
          links: [
            { transcript_id: 't1', project_id: 'project-1' },
            { transcript_id: 't2', project_id: 'project-2' },
          ],
          projects: [
            { id: 'project-1', name: 'Scope A', scope: 'client', client_id: 'client-1' },
            { id: 'project-2', name: 'Scope B', scope: 'client', client_id: 'client-1' },
          ],
          clients: [{ id: 'client-1', name: 'Acme', scope: 'client' }],
        }
      ) as never
    );

    const app = createAuthedApp();
    const response = await app.request('/api/transcripts?project=project-1');

    expect(response.status).toBe(200);
    const body = await response.json() as Array<{ id: string }>;
    expect(body.map((row) => row.id)).toEqual(['t1']);
    expect(vi.mocked(assertProjectAccess)).toHaveBeenCalledWith('user-1', 'project-1');
  });

  it('supports canonical POST /api/transcripts/search with visibility filtering', async () => {
    vi.mocked(filterVisibleTranscriptIdsForUser).mockResolvedValue(['t1']);
    vi.mocked(getSupabase).mockReturnValue(
      createTranscriptSupabaseMock([
        { id: 't1', title: 'Match', date: '2026-02-19T10:00:00Z', summary: 'visible' },
      ]) as never
    );

    const app = createAuthedApp();
    const response = await app.request('/api/transcripts/search', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ query: 'match' }),
    });

    expect(response.status).toBe(200);
    const body = (await response.json()) as Array<{ id: string; client_tag: { id: string } | null }>;
    expect(body).toHaveLength(1);
    expect(body[0].id).toBe('t1');
    expect(body[0].client_tag?.id).toBe('client-1');
  });

  it('keeps GET /api/documents/search alias and enforces auth-scoped visibility', async () => {
    vi.mocked(filterVisibleTranscriptIdsForUser).mockResolvedValue(['t1']);
    vi.mocked(getSupabase).mockReturnValue(
      createTranscriptSupabaseMock([
        { id: 't1', title: 'Match', date: '2026-02-19T10:00:00Z', summary: 'visible' },
      ]) as never
    );

    const app = createAuthedApp();
    const response = await app.request('/api/documents/search?q=match');

    expect(response.status).toBe(200);
    expect(vi.mocked(filterVisibleTranscriptIdsForUser)).toHaveBeenCalled();
  });

  it('returns no-trace 404 for transcript detail when caller cannot view transcript', async () => {
    vi.mocked(canUserViewTranscript).mockResolvedValue(false);
    vi.mocked(getSupabase).mockReturnValue(createTranscriptSupabaseMock([]) as never);

    const app = createAuthedApp();
    const response = await app.request('/api/transcripts/private-id');

    expect(response.status).toBe(404);
  });

  it('returns mention-source payload with tags for visible transcript', async () => {
    vi.mocked(canUserViewTranscript).mockResolvedValue(true);
    vi.mocked(getSupabase).mockReturnValue(
      createTranscriptSupabaseMock([], {
        id: 't1',
        title: 'Visible source',
        date: '2026-02-19T10:00:00Z',
        summary: 'visible',
      }) as never
    );

    const app = createAuthedApp();
    const response = await app.request('/api/transcripts/t1/source');

    expect(response.status).toBe(200);
    const body = (await response.json()) as { id: string; project_tag: { id: string } | null };
    expect(body.id).toBe('t1');
    expect(body.project_tag?.id).toBe('project-1');
  });

  it('returns scoped mention query buckets with project first ordering', async () => {
    vi.mocked(filterVisibleTranscriptIdsForUser).mockResolvedValue(['t3', 't2', 't1']);
    vi.mocked(getSupabase).mockReturnValue(
      createTranscriptSupabaseMock(
        [
          { id: 't3', title: 'Newest Project', date: '2026-02-21T10:00:00Z', summary: null },
          { id: 't2', title: 'Newest Global', date: '2026-02-20T10:00:00Z', summary: null },
          { id: 't1', title: 'Older Project', date: '2026-02-19T10:00:00Z', summary: null },
        ],
        null,
        {
          links: [
            { transcript_id: 't3', project_id: 'project-1' },
            { transcript_id: 't2', project_id: 'project-2' },
            { transcript_id: 't1', project_id: 'project-1' },
          ],
          projects: [
            { id: 'project-1', name: 'Project One', scope: 'client', client_id: 'client-1' },
            { id: 'project-2', name: 'Project Two', scope: 'client', client_id: 'client-2' },
          ],
          clients: [
            { id: 'client-1', name: 'Acme', scope: 'client' },
            { id: 'client-2', name: 'Bravo', scope: 'client' },
          ],
        }
      ) as never
    );

    const app = createAuthedApp();
    const response = await app.request('/api/transcripts/mentions/query', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ query: 'new', project_id: 'project-1', limit: 20 }),
    });

    expect(response.status).toBe(200);
    const body = await response.json() as {
      project: Array<{ id: string }>;
      global: Array<{ id: string }>;
      mode: string;
      took_ms: number;
    };

    expect(body.mode).toBe('project_global');
    expect(body.project.map((item) => item.id)).toEqual(['t3', 't1']);
    expect(body.global.map((item) => item.id)).toEqual(['t2']);
    expect(typeof body.took_ms).toBe('number');
  });

  it('falls back to global bucket for personal project scope', async () => {
    vi.mocked(filterVisibleTranscriptIdsForUser).mockResolvedValue(['t1']);
    vi.mocked(getSupabase).mockReturnValue(
      createTranscriptSupabaseMock(
        [{ id: 't1', title: 'Personal note', date: '2026-02-21T10:00:00Z', summary: null }],
        null,
        {
          links: [{ transcript_id: 't1', project_id: 'project-1' }],
          projects: [{ id: 'project-1', name: 'Personal', scope: 'personal', client_id: 'client-1' }],
          clients: [{ id: 'client-1', name: 'Me', scope: 'personal' }],
        }
      ) as never
    );

    const app = createAuthedApp();
    const response = await app.request('/api/transcripts/mentions/query', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ query: 'personal', project_id: 'project-1' }),
    });

    expect(response.status).toBe(200);
    const body = await response.json() as { project: Array<{ id: string }>; global: Array<{ id: string }>; mode: string };
    expect(body.mode).toBe('personal_global_fallback');
    expect(body.project).toEqual([]);
    expect(body.global.map((item) => item.id)).toEqual(['t1']);
  });

  it('returns 403 on denied mention project scope', async () => {
    vi.mocked(assertProjectAccess).mockRejectedValue(new AccessDeniedError('Forbidden project'));
    vi.mocked(getSupabase).mockReturnValue(createTranscriptSupabaseMock([]) as never);

    const app = createAuthedApp();
    const response = await app.request('/api/transcripts/mentions/query', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ query: 'match', project_id: 'project-secret' }),
    });

    expect(response.status).toBe(403);
  });
});

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Hono } from 'hono';
import { transcriptsRouter } from '../transcripts.js';
import type { AppVariables } from '../../types.js';
import { getSupabase } from '../../lib/supabase.js';
import {
  canUserViewTranscript,
  filterVisibleTranscriptIdsForUser,
} from '../../lib/transcript-visibility.js';

vi.mock('../../lib/supabase.js', () => ({
  getSupabase: vi.fn(),
}));

vi.mock('../../lib/transcript-visibility.js', () => ({
  canUserViewTranscript: vi.fn(),
  filterVisibleTranscriptIdsForUser: vi.fn(),
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
        const query = {
          in: vi.fn(async (_field: string, transcriptIds: string[]) => ({
            data: tags.links.filter((row) => transcriptIds.includes(row.transcript_id)),
            error: null,
          })),
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
});

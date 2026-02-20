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

function createTranscriptSupabaseMock(
  listRows: Array<{ id: string; title: string; date: string; summary: string | null }>,
  detailRow: Record<string, unknown> | null = null
) {
  const supabase = {
    from: vi.fn(() => {
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
    }),
  };

  return supabase;
}

describe('transcript visibility routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('filters transcript list by centralized visibility function', async () => {
    vi.mocked(filterVisibleTranscriptIdsForUser).mockResolvedValue(['t2']);
    vi.mocked(getSupabase).mockReturnValue(
      createTranscriptSupabaseMock([
        { id: 't1', title: 'Hidden', date: '2026-02-19T10:00:00Z', summary: null },
        { id: 't2', title: 'Visible', date: '2026-02-19T09:00:00Z', summary: null },
      ]) as never
    );

    const app = createAuthedApp();
    const response = await app.request('/api/transcripts');

    expect(response.status).toBe(200);
    const body = (await response.json()) as Array<{ id: string }>;
    expect(body.map((row) => row.id)).toEqual(['t2']);
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
    const body = (await response.json()) as Array<{ id: string }>;
    expect(body).toHaveLength(1);
    expect(body[0].id).toBe('t1');
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

  it('returns mention-source payload for visible transcript', async () => {
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
    const body = (await response.json()) as { id: string };
    expect(body.id).toBe('t1');
  });
});

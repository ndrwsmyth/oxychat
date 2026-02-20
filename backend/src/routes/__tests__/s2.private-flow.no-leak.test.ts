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

function createSupabaseMock() {
  return {
    from: vi.fn(() => {
      const query = {
        eq: vi.fn(() => query),
        order: vi.fn(() => query),
        textSearch: vi.fn(() => query),
        limit: vi.fn(async () => ({
          data: [
            {
              id: 'private-1',
              title: 'Private transcript',
              date: '2026-02-19T10:00:00Z',
              summary: 'private',
            },
          ],
          error: null,
        })),
        maybeSingle: vi.fn(async () => ({
          data: {
            id: 'private-1',
            title: 'Private transcript',
            date: '2026-02-19T10:00:00Z',
            summary: 'private',
            content: 'secret',
          },
          error: null,
        })),
      };
      return {
        select: vi.fn(() => query),
      };
    }),
  };
}

describe('S2 private transcript no-leak flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getSupabase).mockReturnValue(createSupabaseMock() as never);
    vi.mocked(filterVisibleTranscriptIdsForUser).mockResolvedValue([]);
    vi.mocked(canUserViewTranscript).mockResolvedValue(false);
  });

  it('denies non-attendee across list/search/detail/mention-source surfaces', async () => {
    const app = createAuthedApp();

    const listResponse = await app.request('/api/transcripts');
    const listBody = (await listResponse.json()) as unknown[];
    expect(listResponse.status).toBe(200);
    expect(listBody).toEqual([]);

    const searchResponse = await app.request('/api/transcripts/search', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ query: 'private' }),
    });
    const searchBody = (await searchResponse.json()) as unknown[];
    expect(searchResponse.status).toBe(200);
    expect(searchBody).toEqual([]);

    const detailResponse = await app.request('/api/transcripts/private-1');
    expect(detailResponse.status).toBe(404);

    const sourceResponse = await app.request('/api/transcripts/private-1/source');
    expect(sourceResponse.status).toBe(404);
  });
});

import { Hono } from 'hono';
import type { AppVariables } from '../types.js';
import {
  canUserViewTranscript,
  filterVisibleTranscriptIdsForUser,
} from '../lib/transcript-visibility.js';
import { getSupabase } from '../lib/supabase.js';

export const transcriptsRouter = new Hono<{ Variables: AppVariables }>();

interface TranscriptRow {
  id: string;
  title: string;
  date: string;
  summary: string | null;
}

async function filterVisibleRows(
  userId: string,
  userEmail: string,
  rows: TranscriptRow[]
): Promise<TranscriptRow[]> {
  const visibleIds = await filterVisibleTranscriptIdsForUser(
    userId,
    userEmail,
    rows.map((row) => row.id)
  );
  const visibleSet = new Set(visibleIds);
  return rows.filter((row) => visibleSet.has(row.id));
}

async function searchTranscriptRows(query: string, limit: number): Promise<TranscriptRow[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('transcripts')
    .select('id, title, date, summary')
    .textSearch('title_search', query, { type: 'websearch' })
    .order('date', { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as TranscriptRow[];
}

// List transcripts (for @mention autocomplete)
transcriptsRouter.get('/transcripts', async (c) => {
  const query = c.req.query('q');
  const user = c.get('user');
  const supabase = getSupabase();

  let request = supabase
    .from('transcripts')
    .select('id, title, date, summary')
    .order('date', { ascending: false })
    .limit(50);

  if (query) {
    request = request.textSearch('title_search', query, { type: 'websearch' });
  }

  const { data, error } = await request;
  if (error) return c.json({ error: error.message }, 500);

  try {
    const visibleRows = await filterVisibleRows(user.id, user.email, (data ?? []) as TranscriptRow[]);
    return c.json(visibleRows);
  } catch (visibilityError) {
    return c.json(
      { error: visibilityError instanceof Error ? visibilityError.message : 'Failed to apply visibility' },
      500
    );
  }
});

// Canonical transcript search endpoint
transcriptsRouter.post('/transcripts/search', async (c) => {
  const user = c.get('user');
  const body = await c.req.json().catch(() => ({}));
  const query = typeof body.query === 'string' ? body.query.trim() : '';

  if (!query) {
    return c.json({ error: 'query is required' }, 400);
  }

  try {
    const rows = await searchTranscriptRows(query, 20);
    const visibleRows = await filterVisibleRows(user.id, user.email, rows);
    return c.json(visibleRows);
  } catch (error) {
    return c.json({ error: error instanceof Error ? error.message : 'Search failed' }, 500);
  }
});

// Backward-compatible alias endpoint
transcriptsRouter.get('/documents/search', async (c) => {
  const user = c.get('user');
  const query = c.req.query('q');
  if (!query?.trim()) {
    return c.json({ error: 'Query parameter q is required' }, 400);
  }

  try {
    const rows = await searchTranscriptRows(query.trim(), 20);
    const visibleRows = await filterVisibleRows(user.id, user.email, rows);
    return c.json(visibleRows);
  } catch (error) {
    return c.json({ error: error instanceof Error ? error.message : 'Search failed' }, 500);
  }
});

// Transcript detail
transcriptsRouter.get('/transcripts/:id', async (c) => {
  const transcriptId = c.req.param('id');
  const user = c.get('user');

  const canView = await canUserViewTranscript(user.id, user.email, transcriptId);
  if (!canView) {
    return c.json({ error: 'Not found' }, 404);
  }

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('transcripts')
    .select('id, title, date, summary, content')
    .eq('id', transcriptId)
    .maybeSingle();

  if (error) {
    return c.json({ error: error.message }, 500);
  }
  if (!data) {
    return c.json({ error: 'Not found' }, 404);
  }

  return c.json(data);
});

// Mention source payload
transcriptsRouter.get('/transcripts/:id/source', async (c) => {
  const transcriptId = c.req.param('id');
  const user = c.get('user');

  const canView = await canUserViewTranscript(user.id, user.email, transcriptId);
  if (!canView) {
    return c.json({ error: 'Not found' }, 404);
  }

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('transcripts')
    .select('id, title, date, summary')
    .eq('id', transcriptId)
    .maybeSingle();

  if (error) {
    return c.json({ error: error.message }, 500);
  }
  if (!data) {
    return c.json({ error: 'Not found' }, 404);
  }

  return c.json(data);
});

import { Hono } from 'hono';
import { getSupabase } from '../lib/supabase.js';

export const transcriptsRouter = new Hono();

// List transcripts (for @mention autocomplete)
transcriptsRouter.get('/transcripts', async (c) => {
  const query = c.req.query('q');
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
  return c.json(data ?? []);
});

// Search documents
transcriptsRouter.get('/documents/search', async (c) => {
  const query = c.req.query('q');
  if (!query) return c.json({ error: 'Query parameter q is required' }, 400);

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('transcripts')
    .select('id, title, date, summary')
    .textSearch('title_search', query, { type: 'websearch' })
    .order('date', { ascending: false })
    .limit(20);

  if (error) return c.json({ error: error.message }, 500);
  return c.json(data ?? []);
});

import { Hono } from 'hono';
import { getSupabase } from '../lib/supabase.js';

// Hardcoded dev user ID - replace with Clerk auth when implemented
const DEV_USER_ID = '00000000-0000-0000-0000-000000000000';

export const conversationsRouter = new Hono();

// Create conversation
conversationsRouter.post('/conversations', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const { title, model } = body as { title?: string; model?: string };

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('conversations')
    .insert({
      user_id: DEV_USER_ID,
      title: title ?? null,
      model: model ?? 'claude-sonnet-4.5',
    })
    .select()
    .single();

  if (error) {
    console.error('[conversations] Create failed:', error);
    return c.json({ error: error.message, details: error }, 500);
  }
  return c.json(data, 201);
});

// List conversations (grouped by date)
conversationsRouter.get('/conversations', async (c) => {
  const supabase = getSupabase();

  const { data, error } = await supabase
    .from('conversations')
    .select('id, title, auto_titled, model, pinned, pinned_at, created_at, updated_at')
    .eq('user_id', DEV_USER_ID)
    .is('deleted_at', null)
    .order('updated_at', { ascending: false });

  if (error) return c.json({ error: error.message }, 500);

  // Group conversations
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86400000);
  const last7 = new Date(today.getTime() - 7 * 86400000);
  const last30 = new Date(today.getTime() - 30 * 86400000);

  const groups = {
    pinned: [] as typeof data,
    today: [] as typeof data,
    yesterday: [] as typeof data,
    last_7_days: [] as typeof data,
    last_30_days: [] as typeof data,
    older: [] as typeof data,
  };

  for (const conv of data ?? []) {
    if (conv.pinned) {
      groups.pinned.push(conv);
      continue;
    }
    const updated = new Date(conv.updated_at);
    if (updated >= today) groups.today.push(conv);
    else if (updated >= yesterday) groups.yesterday.push(conv);
    else if (updated >= last7) groups.last_7_days.push(conv);
    else if (updated >= last30) groups.last_30_days.push(conv);
    else groups.older.push(conv);
  }

  return c.json(groups);
});

// Get conversation with messages
conversationsRouter.get('/conversations/:id', async (c) => {
  const id = c.req.param('id');
  const supabase = getSupabase();

  const { data: conv, error: convErr } = await supabase
    .from('conversations')
    .select('*')
    .eq('id', id)
    .eq('user_id', DEV_USER_ID)
    .is('deleted_at', null)
    .single();

  if (convErr || !conv) return c.json({ error: 'Not found' }, 404);

  const { data: messages } = await supabase
    .from('messages')
    .select('id, role, content, model, mentions, citations, token_count, created_at')
    .eq('conversation_id', id)
    .order('created_at', { ascending: true });

  return c.json({ ...conv, messages: messages ?? [] });
});

// Update conversation
conversationsRouter.patch('/conversations/:id', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json();
  const supabase = getSupabase();

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if ('title' in body) updates.title = body.title;
  if ('model' in body) updates.model = body.model;
  if ('pinned' in body) {
    updates.pinned = body.pinned;
    updates.pinned_at = body.pinned ? new Date().toISOString() : null;
  }

  const { data, error } = await supabase
    .from('conversations')
    .update(updates)
    .eq('id', id)
    .eq('user_id', DEV_USER_ID)
    .select()
    .single();

  if (error) return c.json({ error: error.message }, 500);
  return c.json(data);
});

// Delete conversation (soft delete)
conversationsRouter.delete('/conversations/:id', async (c) => {
  const id = c.req.param('id');
  const supabase = getSupabase();

  const { error } = await supabase
    .from('conversations')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', DEV_USER_ID);

  if (error) return c.json({ error: error.message }, 500);
  return c.json({ ok: true });
});

// Toggle pin
conversationsRouter.post('/conversations/:id/pin', async (c) => {
  const id = c.req.param('id');
  const supabase = getSupabase();

  // Get current pin state
  const { data: conv } = await supabase
    .from('conversations')
    .select('pinned')
    .eq('id', id)
    .eq('user_id', DEV_USER_ID)
    .single();

  if (!conv) return c.json({ error: 'Not found' }, 404);

  const newPinned = !conv.pinned;
  const { data, error } = await supabase
    .from('conversations')
    .update({
      pinned: newPinned,
      pinned_at: newPinned ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('user_id', DEV_USER_ID)
    .select()
    .single();

  if (error) return c.json({ error: error.message }, 500);
  return c.json(data);
});

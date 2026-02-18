import { Hono } from 'hono';
import { getSupabase } from '../lib/supabase.js';
import { DEFAULT_MODEL, isSupportedModel } from '../lib/constants.js';
import type { AppVariables } from '../types.js';

export const conversationsRouter = new Hono<{ Variables: AppVariables }>();

// Create conversation
conversationsRouter.post('/conversations', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const { title, model } = body as { title?: string; model?: string };

  if (model !== undefined && !isSupportedModel(model)) {
    return c.json({ error: `Invalid model: ${model}` }, 400);
  }

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('conversations')
    .insert({
      user_id: c.get('user').id,
      title: title ?? null,
      model: model ?? DEFAULT_MODEL,
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
    .eq('user_id', c.get('user').id)
    .is('deleted_at', null)
    .order('updated_at', { ascending: false });

  if (error) return c.json({ error: error.message }, 500);

  // Group conversations
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86400000);
  const twoDaysAgo = new Date(today.getTime() - 2 * 86400000);
  const last7 = new Date(today.getTime() - 7 * 86400000);
  const last14 = new Date(today.getTime() - 14 * 86400000);

  const groups = {
    pinned: [] as typeof data,
    today: [] as typeof data,
    yesterday: [] as typeof data,
    two_days_ago: [] as typeof data,
    last_7_days: [] as typeof data,
    last_week: [] as typeof data,
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
    else if (updated >= twoDaysAgo) groups.two_days_ago.push(conv);
    else if (updated >= last7) groups.last_7_days.push(conv);
    else if (updated >= last14) groups.last_week.push(conv);
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
    .eq('user_id', c.get('user').id)
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
  const body = await c.req.json().catch(() => ({}));

  if ('model' in body) {
    if (typeof body.model !== 'string' || !isSupportedModel(body.model)) {
      return c.json({ error: `Invalid model: ${body.model}` }, 400);
    }
  }

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
    .eq('user_id', c.get('user').id)
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
    .eq('user_id', c.get('user').id);

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
    .eq('user_id', c.get('user').id)
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
    .eq('user_id', c.get('user').id)
    .select()
    .single();

  if (error) return c.json({ error: error.message }, 500);
  return c.json(data);
});

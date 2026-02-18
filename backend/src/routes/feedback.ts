import { Hono } from 'hono';
import { getSupabase } from '../lib/supabase.js';
import type { AppVariables } from '../types.js';

export const feedbackRouter = new Hono<{ Variables: AppVariables }>();

// Submit or update feedback for a message
feedbackRouter.post('/messages/:id/feedback', async (c) => {
  const messageId = c.req.param('id');
  const body = await c.req.json().catch(() => ({}));
  const { feedback } = body as { feedback: 'positive' | 'negative' | null };
  const userId = c.get('user').id;

  const supabase = getSupabase();

  // Verify the message exists and belongs to user's conversation
  const { data: message, error: msgErr } = await supabase
    .from('messages')
    .select('id, conversation_id')
    .eq('id', messageId)
    .single();

  if (msgErr || !message) {
    return c.json({ error: 'Message not found' }, 404);
  }

  // Verify user owns this conversation
  const { data: conv, error: convErr } = await supabase
    .from('conversations')
    .select('id')
    .eq('id', message.conversation_id)
    .eq('user_id', userId)
    .single();

  if (convErr || !conv) {
    return c.json({ error: 'Unauthorized' }, 403);
  }

  // If feedback is null, delete existing feedback
  if (feedback === null) {
    await supabase
      .from('message_feedback')
      .delete()
      .eq('message_id', messageId)
      .eq('user_id', userId);

    return c.json({ feedback: null });
  }

  // Upsert feedback
  const { data, error } = await supabase
    .from('message_feedback')
    .upsert(
      {
        message_id: messageId,
        user_id: userId,
        feedback,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'message_id,user_id' }
    )
    .select('feedback')
    .single();

  if (error) {
    console.error('[feedback] Upsert failed:', error);
    return c.json({ error: error.message }, 500);
  }

  return c.json({ feedback: data.feedback });
});

// Get feedback for a message
feedbackRouter.get('/messages/:id/feedback', async (c) => {
  const messageId = c.req.param('id');
  const userId = c.get('user').id;
  const supabase = getSupabase();

  const { data, error } = await supabase
    .from('message_feedback')
    .select('feedback')
    .eq('message_id', messageId)
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    console.error('[feedback] Get failed:', error);
    return c.json({ error: error.message }, 500);
  }

  return c.json({ feedback: data?.feedback ?? null });
});

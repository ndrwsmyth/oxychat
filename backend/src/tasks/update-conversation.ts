import { defineTask } from '@ndrwsmyth/sediment';
import { getSupabase } from '../lib/supabase.js';

/**
 * Updates conversation timestamp.
 * Title generation has been moved to generateTitleTask for early execution.
 */
export const updateConversationTask = defineTask<
  { conversationId: string; model?: string },
  void
>('update_conversation', async function* (input) {
  const supabase = getSupabase();

  const updates: Record<string, string> = {
    updated_at: new Date().toISOString(),
  };
  if (input.model) {
    updates.model = input.model;
  }

  await supabase
    .from('conversations')
    .update(updates)
    .eq('id', input.conversationId);
});

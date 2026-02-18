import { defineTask } from '@ndrwsmyth/sediment';
import { getSupabase } from '../lib/supabase.js';

/**
 * Updates conversation timestamp.
 * Title generation has been moved to generateTitleTask for early execution.
 */
export const updateConversationTask = defineTask<
  { conversationId: string },
  void
>('update_conversation', async function* (input) {
  const supabase = getSupabase();

  await supabase
    .from('conversations')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', input.conversationId);
});

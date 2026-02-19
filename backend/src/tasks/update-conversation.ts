import { defineTask } from '@ndrwsmyth/sediment';
import { getSupabase } from '../lib/supabase.js';
import { ensurePersonalWorkspace } from '../lib/workspace-bootstrap.js';

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

  const { data: conversation } = await supabase
    .from('conversations')
    .select('user_id, project_id')
    .eq('id', input.conversationId)
    .maybeSingle();

  if (conversation?.user_id && !conversation.project_id) {
    const { data: userProfile } = await supabase
      .from('user_profiles')
      .select('email')
      .eq('id', conversation.user_id)
      .maybeSingle();

    const fallbackEmail = userProfile?.email ?? `user+${conversation.user_id}@oxy.so`;
    const { projectId } = await ensurePersonalWorkspace(conversation.user_id, fallbackEmail);
    updates.project_id = projectId;
  }

  await supabase
    .from('conversations')
    .update(updates)
    .eq('id', input.conversationId);
});

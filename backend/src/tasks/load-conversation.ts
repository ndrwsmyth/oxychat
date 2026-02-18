import { defineTask } from '@ndrwsmyth/sediment';
import { getSupabase } from '../lib/supabase.js';

export interface ConversationData {
  id: string;
  model: string;
  messages: Array<{ role: string; content: string }>;
}

/**
 * Loads a conversation and its messages from the database.
 */
export const loadConversationTask = defineTask<
  { conversationId: string },
  ConversationData
>('load_conversation', async function* (input) {
  const supabase = getSupabase();

  const { data: conversation, error: convError } = await supabase
    .from('conversations')
    .select('id, model')
    .eq('id', input.conversationId)
    .single();

  if (convError || !conversation) {
    throw new Error(`Conversation not found: ${input.conversationId}`);
  }

  const { data: messages, error: msgError } = await supabase
    .from('messages')
    .select('role, content')
    .eq('conversation_id', input.conversationId)
    .order('created_at', { ascending: true });

  if (msgError) {
    throw new Error(`Failed to load messages: ${msgError.message}`);
  }

  yield {
    id: conversation.id,
    model: conversation.model,
    messages: messages ?? [],
  };
});

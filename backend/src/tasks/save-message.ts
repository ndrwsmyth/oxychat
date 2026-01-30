import { defineTask } from 'sediment';
import { getSupabase } from '../lib/supabase.js';

export interface SaveMessageInput {
  conversationId: string;
  role: 'user' | 'assistant';
  content: string;
  model?: string;
  mentions?: string[];
  citations?: unknown[];
  tokenCount?: number;
  requestId?: string;
}

export interface SavedMessage {
  id: string;
  conversationId: string;
  role: string;
  content: string;
  createdAt: string;
}

/**
 * Persists a message to the database.
 */
export const saveMessageTask = defineTask<SaveMessageInput, SavedMessage>(
  'save_message',
  async function* (input) {
    const supabase = getSupabase();

    const { data, error } = await supabase
      .from('messages')
      .insert({
        conversation_id: input.conversationId,
        role: input.role,
        content: input.content,
        model: input.model,
        mentions: input.mentions ?? [],
        citations: input.citations ?? [],
        token_count: input.tokenCount,
        request_id: input.requestId,
      })
      .select('id, conversation_id, role, content, created_at')
      .single();

    if (error || !data) {
      throw new Error(`Failed to save message: ${error?.message}`);
    }

    yield {
      id: data.id,
      conversationId: data.conversation_id,
      role: data.role,
      content: data.content,
      createdAt: data.created_at,
    };
  }
);

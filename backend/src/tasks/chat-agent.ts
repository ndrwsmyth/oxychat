import { defineTask } from 'sediment';
import { getSystemPrompt, getContextLimit, CHARS_PER_TOKEN } from '../lib/constants.js';
import { getModelId } from '../lib/runtime.js';
import { getSupabase } from '../lib/supabase.js';

export interface ChatAgentInput {
  model: string;
  conversationMessages: Array<{ role: string; content: string }>;
  userContent: string;
  mentionIds: string[];
  userContext?: string;
}

/**
 * Layer 2: Builds the prompt with context and streams tokens from the LLM.
 * Yields string chunks (tokens) as they arrive.
 */
export const chatAgentTask = defineTask<ChatAgentInput, string>(
  'chat_agent',
  async function* (input, deps) {
    // Build context from @mentions
    let mentionContext = '';
    const mentionIds = input.mentionIds ?? [];
    if (mentionIds.length > 0) {
      const supabase = getSupabase();
      const { data: transcripts } = await supabase
        .from('transcripts')
        .select('id, title, content')
        .in('id', mentionIds);

      if (transcripts?.length) {
        const contextLimit = getContextLimit(input.model);
        const maxChars = contextLimit * CHARS_PER_TOKEN;
        let totalChars = 0;

        const docs = transcripts
          .map((t) => {
            const remaining = maxChars - totalChars;
            if (remaining <= 0) return null;
            const content = t.content.slice(0, remaining);
            totalChars += content.length;
            return `<document id="${t.id}" title="${t.title}">\n${content}\n</document>`;
          })
          .filter(Boolean);

        mentionContext = `\n\n<referenced_documents>\n${docs.join('\n\n')}\n</referenced_documents>`;
      }
    }

    // Build system prompt with optional user context
    const systemPrompt = getSystemPrompt(input.userContext) + mentionContext;

    // Build messages
    const messages = [
      ...input.conversationMessages.map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
      { role: 'user' as const, content: input.userContent },
    ];

    // Stream via Sediment adapter
    const modelId = getModelId(input.model);

    for await (const chunk of deps.completions.complete({
      model: modelId,
      messages: [{ role: 'system', content: systemPrompt }, ...messages],
      maxTokens: 8192,
    })) {
      if (chunk.type === 'token') {
        yield chunk.content;
      }
    }
  }
);

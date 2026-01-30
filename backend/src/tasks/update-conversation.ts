import { defineTask, completionTask, runTaskToCompletion } from 'sediment';
import { getSupabase } from '../lib/supabase.js';
import { getModelId } from '../lib/runtime.js';

/**
 * Updates conversation timestamp. Optionally auto-titles if no title exists.
 */
export const updateConversationTask = defineTask<
  {
    conversationId: string;
    model: string;
    userMessage: string;
    assistantMessage: string;
  },
  { title?: string }
>('update_conversation', async function* (input, deps) {
  const supabase = getSupabase();

  // Check if conversation needs a title
  const { data: conv } = await supabase
    .from('conversations')
    .select('title, auto_titled')
    .eq('id', input.conversationId)
    .single();

  let title: string | undefined;

  if (!conv?.title || !conv.auto_titled) {
    // Generate title via LLM
    const titleTask = completionTask('auto_title', (_input: string) => ({
      model: getModelId(input.model),
      messages: [
        {
          role: 'system' as const,
          content:
            'Generate a short, descriptive title (max 6 words) for this conversation. Return ONLY the title text, nothing else.',
        },
        { role: 'user' as const, content: input.userMessage },
        { role: 'assistant' as const, content: input.assistantMessage.slice(0, 500) },
      ],
      maxTokens: 30,
    }));

    const result = await runTaskToCompletion(titleTask, '', deps);
    title = typeof result === 'string' ? result.trim().replace(/^["']|["']$/g, '') : undefined;

    if (title) {
      await supabase
        .from('conversations')
        .update({ title, auto_titled: true, updated_at: new Date().toISOString() })
        .eq('id', input.conversationId);
    }
  } else {
    // Just update timestamp
    await supabase
      .from('conversations')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', input.conversationId);
  }

  yield { title };
});

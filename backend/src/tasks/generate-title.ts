import { defineTask } from 'sediment';
import { getSupabase } from '../lib/supabase.js';
import { TITLE_MODEL } from '../lib/constants.js';

interface GenerateTitleInput {
  conversationId: string;
  userMessage: string;
}

/**
 * Generates a concise title for a conversation based on the user's first message.
 * Uses gpt-4.1-nano for fast, cheap title generation.
 *
 * Constraints:
 * - Max 5 words
 * - Under 40 characters
 * - Only runs once per conversation (checks auto_titled flag)
 */
export const generateTitleTask = defineTask<GenerateTitleInput, string | null>(
  'generate_title',
  async function* (input, deps) {
    console.log('[generate-title] Starting for conversation:', input.conversationId);
    const supabase = getSupabase();

    // Skip if conversation already has an auto-generated title
    const { data: conv } = await supabase
      .from('conversations')
      .select('auto_titled')
      .eq('id', input.conversationId)
      .single();

    console.log('[generate-title] Conversation auto_titled:', conv?.auto_titled);
    if (conv?.auto_titled) {
      console.log('[generate-title] Skipping - already titled');
      return;
    }

    // Generate title using Sediment completions adapter
    console.log('[generate-title] Calling LLM with model:', TITLE_MODEL);
    let rawTitle = '';
    for await (const chunk of deps.completions.complete({
      model: TITLE_MODEL,
      messages: [
        {
          role: 'user',
          content: `Generate a concise title (max 5 words, under 40 characters) for a conversation that starts with this message. Return ONLY the title, no quotes or punctuation:

"${input.userMessage.slice(0, 200)}"`,
        },
      ],
      maxTokens: 20,
    })) {
      if (chunk.type === 'token') {
        rawTitle += chunk.content;
      }
    }

    console.log('[generate-title] Raw title from LLM:', rawTitle);

    // Clean and validate the title
    const title = rawTitle
      .trim()
      .replace(/^["']|["']$/g, '') // Remove surrounding quotes
      .replace(/^[-–—•*#]+\s*/, '') // Remove leading punctuation/bullets
      .slice(0, 40);

    console.log('[generate-title] Cleaned title:', title);

    // Reject invalid titles (too short, fragments, or weird output)
    if (!title || title.length < 3 || /^[^a-zA-Z0-9]/.test(title)) {
      console.log('[generate-title] Title rejected as invalid');
      return;
    }

    const { error: updateError } = await supabase
      .from('conversations')
      .update({ title, auto_titled: true, updated_at: new Date().toISOString() })
      .eq('id', input.conversationId);

    if (updateError) {
      console.log('[generate-title] Failed to update DB:', updateError.message);
    } else {
      console.log('[generate-title] Updated DB with title:', title);
    }

    console.log('[generate-title] Yielding title:', title);
    yield title;
  }
);

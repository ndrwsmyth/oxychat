import { defineTask } from '@ndrwsmyth/sediment';
import { getSystemPrompt } from '../lib/constants.js';
import { getModelId } from '../lib/runtime.js';
import { getSupabase } from '../lib/supabase.js';
import {
  buildPromptContext,
  type PromptMentionDocument,
  type PromptSourceInfo,
  type PromptTruncationInfo,
} from '../lib/prompt-context.js';

export interface ChatAgentInput {
  model: string;
  conversationMessages: Array<{ role: string; content: string }>;
  userContent: string;
  mentionIds: string[];
  projectOverviewMarkdown?: string;
  userId?: string;
  userEmail?: string;
  userContext?: string;
}

export type ChatAgentEvent =
  | {
      type: 'sources';
      sources: PromptSourceInfo[];
      truncation_info: PromptTruncationInfo[];
    }
  | {
      type: 'token';
      content: string;
    };

/**
 * Layer 2: Builds the prompt with context and streams tokens from the LLM.
 * Yields string chunks (tokens) as they arrive.
 */
export const chatAgentTask = defineTask<ChatAgentInput, ChatAgentEvent>(
  'chat_agent',
  async function* (input, deps) {
    let mentionDocuments: PromptMentionDocument[] = [];
    const mentionIds = input.mentionIds ?? [];

    if (mentionIds.length > 0) {
      const supabase = getSupabase();
      const { data: transcripts } = await supabase
        .from('transcripts')
        .select('id, title, content')
        .in('id', mentionIds);

      if (transcripts?.length) {
        const transcriptById = new Map(
          transcripts.map((transcript) => [transcript.id, transcript] as const)
        );
        mentionDocuments = mentionIds
          .map((mentionId) => transcriptById.get(mentionId))
          .filter((transcript): transcript is { id: string; title: string; content: string } => Boolean(transcript))
          .map((transcript) => ({
            id: transcript.id,
            title: transcript.title,
            content: transcript.content,
          }));
      }
    }

    const promptContext = buildPromptContext({
      model: input.model,
      systemBase: getSystemPrompt(),
      projectOverviewMarkdown: input.projectOverviewMarkdown,
      userContext: input.userContext,
      mentionDocuments,
    });
    yield {
      type: 'sources',
      sources: promptContext.sources,
      truncation_info: promptContext.truncationInfo,
    };

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
      messages: [{ role: 'system', content: promptContext.prompt }, ...messages],
      maxTokens: 8192,
    })) {
      if (chunk.type === 'token') {
        yield { type: 'token', content: chunk.content };
      }
    }
  }
);

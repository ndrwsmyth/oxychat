import { defineTask, runTaskToCompletion } from 'sediment';
import { parseInputTask, type ParsedInput } from './parse-input.js';
import { loadConversationTask, type ConversationData } from './load-conversation.js';
import { saveMessageTask } from './save-message.js';
import { updateConversationTask } from './update-conversation.js';
import { chatAgentTask } from './chat-agent.js';
import { generateTitleTask } from './generate-title.js';
import { createTitleRuntime } from '../lib/runtime.js';

export interface ChatPipelineInput {
  conversationId: string;
  content: string;
  mentionIds?: string[];
  model: string;
  userContext?: string;
}

export interface ChatPipelineEvent {
  type: 'token' | 'done' | 'title_update' | 'error';
  content?: string;
  messageId?: string;
  title?: string;
  error?: string;
}

/**
 * Layer 3: Full chat pipeline.
 * 1. Parse input (extract mentions)
 * 2. Load conversation history
 * 3. Save user message
 * 4. Stream LLM response (yielding token events)
 * 5. Save assistant message
 * 6. Update conversation (auto-title if needed)
 */
export const chatPipelineTask = defineTask<ChatPipelineInput, ChatPipelineEvent>(
  'chat_pipeline',
  async function* (input, deps) {
    // 1. Parse input
    const parsed = await runTaskToCompletion(parseInputTask, {
      content: input.content,
      mentionIds: input.mentionIds,
    }, deps) as ParsedInput;

    // 2. Load conversation
    const conversation = await runTaskToCompletion(loadConversationTask, {
      conversationId: input.conversationId,
    }, deps) as ConversationData;

    // 3. Save user message
    const savedUser = await runTaskToCompletion(saveMessageTask, {
      conversationId: input.conversationId,
      role: 'user',
      content: input.content,
      mentions: parsed.mentionIds,
    }, deps);

    // Generate title for first message (uses fast nano model)
    // Runs early so title appears in sidebar before streaming completes
    const isFirstMessage = conversation.messages.length === 0;
    if (isFirstMessage) {
      const titleDeps = createTitleRuntime().getDeps();
      const title = await runTaskToCompletion(generateTitleTask, {
        conversationId: input.conversationId,
        userMessage: input.content,
      }, titleDeps);

      if (title) {
        yield { type: 'title_update' as const, title };
      }
    }

    // 4. Stream LLM response
    let fullContent = '';
    for await (const token of chatAgentTask.execute({
      model: input.model,
      conversationMessages: conversation.messages,
      userContent: input.content,
      mentionIds: parsed.mentionIds,
      userContext: input.userContext,
    }, deps)) {
      fullContent += token;
      yield { type: 'token' as const, content: token };
    }

    // 5. Save assistant message (link to completion logs via requestId)
    const savedAssistant = await runTaskToCompletion(saveMessageTask, {
      conversationId: input.conversationId,
      role: 'assistant',
      content: fullContent,
      model: input.model,
      requestId: deps._requestId,
    }, deps);

    // 6. Update conversation timestamp
    await runTaskToCompletion(updateConversationTask, {
      conversationId: input.conversationId,
    }, deps);

    const msgId = savedAssistant && typeof savedAssistant === 'object' && 'id' in savedAssistant
      ? (savedAssistant as { id: string }).id
      : undefined;

    yield { type: 'done' as const, messageId: msgId };
  }
);

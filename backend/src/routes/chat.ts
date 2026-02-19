import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import { chatPipelineTask, type ChatPipelineEvent } from '../tasks/chat-pipeline.js';
import { createChatRuntime } from '../lib/runtime.js';
import { DEFAULT_MODEL, isSupportedModel } from '../lib/constants.js';
import type { AppVariables } from '../types.js';
import { AccessDeniedError, assertConversationOwnership } from '../lib/acl.js';

export const chatRouter = new Hono<{ Variables: AppVariables }>();

// Send message and stream response
chatRouter.post('/conversations/:id/messages', async (c) => {
  const conversationId = c.req.param('id');
  const body = await c.req.json();
  const { content, mentions, model } = body as {
    content: string;
    mentions?: string[];
    model?: string;
  };

  if (!content?.trim()) {
    return c.json({ error: 'Content is required' }, 400);
  }
  const user = c.get('user');

  let conversation: { id: string; model: string | null; project_id: string | null };
  try {
    conversation = await assertConversationOwnership(user.id, conversationId);
  } catch (error) {
    if (error instanceof AccessDeniedError) {
      return c.json({ error: 'Conversation not found' }, 404);
    }
    return c.json({ error: error instanceof Error ? error.message : 'Conversation lookup failed' }, 500);
  }

  const effectiveModel = model ?? conversation.model ?? DEFAULT_MODEL;
  if (!isSupportedModel(effectiveModel)) {
    return c.json({ error: `Invalid model: ${effectiveModel}` }, 400);
  }

  return streamSSE(c, async (stream) => {
    try {
      const runtime = createChatRuntime({
        model: effectiveModel,
        conversationId,
      });

      const deps = runtime.getDeps();
      const input = {
        conversationId,
        content,
        mentionIds: mentions,
        model: effectiveModel,
        userContext: user.context ?? undefined,
        requestId: runtime.getRequestId(),
      };

      // Stream directly from task execution instead of buffering
      for await (const event of chatPipelineTask.execute(input, deps)) {
        await stream.writeSSE({ data: JSON.stringify(event as ChatPipelineEvent) });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Internal error';
      await stream.writeSSE({
        data: JSON.stringify({ type: 'error', error: message }),
      });
    }

    await stream.writeSSE({ data: '[DONE]' });
  });
});

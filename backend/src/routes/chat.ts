import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import { chatPipelineTask, type ChatPipelineEvent } from '../tasks/chat-pipeline.js';
import { createChatRuntime } from '../lib/runtime.js';
import type { AppVariables } from '../types.js';

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

  const selectedModel = model ?? 'claude-sonnet-4.5';
  const user = c.get('user');

  return streamSSE(c, async (stream) => {
    try {
      const runtime = createChatRuntime({
        model: selectedModel,
        conversationId,
      });

      const deps = runtime.getDeps();
      const input = {
        conversationId,
        content,
        mentionIds: mentions,
        model: selectedModel,
        userContext: user.context ?? undefined,
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

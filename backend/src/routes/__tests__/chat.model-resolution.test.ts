import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Hono } from 'hono';
import { chatRouter } from '../chat.js';
import { DEFAULT_MODEL } from '../../lib/constants.js';
import { createChatRuntime } from '../../lib/runtime.js';
import { chatPipelineTask } from '../../tasks/chat-pipeline.js';
import type { AppVariables } from '../../types.js';
import { assertConversationOwnership } from '../../lib/acl.js';

vi.mock('../../lib/acl.js', () => ({
  AccessDeniedError: class AccessDeniedError extends Error {},
  assertConversationOwnership: vi.fn(),
}));

vi.mock('../../lib/runtime.js', () => ({
  createChatRuntime: vi.fn(),
}));

vi.mock('../../tasks/chat-pipeline.js', () => ({
  chatPipelineTask: {
    execute: vi.fn(),
  },
}));

const mockUser = {
  id: 'user-1',
  clerkId: 'clerk-1',
  email: 'user@oxy.so',
  fullName: 'Test User',
  avatarUrl: null,
  context: null,
};

function createAuthedApp() {
  const app = new Hono<{ Variables: AppVariables }>();
  app.use('*', async (c, next) => {
    c.set('user', mockUser);
    await next();
  });
  app.route('/api', chatRouter);
  return app;
}

async function* doneOnlyEvents() {
  yield { type: 'done' as const };
}

describe('chat model resolution', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(chatPipelineTask.execute).mockReturnValue(doneOnlyEvents());
    vi.mocked(createChatRuntime).mockReturnValue({
      getDeps: () => ({ completions: {} }),
      getRequestId: () => 'req-1',
    } as never);
    vi.mocked(assertConversationOwnership).mockResolvedValue({
      id: 'conv-1',
      model: 'gpt-5.2',
      project_id: 'project-1',
    });
  });

  it('uses request.model when provided', async () => {
    const app = createAuthedApp();

    const response = await app.request('/api/conversations/conv-1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ content: 'hello', model: 'grok-4' }),
    });

    expect(response.status).toBe(200);
    expect(vi.mocked(createChatRuntime)).toHaveBeenCalledWith({
      model: 'grok-4',
      conversationId: 'conv-1',
    });
    expect(vi.mocked(chatPipelineTask.execute).mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({ projectId: 'project-1' })
    );
  });

  it('uses conversation.model when request.model is missing', async () => {
    vi.mocked(assertConversationOwnership).mockResolvedValue({
      id: 'conv-1',
      model: 'gpt-5.2',
      project_id: 'project-1',
    });
    const app = createAuthedApp();

    const response = await app.request('/api/conversations/conv-1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ content: 'hello' }),
    });

    expect(response.status).toBe(200);
    expect(vi.mocked(createChatRuntime)).toHaveBeenCalledWith({
      model: 'gpt-5.2',
      conversationId: 'conv-1',
    });
  });

  it('falls back to DEFAULT_MODEL when request and conversation model are missing', async () => {
    vi.mocked(assertConversationOwnership).mockResolvedValue({
      id: 'conv-1',
      model: null,
      project_id: 'project-1',
    });
    const app = createAuthedApp();

    const response = await app.request('/api/conversations/conv-1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ content: 'hello' }),
    });

    expect(response.status).toBe(200);
    expect(vi.mocked(createChatRuntime)).toHaveBeenCalledWith({
      model: DEFAULT_MODEL,
      conversationId: 'conv-1',
    });
  });

  it('returns 400 before streaming for invalid request model', async () => {
    const app = createAuthedApp();

    const response = await app.request('/api/conversations/conv-1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ content: 'hello', model: 'invalid-model' }),
    });

    expect(response.status).toBe(400);
    expect(vi.mocked(createChatRuntime)).not.toHaveBeenCalled();
    expect(vi.mocked(chatPipelineTask.execute)).not.toHaveBeenCalled();
  });

  it('passes undefined projectId when conversation has no project assignment', async () => {
    vi.mocked(assertConversationOwnership).mockResolvedValue({
      id: 'conv-1',
      model: 'gpt-5.2',
      project_id: null,
    });
    const app = createAuthedApp();

    const response = await app.request('/api/conversations/conv-1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ content: 'hello' }),
    });

    expect(response.status).toBe(200);
    expect(vi.mocked(chatPipelineTask.execute).mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({ projectId: undefined })
    );
  });
});

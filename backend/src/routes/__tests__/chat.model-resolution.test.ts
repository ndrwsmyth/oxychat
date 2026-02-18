import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Hono } from 'hono';
import { chatRouter } from '../chat.js';
import { DEFAULT_MODEL } from '../../lib/constants.js';
import { getSupabase } from '../../lib/supabase.js';
import { createChatRuntime } from '../../lib/runtime.js';
import { chatPipelineTask } from '../../tasks/chat-pipeline.js';
import type { AppVariables } from '../../types.js';

vi.mock('../../lib/supabase.js', () => ({
  getSupabase: vi.fn(),
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

function createConversationLookupSupabaseMock(model: string | null) {
  const table = {
    select: vi.fn(() => table),
    eq: vi.fn(() => table),
    is: vi.fn(() => table),
    single: vi.fn(async () => ({
      data: model === null ? { id: 'conv-1', model: null } : { id: 'conv-1', model },
      error: null,
    })),
  };

  return {
    from: vi.fn(() => table),
  };
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
  });

  it('uses request.model when provided', async () => {
    vi.mocked(getSupabase).mockReturnValue(createConversationLookupSupabaseMock('gpt-5.2') as never);
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
  });

  it('uses conversation.model when request.model is missing', async () => {
    vi.mocked(getSupabase).mockReturnValue(createConversationLookupSupabaseMock('gpt-5.2') as never);
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
    vi.mocked(getSupabase).mockReturnValue(createConversationLookupSupabaseMock(null) as never);
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
    vi.mocked(getSupabase).mockReturnValue(createConversationLookupSupabaseMock('gpt-5.2') as never);
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
});

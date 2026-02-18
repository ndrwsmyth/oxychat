import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createConversation, setAuthTokenGetter, streamChat } from '../lib/api';

function createConversationResponse(model: string, id = 'conv-1') {
  return new Response(
    JSON.stringify({
      id,
      title: null,
      auto_titled: false,
      model,
      pinned: false,
      pinned_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }),
    { status: 201, headers: { 'content-type': 'application/json' } }
  );
}

function createDoneSseResponse() {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode('data: {"type":"done"}\n\n'));
      controller.close();
    },
  });

  return new Response(stream, {
    status: 200,
    headers: { 'content-type': 'text/event-stream' },
  });
}

describe('model consistency API integration', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    setAuthTokenGetter(async () => null);
  });

  it('new conversation includes selected model in create payload', async () => {
    const fetchMock = vi.spyOn(global, 'fetch').mockResolvedValue(createConversationResponse('claude-sonnet-4-6'));

    await createConversation(undefined, 'claude-sonnet-4-6');

    const [, init] = fetchMock.mock.calls[0];
    const body = JSON.parse(String(init?.body));
    expect(body.model).toBe('claude-sonnet-4-6');
  });

  it('include-history switch sends selected model on existing conversation', async () => {
    const fetchMock = vi.spyOn(global, 'fetch').mockResolvedValue(createDoneSseResponse());
    const onComplete = vi.fn();
    const onError = vi.fn();

    await streamChat({
      conversationId: 'conv-existing',
      messages: [{ role: 'user', content: 'hello' }],
      model: 'grok-4',
      onChunk: () => {},
      onComplete,
      onError,
    });

    expect(onError).not.toHaveBeenCalled();
    expect(onComplete).toHaveBeenCalled();

    const [url, init] = fetchMock.mock.calls[0];
    const body = JSON.parse(String(init?.body));
    expect(String(url)).toContain('/api/conversations/conv-existing/messages');
    expect(body.model).toBe('grok-4');
  });

  it('fresh-start flow keeps selected model on create and first message send', async () => {
    const fetchMock = vi
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce(createConversationResponse('claude-opus-4-6', 'conv-fresh'))
      .mockResolvedValueOnce(createDoneSseResponse());

    const created = await createConversation(undefined, 'claude-opus-4-6');

    await streamChat({
      conversationId: created.id,
      messages: [{ role: 'user', content: 'new thread message' }],
      model: 'claude-opus-4-6',
      onChunk: () => {},
      onComplete: () => {},
      onError: () => {},
    });

    const createBody = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
    const sendBody = JSON.parse(String(fetchMock.mock.calls[1][1]?.body));
    expect(createBody.model).toBe('claude-opus-4-6');
    expect(sendBody.model).toBe('claude-opus-4-6');
  });
});

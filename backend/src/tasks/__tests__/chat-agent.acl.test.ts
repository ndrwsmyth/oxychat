import { beforeEach, describe, expect, it, vi } from 'vitest';
import { chatAgentTask } from '../chat-agent.js';
import { getSupabase } from '../../lib/supabase.js';
import { filterVisibleTranscriptIdsForUser } from '../../lib/transcript-visibility.js';

vi.mock('../../lib/supabase.js', () => ({
  getSupabase: vi.fn(),
}));

vi.mock('../../lib/transcript-visibility.js', () => ({
  filterVisibleTranscriptIdsForUser: vi.fn(),
}));

describe('chatAgentTask mention ACL enforcement', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('drops unauthorized mentions before transcript context load', async () => {
    vi.mocked(filterVisibleTranscriptIdsForUser).mockResolvedValue([]);

    const complete = vi.fn(async function* (_request: { messages: Array<{ role: string; content: string }> }) {
      yield { type: 'token' as const, content: 'ok' };
    });

    const chunks: string[] = [];
    for await (const chunk of chatAgentTask.execute(
      {
        model: 'claude-sonnet-4-6',
        conversationMessages: [],
        userContent: 'Question',
        mentionIds: ['private-transcript-id'],
        userId: 'user-1',
        userEmail: 'member@oxy.so',
      },
      { completions: { complete } } as never
    )) {
      chunks.push(chunk);
    }

    expect(chunks.join('')).toBe('ok');
    expect(vi.mocked(getSupabase)).not.toHaveBeenCalled();
    const systemPrompt = complete.mock.calls[0]?.[0]?.messages?.[0]?.content ?? '';
    expect(systemPrompt).not.toContain('<referenced_documents>');
  });

  it('loads authorized mention transcript context', async () => {
    vi.mocked(filterVisibleTranscriptIdsForUser).mockResolvedValue(['t1']);

    const query = {
      in: vi.fn(async () => ({
        data: [{ id: 't1', title: 'Visible', content: 'Visible content' }],
        error: null,
      })),
    };

    vi.mocked(getSupabase).mockReturnValue({
      from: vi.fn(() => ({
        select: vi.fn(() => query),
      })),
    } as never);

    const complete = vi.fn(async function* (_request: { messages: Array<{ role: string; content: string }> }) {
      yield { type: 'token' as const, content: 'ok' };
    });

    for await (const _chunk of chatAgentTask.execute(
      {
        model: 'claude-sonnet-4-6',
        conversationMessages: [],
        userContent: 'Question',
        mentionIds: ['t1'],
        userId: 'user-1',
        userEmail: 'member@oxy.so',
      },
      { completions: { complete } } as never
    )) {
      // consume
    }

    const systemPrompt = complete.mock.calls[0]?.[0]?.messages?.[0]?.content ?? '';
    expect(systemPrompt).toContain('<document id="t1" title="Visible">');
  });
});

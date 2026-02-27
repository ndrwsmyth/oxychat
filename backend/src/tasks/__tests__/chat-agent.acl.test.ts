import { beforeEach, describe, expect, it, vi } from 'vitest';
import { chatAgentTask } from '../chat-agent.js';
import { getSupabase } from '../../lib/supabase.js';

vi.mock('../../lib/supabase.js', () => ({
  getSupabase: vi.fn(),
}));

describe('chatAgentTask prompt assembly', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('emits metadata and assembles canonical prompt order', async () => {
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

    const events: Array<{ type: string; content?: string; sources?: Array<{ type: string }> }> = [];
    for await (const event of chatAgentTask.execute(
      {
        model: 'claude-sonnet-4-6',
        conversationMessages: [],
        userContent: 'Question',
        mentionIds: ['t1'],
        userContext: 'Current user context',
        projectOverviewMarkdown: 'Project overview',
      },
      { completions: { complete } } as never
    )) {
      events.push(event as { type: string; content?: string; sources?: Array<{ type: string }> });
    }

    expect(events[0]?.type).toBe('sources');
    expect(events[0]?.sources?.map((source) => source.type)).toEqual(['overview', 'mention']);
    expect(events[1]).toEqual({ type: 'token', content: 'ok' });

    const systemPrompt = complete.mock.calls[0]?.[0]?.messages?.[0]?.content ?? '';
    const overviewIndex = systemPrompt.indexOf('<project_overview>');
    const userContextIndex = systemPrompt.indexOf('<current_user_context>');
    const docsIndex = systemPrompt.indexOf('<referenced_documents>');

    expect(overviewIndex).toBeGreaterThan(-1);
    expect(userContextIndex).toBeGreaterThan(overviewIndex);
    expect(docsIndex).toBeGreaterThan(userContextIndex);
    expect(systemPrompt).toContain('<document id="t1" title="Visible">');
  });

  it('keeps mention ordering deterministic from input ids', async () => {
    const query = {
      in: vi.fn(async () => ({
        data: [
          { id: 't2', title: 'Two', content: 'Two content' },
          { id: 't1', title: 'One', content: 'One content' },
        ],
        error: null,
      })),
    };

    const fromMock = vi.fn(() => ({
      select: vi.fn(() => query),
    }));
    vi.mocked(getSupabase).mockReturnValue({
      from: fromMock,
    } as never);

    const complete = vi.fn(async function* (_request: { messages: Array<{ role: string; content: string }> }) {
      yield { type: 'token' as const, content: 'ok' };
    });

    for await (const _event of chatAgentTask.execute(
      {
        model: 'claude-sonnet-4-6',
        conversationMessages: [],
        userContent: 'Question',
        mentionIds: ['t1', 't2'],
      },
      { completions: { complete } } as never
    )) {
      // consume
    }

    expect(fromMock).toHaveBeenCalledWith('transcripts');
    const systemPrompt = complete.mock.calls[0]?.[0]?.messages?.[0]?.content ?? '';
    expect(systemPrompt.indexOf('id="t1"')).toBeLessThan(systemPrompt.indexOf('id="t2"'));
  });
});

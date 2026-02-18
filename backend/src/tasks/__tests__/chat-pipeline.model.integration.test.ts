import { beforeEach, describe, expect, it, vi } from 'vitest';
import { chatPipelineTask } from '../chat-pipeline.js';
import { getSupabase } from '../../lib/supabase.js';

vi.mock('../../lib/supabase.js', () => ({
  getSupabase: vi.fn(),
}));

interface ConversationRow {
  id: string;
  model: string;
  updated_at: string;
}

interface MessageRow {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  model?: string;
  mentions?: string[];
  citations?: unknown[];
  request_id?: string;
  created_at: string;
}

function createInMemorySupabase() {
  const conversation: ConversationRow = {
    id: 'conv-1',
    model: 'gpt-5.2',
    updated_at: new Date().toISOString(),
  };

  const messages: MessageRow[] = [
    {
      id: 'seed-1',
      conversation_id: 'conv-1',
      role: 'user',
      content: 'Existing context',
      model: undefined,
      created_at: new Date(Date.now() - 60_000).toISOString(),
    },
  ];

  const inserts: Array<Record<string, unknown>> = [];
  const updates: Array<Record<string, unknown>> = [];

  const supabase = {
    from: (table: string) => {
      if (table === 'conversations') {
        return {
          select: (_columns: string) => {
            const query = {
              eq: (_field: string, _value: string) => query,
              single: async () => ({
                data: { id: conversation.id, model: conversation.model },
                error: null,
              }),
            };
            return query;
          },
          update: (payload: Record<string, unknown>) => ({
            eq: async (_field: string, _value: string) => {
              updates.push(payload);
              if (typeof payload.model === 'string') {
                conversation.model = payload.model;
              }
              if (typeof payload.updated_at === 'string') {
                conversation.updated_at = payload.updated_at;
              }
              return { data: null, error: null };
            },
          }),
        };
      }

      if (table === 'messages') {
        return {
          select: (_columns: string) => ({
            eq: (_field: string, value: string) => ({
              order: async () => ({
                data: messages
                  .filter((m) => m.conversation_id === value)
                  .map((m) => ({ role: m.role, content: m.content })),
                error: null,
              }),
            }),
          }),
          insert: (payload: Record<string, unknown>) => {
            inserts.push(payload);
            const created: MessageRow = {
              id: `msg-${inserts.length}`,
              conversation_id: payload.conversation_id as string,
              role: payload.role as MessageRow['role'],
              content: payload.content as string,
              model: payload.model as string | undefined,
              mentions: payload.mentions as string[] | undefined,
              citations: payload.citations as unknown[] | undefined,
              request_id: payload.request_id as string | undefined,
              created_at: new Date().toISOString(),
            };
            messages.push(created);

            return {
              select: (_columns: string) => ({
                single: async () => ({
                  data: {
                    id: created.id,
                    conversation_id: created.conversation_id,
                    role: created.role,
                    content: created.content,
                    created_at: created.created_at,
                  },
                  error: null,
                }),
              }),
            };
          },
        };
      }

      throw new Error(`Unexpected table: ${table}`);
    },
  };

  return { supabase, inserts, updates, conversation };
}

describe('chatPipelineTask model persistence', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('saves assistant model and syncs conversation model to effective model', async () => {
    const { supabase, inserts, updates, conversation } = createInMemorySupabase();
    vi.mocked(getSupabase).mockReturnValue(supabase as never);

    const deps = {
      completions: {
        complete: async function* () {
          yield { type: 'token' as const, content: 'Assistant reply' };
        },
      },
    };

    const events: Array<{ type: string; content?: string }> = [];
    for await (const event of chatPipelineTask.execute(
      {
        conversationId: 'conv-1',
        content: 'What changed?',
        mentionIds: [],
        model: 'grok-4',
        requestId: 'req-123',
      },
      deps as never
    )) {
      events.push(event);
    }

    const assistantInsert = inserts.find((payload) => payload.role === 'assistant');
    expect(assistantInsert?.model).toBe('grok-4');
    expect(updates).toContainEqual(expect.objectContaining({ model: 'grok-4' }));
    expect(conversation.model).toBe('grok-4');
    expect(events.some((event) => event.type === 'done')).toBe(true);
  });
});

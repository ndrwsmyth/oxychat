import { beforeEach, describe, expect, it, vi } from 'vitest';
import { chatPipelineTask } from '../chat-pipeline.js';
import { getSupabase } from '../../lib/supabase.js';
import { filterVisibleTranscriptIdsForUser } from '../../lib/transcript-visibility.js';
import { assertProjectAccess, AccessDeniedError } from '../../lib/acl.js';

vi.mock('../../lib/supabase.js', () => ({
  getSupabase: vi.fn(),
}));

vi.mock('../../lib/transcript-visibility.js', () => ({
  filterVisibleTranscriptIdsForUser: vi.fn(async (_userId: string, _userEmail: string, ids: string[]) => ids),
}));

vi.mock('../../lib/acl.js', () => ({
  AccessDeniedError: class AccessDeniedError extends Error {},
  assertProjectAccess: vi.fn(async () => undefined),
}));

interface ConversationRow {
  id: string;
  model: string;
  user_id: string;
  project_id: string | null;
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
    user_id: 'user-1',
    project_id: 'project-1',
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
  const projectLookups: string[] = [];

  const supabase = {
    from: (table: string) => {
      if (table === 'conversations') {
        return {
          select: (_columns: string) => {
            const query = {
              eq: (_field: string, _value: string) => query,
              single: async () => ({
                data: conversation,
                error: null,
              }),
              maybeSingle: async () => ({
                data: conversation,
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

      if (table === 'projects') {
        return {
          select: (_columns: string) => ({
            eq: (_field: string, value: string) => {
              projectLookups.push(value);
              return {
                maybeSingle: async () => ({
                  data: {
                    id: value,
                    overview_markdown: value ? `# Overview for ${value}` : null,
                  },
                  error: null,
                }),
              };
            },
          }),
        };
      }

      throw new Error(`Unexpected table: ${table}`);
    },
  };

  return { supabase, inserts, updates, conversation, projectLookups };
}

describe('chatPipelineTask model persistence', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(assertProjectAccess).mockResolvedValue(undefined);
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

  it('strips unauthorized mention IDs before persisting user message', async () => {
    const { supabase, inserts } = createInMemorySupabase();
    vi.mocked(getSupabase).mockReturnValue(supabase as never);
    vi.mocked(filterVisibleTranscriptIdsForUser).mockResolvedValue([]);

    const deps = {
      completions: {
        complete: async function* () {
          yield { type: 'token' as const, content: 'Assistant reply' };
        },
      },
    };

    for await (const _event of chatPipelineTask.execute(
      {
        conversationId: 'conv-1',
        content: 'Use this guessed mention',
        mentionIds: ['private-id'],
        model: 'grok-4',
        userId: 'user-1',
        userEmail: 'member@oxy.so',
      },
      deps as never
    )) {
      // consume
    }

    const userInsert = inserts.find((payload) => payload.role === 'user');
    expect(userInsert?.mentions).toEqual([]);
  });

  it('loads project overview using pipeline input projectId', async () => {
    const { supabase, projectLookups } = createInMemorySupabase();
    vi.mocked(getSupabase).mockReturnValue(supabase as never);

    const deps = {
      completions: {
        complete: async function* () {
          yield { type: 'token' as const, content: 'Assistant reply' };
        },
      },
    };

    const events: Array<Record<string, unknown>> = [];
    for await (const event of chatPipelineTask.execute(
      {
        conversationId: 'conv-1',
        projectId: 'project-1',
        content: 'Use project context',
        mentionIds: [],
        model: 'grok-4',
      },
      deps as never
    )) {
      events.push(event as unknown as Record<string, unknown>);
    }

    expect(projectLookups).toEqual(['project-1']);
    const sourcesEvent = events.find((event) => event.type === 'sources');
    expect(sourcesEvent).toBeDefined();
    expect((sourcesEvent?.sources as Array<{ type: string }>).map((source) => source.type)).toContain('overview');
  });

  it('skips overview lookup when project ACL denies access', async () => {
    const { supabase, projectLookups } = createInMemorySupabase();
    vi.mocked(getSupabase).mockReturnValue(supabase as never);
    vi.mocked(assertProjectAccess).mockRejectedValue(new AccessDeniedError('Forbidden project'));

    const deps = {
      completions: {
        complete: async function* () {
          yield { type: 'token' as const, content: 'Assistant reply' };
        },
      },
    };

    for await (const _event of chatPipelineTask.execute(
      {
        conversationId: 'conv-1',
        projectId: 'project-1',
        content: 'Use project context',
        mentionIds: [],
        model: 'grok-4',
        userId: 'user-1',
      },
      deps as never
    )) {
      // consume
    }

    expect(projectLookups).toEqual([]);
  });
});

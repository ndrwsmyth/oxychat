import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Hono } from 'hono';
import { conversationsRouter } from '../conversations.js';
import { DEFAULT_MODEL } from '../../lib/constants.js';
import { getSupabase } from '../../lib/supabase.js';
import type { AppVariables } from '../../types.js';
import { ensurePersonalWorkspace } from '../../lib/workspace-bootstrap.js';
import { assertProjectAccess } from '../../lib/acl.js';

vi.mock('../../lib/supabase.js', () => ({
  getSupabase: vi.fn(),
}));

vi.mock('../../lib/workspace-bootstrap.js', () => ({
  ensurePersonalWorkspace: vi.fn(async () => ({
    clientId: 'client-1',
    projectId: 'project-1',
  })),
}));

vi.mock('../../lib/acl.js', () => ({
  AccessDeniedError: class AccessDeniedError extends Error {},
  assertProjectAccess: vi.fn(async () => undefined),
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
  app.route('/api', conversationsRouter);
  return app;
}

function createConversationsInsertSupabaseMock(createdModel: string) {
  let insertPayload: Record<string, unknown> | null = null;

  const table = {
    insert: vi.fn((payload: Record<string, unknown>) => {
      insertPayload = payload;
      return table;
    }),
    select: vi.fn(() => table),
    single: vi.fn(async () => ({
      data: {
        id: 'conv-1',
        title: null,
        auto_titled: false,
        model: createdModel,
        pinned: false,
        pinned_at: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      error: null,
    })),
  };

  const supabase = {
    from: vi.fn(() => table),
  };

  return { supabase, getInsertPayload: () => insertPayload };
}

describe('conversations model behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates a conversation with explicit model', async () => {
    const { supabase, getInsertPayload } = createConversationsInsertSupabaseMock('gpt-5.2');
    vi.mocked(getSupabase).mockReturnValue(supabase as never);

    const app = createAuthedApp();
    const response = await app.request('/api/conversations', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ model: 'gpt-5.2' }),
    });

    expect(response.status).toBe(201);
    expect(getInsertPayload()).toMatchObject({
      user_id: mockUser.id,
      model: 'gpt-5.2',
      project_id: 'project-1',
    });
  });

  it('creates a conversation with DEFAULT_MODEL when no model is provided', async () => {
    const { supabase, getInsertPayload } = createConversationsInsertSupabaseMock(DEFAULT_MODEL);
    vi.mocked(getSupabase).mockReturnValue(supabase as never);

    const app = createAuthedApp();
    const response = await app.request('/api/conversations', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    });

    expect(response.status).toBe(201);
    expect(getInsertPayload()).toMatchObject({
      model: DEFAULT_MODEL,
      project_id: 'project-1',
    });
  });

  it('uses explicit project_id when provided', async () => {
    const { supabase, getInsertPayload } = createConversationsInsertSupabaseMock(DEFAULT_MODEL);
    vi.mocked(getSupabase).mockReturnValue(supabase as never);

    const app = createAuthedApp();
    const response = await app.request('/api/conversations', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ project_id: 'project-explicit' }),
    });

    expect(response.status).toBe(201);
    expect(vi.mocked(assertProjectAccess)).toHaveBeenCalledWith(mockUser.id, 'project-explicit');
    expect(vi.mocked(ensurePersonalWorkspace)).not.toHaveBeenCalled();
    expect(getInsertPayload()).toMatchObject({ project_id: 'project-explicit' });
  });

  it('returns 400 for invalid model on create', async () => {
    const app = createAuthedApp();
    const response = await app.request('/api/conversations', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ model: 'not-a-real-model' }),
    });

    expect(response.status).toBe(400);
    expect(vi.mocked(getSupabase)).not.toHaveBeenCalled();
  });

  it('returns 400 for invalid model on patch', async () => {
    const app = createAuthedApp();
    const response = await app.request('/api/conversations/conv-1', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ model: 'not-a-real-model' }),
    });

    expect(response.status).toBe(400);
    expect(vi.mocked(getSupabase)).not.toHaveBeenCalled();
  });
});

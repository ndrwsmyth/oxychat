import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Hono } from 'hono';
import { conversationsRouter } from '../conversations.js';
import { getSupabase } from '../../lib/supabase.js';
import type { AppVariables } from '../../types.js';
import { AccessDeniedError, assertProjectAccess } from '../../lib/acl.js';

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

interface ConversationRow {
  id: string;
  title: string;
  auto_titled: boolean;
  model: string;
  project_id: string;
  pinned: boolean;
  pinned_at: string | null;
  created_at: string;
  updated_at: string;
}

function createConversationsListSupabaseMock(rows: ConversationRow[]) {
  const state: { projectId: string | null } = { projectId: null };

  const query = {
    eq: vi.fn((field: string, value: string) => {
      if (field === 'project_id') {
        state.projectId = value;
      }
      return query;
    }),
    is: vi.fn(() => query),
    order: vi.fn(() => query),
    then: (resolve: (value: { data: ConversationRow[]; error: null }) => void) => {
      const data = state.projectId
        ? rows.filter((row) => row.project_id === state.projectId)
        : rows;
      resolve({ data, error: null });
    },
  };

  return {
    from: vi.fn(() => ({
      select: vi.fn(() => query),
    })),
  };
}

describe('conversations project filter behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('filters list by project and validates ACL access', async () => {
    const nowIso = new Date().toISOString();
    vi.mocked(getSupabase).mockReturnValue(
      createConversationsListSupabaseMock([
        {
          id: 'conv-1',
          title: 'A',
          auto_titled: false,
          model: 'gpt-5.2',
          project_id: 'project-1',
          pinned: false,
          pinned_at: null,
          created_at: nowIso,
          updated_at: nowIso,
        },
        {
          id: 'conv-2',
          title: 'B',
          auto_titled: false,
          model: 'gpt-5.2',
          project_id: 'project-2',
          pinned: false,
          pinned_at: null,
          created_at: nowIso,
          updated_at: nowIso,
        },
      ]) as never
    );

    const app = createAuthedApp();
    const response = await app.request('/api/conversations?project=project-2');

    expect(response.status).toBe(200);
    expect(vi.mocked(assertProjectAccess)).toHaveBeenCalledWith(mockUser.id, 'project-2');
    const body = (await response.json()) as { today: Array<{ id: string; project_id: string }> };
    expect(body.today).toHaveLength(1);
    expect(body.today[0].id).toBe('conv-2');
    expect(body.today[0].project_id).toBe('project-2');
  });

  it('returns 403 when project scope is unauthorized', async () => {
    vi.mocked(assertProjectAccess).mockRejectedValueOnce(new AccessDeniedError('Forbidden project'));
    vi.mocked(getSupabase).mockReturnValue(createConversationsListSupabaseMock([]) as never);

    const app = createAuthedApp();
    const response = await app.request('/api/conversations?project=project-secret');

    expect(response.status).toBe(403);
    const body = (await response.json()) as { error: string };
    expect(body.error).toContain('Forbidden');
  });

  it('returns 400 for blank project query value', async () => {
    vi.mocked(getSupabase).mockReturnValue(createConversationsListSupabaseMock([]) as never);

    const app = createAuthedApp();
    const response = await app.request('/api/conversations?project=%20%20');

    expect(response.status).toBe(400);
    expect(vi.mocked(assertProjectAccess)).not.toHaveBeenCalled();
  });
});

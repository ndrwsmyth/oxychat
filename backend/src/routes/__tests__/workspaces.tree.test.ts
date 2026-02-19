import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Hono } from 'hono';
import { workspacesRouter } from '../workspaces.js';
import type { AppVariables } from '../../types.js';
import { buildWorkspaceTree } from '../../lib/workspaces.js';

vi.mock('../../lib/workspaces.js', () => ({
  buildWorkspaceTree: vi.fn(),
}));

const mockUser = {
  id: 'user-1',
  clerkId: 'clerk-1',
  email: 'user@oxy.so',
  fullName: 'User',
  avatarUrl: null,
  context: null,
};

function createAuthedApp() {
  const app = new Hono<{ Variables: AppVariables }>();
  app.use('*', async (c, next) => {
    c.set('user', mockUser);
    await next();
  });
  app.route('/api', workspacesRouter);
  return app;
}

describe('/api/workspaces/tree', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns workspace tree payload', async () => {
    vi.mocked(buildWorkspaceTree).mockResolvedValue([
      {
        id: 'client-1',
        name: 'Acme',
        scope: 'client',
        projects: [
          {
            id: 'project-1',
            client_id: 'client-1',
            name: 'Acme Core',
            scope: 'client',
            conversation_count: 3,
          },
        ],
      },
    ]);

    const app = createAuthedApp();
    const response = await app.request('/api/workspaces/tree');

    expect(response.status).toBe(200);
    const body = (await response.json()) as { clients: Array<{ projects: Array<{ conversation_count: number }> }> };
    expect(body.clients).toHaveLength(1);
    expect(body.clients[0].projects[0].conversation_count).toBe(3);
  });
});

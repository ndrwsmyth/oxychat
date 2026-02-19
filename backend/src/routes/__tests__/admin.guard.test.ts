import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Hono } from 'hono';
import { adminAuthMiddleware } from '../../middleware/admin-auth.js';
import { adminClientsRouter } from '../admin-clients.js';
import { isAdmin } from '../../lib/acl.js';
import { getSupabase } from '../../lib/supabase.js';
import type { AppVariables } from '../../types.js';

vi.mock('../../lib/acl.js', () => ({
  isAdmin: vi.fn(),
}));

vi.mock('../../lib/supabase.js', () => ({
  getSupabase: vi.fn(),
}));

const mockUser = {
  id: 'user-1',
  clerkId: 'clerk-1',
  email: 'user@oxy.so',
  fullName: 'User',
  avatarUrl: null,
  context: null,
};

function createApp() {
  const app = new Hono<{ Variables: AppVariables }>();
  app.use('/api/admin/*', async (c, next) => {
    c.set('user', mockUser);
    await next();
  });
  app.use('/api/admin/*', adminAuthMiddleware);
  app.route('/api', adminClientsRouter);
  return app;
}

describe('admin guard middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 403 when caller is not admin', async () => {
    vi.mocked(isAdmin).mockResolvedValue(false);

    const app = createApp();
    const response = await app.request('/api/admin/clients');

    expect(response.status).toBe(403);
    expect(vi.mocked(getSupabase)).not.toHaveBeenCalled();
  });

  it('allows admin caller to reach endpoint', async () => {
    vi.mocked(isAdmin).mockResolvedValue(true);

    const table = {
      select: vi.fn(() => table),
      order: vi.fn(async () => ({ data: [], error: null })),
    };

    vi.mocked(getSupabase).mockReturnValue({
      from: vi.fn(() => table),
    } as never);

    const app = createApp();
    const response = await app.request('/api/admin/clients');

    expect(response.status).toBe(200);
    expect(vi.mocked(getSupabase)).toHaveBeenCalled();
  });
});

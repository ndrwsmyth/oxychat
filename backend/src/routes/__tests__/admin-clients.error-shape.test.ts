import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Hono } from 'hono';
import { adminClientsRouter } from '../admin-clients.js';
import type { AppVariables } from '../../types.js';
import { getSupabase } from '../../lib/supabase.js';

vi.mock('../../lib/supabase.js', () => ({
  getSupabase: vi.fn(),
}));

const mockUser = {
  id: 'admin-1',
  clerkId: 'clerk-1',
  email: 'admin@oxy.so',
  fullName: 'Admin',
  avatarUrl: null,
  context: null,
};

function createAuthedApp() {
  const app = new Hono<{ Variables: AppVariables }>();
  app.use('*', async (c, next) => {
    c.set('user', mockUser);
    await next();
  });
  app.route('/api', adminClientsRouter);
  return app;
}

describe('admin clients typed error contract', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns typed 400 envelope for missing name', async () => {
    const app = createAuthedApp();
    const response = await app.request('/api/admin/clients', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    });

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body).toEqual({
      error: {
        code: 'admin_bad_request',
        message: 'name is required',
      },
    });
    expect(vi.mocked(getSupabase)).not.toHaveBeenCalled();
  });
});

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Hono } from 'hono';
import { adminAuthMiddleware } from '../admin-auth.js';
import type { AppVariables } from '../../types.js';
import { isAdmin } from '../../lib/acl.js';

vi.mock('../../lib/acl.js', () => ({
  isAdmin: vi.fn(),
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
  app.use('*', async (c, next) => {
    c.set('user', mockUser);
    await next();
  });
  app.use('*', adminAuthMiddleware);
  app.get('/protected', (c) => c.json({ ok: true }));
  return app;
}

describe('adminAuthMiddleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 403 for non-admin users', async () => {
    vi.mocked(isAdmin).mockResolvedValue(false);
    const app = createApp();

    const response = await app.request('/protected');
    expect(response.status).toBe(403);
  });

  it('allows admin users', async () => {
    vi.mocked(isAdmin).mockResolvedValue(true);
    const app = createApp();

    const response = await app.request('/protected');
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({ ok: true });
  });
});

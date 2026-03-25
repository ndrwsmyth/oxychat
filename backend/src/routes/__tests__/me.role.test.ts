import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Hono } from 'hono';
import type { Context, Next } from 'hono';
import { meRouter } from '../me.js';
import type { AppVariables } from '../../types.js';
import { getUserRole } from '../../lib/acl.js';

vi.mock('../../lib/acl.js', () => ({
  getUserRole: vi.fn(),
}));

const mockUser = {
  id: 'user-1',
  clerkId: 'clerk-1',
  email: 'admin@oxy.so',
  fullName: 'Admin User',
  avatarUrl: 'https://example.com/avatar.png',
  context: null,
};

function createApp() {
  const authMiddleware = vi.fn(async (c: Context<{ Variables: AppVariables }>, next: Next) => {
    const authHeader = c.req.header('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return c.json({ error: 'Missing authorization token' }, 401);
    }

    c.set('user', mockUser);
    await next();
  });

  const app = new Hono<{ Variables: AppVariables }>();
  app.use('/api/me', authMiddleware);
  app.route('/api', meRouter);
  app.get('/api/me-shadow', (c) => c.json({ ok: true }));

  return { app, authMiddleware };
}

describe('GET /api/me', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when unauthenticated', async () => {
    const { app, authMiddleware } = createApp();
    const response = await app.request('/api/me');

    expect(response.status).toBe(401);
    expect(authMiddleware).toHaveBeenCalledTimes(1);
    expect(vi.mocked(getUserRole)).not.toHaveBeenCalled();
  });

  it('returns user + role contract for authenticated caller', async () => {
    vi.mocked(getUserRole).mockResolvedValue('admin');
    const { app } = createApp();

    const response = await app.request('/api/me', {
      headers: { Authorization: 'Bearer test-token' },
    });

    expect(response.status).toBe(200);
    expect(vi.mocked(getUserRole)).toHaveBeenCalledWith('user-1');
    const body = await response.json();
    expect(body).toEqual({
      user: {
        id: 'user-1',
        email: 'admin@oxy.so',
        full_name: 'Admin User',
        avatar_url: 'https://example.com/avatar.png',
      },
      role: 'admin',
    });
  });

  it('registers auth middleware on exact /api/me path', async () => {
    const { app, authMiddleware } = createApp();

    const shadowResponse = await app.request('/api/me-shadow');
    expect(shadowResponse.status).toBe(200);
    expect(authMiddleware).not.toHaveBeenCalled();
  });
});

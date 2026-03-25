import { Hono } from 'hono';
import { getUserRole } from '../lib/acl.js';
import type { AppVariables } from '../types.js';

export const meRouter = new Hono<{ Variables: AppVariables }>();

meRouter.get('/me', async (c) => {
  const user = c.get('user');
  const role = await getUserRole(user.id);

  return c.json({
    user: {
      id: user.id,
      email: user.email,
      full_name: user.fullName,
      avatar_url: user.avatarUrl,
    },
    role,
  });
});

import type { Context, Next } from 'hono';
import { isAdmin } from '../lib/acl.js';
import type { AppVariables } from '../types.js';

export async function adminAuthMiddleware(c: Context<{ Variables: AppVariables }>, next: Next) {
  const user = c.get('user');
  const admin = await isAdmin(user.id);

  if (!admin) {
    return c.json({ error: 'Admin access required' }, 403);
  }

  await next();
}

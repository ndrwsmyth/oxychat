import type { Context, Next } from 'hono';
import { isAdmin } from '../lib/acl.js';
import type { AppVariables } from '../types.js';
import { adminForbidden } from '../lib/admin-error.js';

export async function adminAuthMiddleware(c: Context<{ Variables: AppVariables }>, next: Next) {
  const user = c.get('user');
  const admin = await isAdmin(user.id);

  if (!admin) {
    return adminForbidden(c, 'Admin access required', { path: c.req.path });
  }

  await next();
}

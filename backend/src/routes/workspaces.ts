import { Hono } from 'hono';
import { buildWorkspaceTree } from '../lib/workspaces.js';
import type { AppVariables } from '../types.js';

export const workspacesRouter = new Hono<{ Variables: AppVariables }>();

workspacesRouter.get('/workspaces/tree', async (c) => {
  const user = c.get('user');

  try {
    const tree = await buildWorkspaceTree(user.id);
    return c.json({ clients: tree });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to build workspace tree';
    return c.json({ error: message }, 500);
  }
});

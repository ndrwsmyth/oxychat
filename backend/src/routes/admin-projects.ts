import { Hono } from 'hono';
import { getSupabase } from '../lib/supabase.js';
import { writeAuditEvent } from '../lib/audit.js';
import type { AppVariables } from '../types.js';

export const adminProjectsRouter = new Hono<{ Variables: AppVariables }>();

adminProjectsRouter.get('/admin/projects', async (c) => {
  const clientId = c.req.query('client_id');
  const supabase = getSupabase();

  let query = supabase
    .from('projects')
    .select('id, client_id, name, scope, owner_user_id, is_inbox, created_at, updated_at')
    .order('name', { ascending: true });

  if (clientId) {
    query = query.eq('client_id', clientId);
  }

  const { data, error } = await query;

  if (error) {
    return c.json({ error: error.message }, 500);
  }

  return c.json(data ?? []);
});

adminProjectsRouter.post('/admin/projects', async (c) => {
  const body = await c.req.json().catch(() => ({}));

  const clientId = typeof body.client_id === 'string' ? body.client_id : '';
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const scope = body.scope === 'personal' || body.scope === 'global' ? body.scope : 'client';
  const ownerUserId = typeof body.owner_user_id === 'string' ? body.owner_user_id : null;
  const isInbox = typeof body.is_inbox === 'boolean' ? body.is_inbox : false;

  if (!clientId || !name) {
    return c.json({ error: 'client_id and name are required' }, 400);
  }

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('projects')
    .insert({
      client_id: clientId,
      name,
      scope,
      owner_user_id: ownerUserId,
      is_inbox: isInbox,
    })
    .select('id, client_id, name, scope, owner_user_id, is_inbox, created_at, updated_at')
    .single();

  if (error || !data) {
    return c.json({ error: error?.message ?? 'Failed to create project' }, 500);
  }

  await writeAuditEvent({
    actorUserId: c.get('user').id,
    eventType: 'project.created',
    entityType: 'project',
    entityId: data.id,
    payload: { client_id: data.client_id },
  });

  return c.json(data, 201);
});

adminProjectsRouter.patch('/admin/projects/:id', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json().catch(() => ({}));

  const updates: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (typeof body.name === 'string') {
    const name = body.name.trim();
    if (!name) {
      return c.json({ error: 'name cannot be empty' }, 400);
    }
    updates.name = name;
  }

  if (typeof body.client_id === 'string') {
    updates.client_id = body.client_id;
  }

  if (typeof body.scope === 'string' && ['personal', 'client', 'global'].includes(body.scope)) {
    updates.scope = body.scope;
  }

  if ('owner_user_id' in body) {
    updates.owner_user_id = typeof body.owner_user_id === 'string' ? body.owner_user_id : null;
  }

  if (typeof body.is_inbox === 'boolean') {
    updates.is_inbox = body.is_inbox;
  }

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('projects')
    .update(updates)
    .eq('id', id)
    .select('id, client_id, name, scope, owner_user_id, is_inbox, created_at, updated_at')
    .single();

  if (error || !data) {
    return c.json({ error: error?.message ?? 'Failed to update project' }, 500);
  }

  await writeAuditEvent({
    actorUserId: c.get('user').id,
    eventType: 'project.updated',
    entityType: 'project',
    entityId: data.id,
  });

  return c.json(data);
});

adminProjectsRouter.delete('/admin/projects/:id', async (c) => {
  const id = c.req.param('id');
  const supabase = getSupabase();

  const { error } = await supabase
    .from('projects')
    .delete()
    .eq('id', id);

  if (error) {
    return c.json({ error: error.message }, 500);
  }

  await writeAuditEvent({
    actorUserId: c.get('user').id,
    eventType: 'project.deleted',
    entityType: 'project',
    entityId: id,
  });

  return c.json({ ok: true });
});

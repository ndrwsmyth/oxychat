import { Hono } from 'hono';
import { getSupabase } from '../lib/supabase.js';
import { writeAuditEvent } from '../lib/audit.js';
import type { AppVariables } from '../types.js';

export const adminClientsRouter = new Hono<{ Variables: AppVariables }>();

adminClientsRouter.get('/admin/clients', async (c) => {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('clients')
    .select('id, name, scope, owner_user_id, created_at, updated_at')
    .order('name', { ascending: true });

  if (error) {
    return c.json({ error: error.message }, 500);
  }

  return c.json(data ?? []);
});

adminClientsRouter.post('/admin/clients', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const scope = body.scope === 'personal' || body.scope === 'global' ? body.scope : 'client';
  const ownerUserId = typeof body.owner_user_id === 'string' ? body.owner_user_id : null;

  if (!name) {
    return c.json({ error: 'name is required' }, 400);
  }

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('clients')
    .insert({
      name,
      scope,
      owner_user_id: ownerUserId,
    })
    .select('id, name, scope, owner_user_id, created_at, updated_at')
    .single();

  if (error || !data) {
    return c.json({ error: error?.message ?? 'Failed to create client' }, 500);
  }

  await writeAuditEvent({
    actorUserId: c.get('user').id,
    eventType: 'client.created',
    entityType: 'client',
    entityId: data.id,
    payload: { scope: data.scope },
  });

  return c.json(data, 201);
});

adminClientsRouter.patch('/admin/clients/:id', async (c) => {
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

  if (typeof body.scope === 'string' && ['personal', 'client', 'global'].includes(body.scope)) {
    updates.scope = body.scope;
  }

  if ('owner_user_id' in body) {
    updates.owner_user_id = typeof body.owner_user_id === 'string' ? body.owner_user_id : null;
  }

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('clients')
    .update(updates)
    .eq('id', id)
    .select('id, name, scope, owner_user_id, created_at, updated_at')
    .single();

  if (error || !data) {
    return c.json({ error: error?.message ?? 'Failed to update client' }, 500);
  }

  await writeAuditEvent({
    actorUserId: c.get('user').id,
    eventType: 'client.updated',
    entityType: 'client',
    entityId: data.id,
  });

  return c.json(data);
});

adminClientsRouter.delete('/admin/clients/:id', async (c) => {
  const id = c.req.param('id');
  const supabase = getSupabase();

  const { error } = await supabase
    .from('clients')
    .delete()
    .eq('id', id);

  if (error) {
    return c.json({ error: error.message }, 500);
  }

  await writeAuditEvent({
    actorUserId: c.get('user').id,
    eventType: 'client.deleted',
    entityType: 'client',
    entityId: id,
  });

  return c.json({ ok: true });
});

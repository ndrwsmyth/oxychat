import { Hono } from 'hono';
import { getSupabase } from '../lib/supabase.js';
import { writeAuditEvent } from '../lib/audit.js';
import type { AppVariables } from '../types.js';
import { adminBadRequest, adminInternalError } from '../lib/admin-error.js';

export const adminRoutingRouter = new Hono<{ Variables: AppVariables }>();

adminRoutingRouter.post('/admin/projects/:projectId/aliases', async (c) => {
  const projectId = c.req.param('projectId');
  const body = await c.req.json().catch(() => ({}));
  const alias = typeof body.alias === 'string' ? body.alias.trim() : '';

  if (!alias) {
    return adminBadRequest(c, 'alias is required');
  }

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('project_aliases')
    .insert({ project_id: projectId, alias })
    .select('id, project_id, alias, normalized_alias, created_at')
    .single();

  if (error || !data) {
    return adminInternalError(c, error?.message ?? 'Failed to create alias');
  }

  await writeAuditEvent({
    actorUserId: c.get('user').id,
    eventType: 'project.alias.created',
    entityType: 'project_alias',
    entityId: data.id,
    payload: { project_id: projectId },
  });

  return c.json(data, 201);
});

adminRoutingRouter.delete('/admin/project-aliases/:id', async (c) => {
  const id = c.req.param('id');
  const supabase = getSupabase();

  const { error } = await supabase
    .from('project_aliases')
    .delete()
    .eq('id', id);

  if (error) {
    return adminInternalError(c, error.message);
  }

  await writeAuditEvent({
    actorUserId: c.get('user').id,
    eventType: 'project.alias.deleted',
    entityType: 'project_alias',
    entityId: id,
  });

  return c.json({ ok: true });
});

adminRoutingRouter.post('/admin/projects/:projectId/domains', async (c) => {
  const projectId = c.req.param('projectId');
  const body = await c.req.json().catch(() => ({}));
  const domain = typeof body.domain === 'string' ? body.domain.trim() : '';

  if (!domain) {
    return adminBadRequest(c, 'domain is required');
  }

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('project_domains')
    .insert({ project_id: projectId, domain })
    .select('id, project_id, domain, normalized_domain, created_at')
    .single();

  if (error || !data) {
    return adminInternalError(c, error?.message ?? 'Failed to create domain');
  }

  await writeAuditEvent({
    actorUserId: c.get('user').id,
    eventType: 'project.domain.created',
    entityType: 'project_domain',
    entityId: data.id,
    payload: { project_id: projectId },
  });

  return c.json(data, 201);
});

adminRoutingRouter.delete('/admin/project-domains/:id', async (c) => {
  const id = c.req.param('id');
  const supabase = getSupabase();

  const { error } = await supabase
    .from('project_domains')
    .delete()
    .eq('id', id);

  if (error) {
    return adminInternalError(c, error.message);
  }

  await writeAuditEvent({
    actorUserId: c.get('user').id,
    eventType: 'project.domain.deleted',
    entityType: 'project_domain',
    entityId: id,
  });

  return c.json({ ok: true });
});

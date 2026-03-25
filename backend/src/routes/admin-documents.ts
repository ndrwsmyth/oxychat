import { createHash } from 'node:crypto';
import { Hono } from 'hono';
import { getSupabase } from '../lib/supabase.js';
import { writeAuditEvent } from '../lib/audit.js';
import type { AppVariables } from '../types.js';
import { adminBadRequest, adminConflict, adminNotFound, adminInternalError } from '../lib/admin-error.js';
import { isUuid } from '../lib/validation.js';

const MAX_DOCUMENT_SIZE_BYTES = 19 * 1024 * 1024; // 19 MB

const DOCUMENT_LIST_COLUMNS =
  'id, project_id, title, content_hash, visibility_scope, size_bytes, uploaded_by, created_at, updated_at';
const DOCUMENT_DETAIL_COLUMNS =
  'id, project_id, title, content, content_hash, visibility_scope, size_bytes, uploaded_by, created_at, updated_at';

function sha256(content: string): string {
  return createHash('sha256').update(content, 'utf8').digest('hex');
}

export const adminDocumentsRouter = new Hono<{ Variables: AppVariables }>();

// GET /admin/documents — list documents with optional project_id filter
adminDocumentsRouter.get('/admin/documents', async (c) => {
  const projectId = c.req.query('project_id');
  const supabase = getSupabase();

  let query = supabase
    .from('documents')
    .select(DOCUMENT_LIST_COLUMNS)
    .order('created_at', { ascending: false });

  if (projectId) {
    query = query.eq('project_id', projectId);
  }

  const { data, error } = await query;
  if (error) return adminInternalError(c, error.message);
  return c.json(data ?? []);
});

// GET /admin/documents/:id — single document with content
adminDocumentsRouter.get('/admin/documents/:id', async (c) => {
  const id = c.req.param('id');
  if (!isUuid(id)) return adminBadRequest(c, 'Invalid document ID');

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('documents')
    .select(DOCUMENT_DETAIL_COLUMNS)
    .eq('id', id)
    .maybeSingle();

  if (error) return adminInternalError(c, error.message);
  if (!data) return adminNotFound(c, 'Document not found');
  return c.json(data);
});

// POST /admin/documents — upload a markdown document
adminDocumentsRouter.post('/admin/documents', async (c) => {
  const body = await c.req.json().catch(() => ({}));

  const title = typeof body.title === 'string' ? body.title.trim() : '';
  const content = typeof body.content === 'string' ? body.content : '';
  const projectId = typeof body.project_id === 'string' ? body.project_id.trim() : '';
  const visibilityScope =
    typeof body.visibility_scope === 'string' &&
    ['project', 'client', 'global'].includes(body.visibility_scope)
      ? body.visibility_scope
      : 'project';

  if (!title) return adminBadRequest(c, 'title is required');
  if (!content) return adminBadRequest(c, 'content is required');
  if (!projectId) return adminBadRequest(c, 'project_id is required');

  const sizeBytes = Buffer.byteLength(content, 'utf8');
  if (sizeBytes > MAX_DOCUMENT_SIZE_BYTES) {
    return adminBadRequest(c, `Content exceeds maximum size of 19 MB (got ${sizeBytes} bytes)`);
  }

  const contentHash = sha256(content);
  const supabase = getSupabase();

  const { data, error } = await supabase
    .from('documents')
    .insert({
      project_id: projectId,
      title,
      content,
      content_hash: contentHash,
      visibility_scope: visibilityScope,
      size_bytes: sizeBytes,
      uploaded_by: c.get('user').id,
    })
    .select(DOCUMENT_LIST_COLUMNS)
    .single();

  if (error) {
    if (error.code === '23505' && error.message?.includes('content_hash')) {
      return adminConflict(c, 'A document with identical content already exists in this project', {
        content_hash: contentHash,
      });
    }
    if (error.code === '23505' && error.message?.includes('title')) {
      return adminConflict(c, 'A document with this title already exists in this project');
    }
    return adminInternalError(c, error.message);
  }

  if (!data) return adminInternalError(c, 'Failed to create document');

  await writeAuditEvent({
    actorUserId: c.get('user').id,
    eventType: 'document.created',
    entityType: 'document',
    entityId: data.id,
    payload: { project_id: projectId, visibility_scope: visibilityScope, content_hash: contentHash },
  });

  return c.json(data, 201);
});

// PATCH /admin/documents/:id — update document
adminDocumentsRouter.patch('/admin/documents/:id', async (c) => {
  const id = c.req.param('id');
  if (!isUuid(id)) return adminBadRequest(c, 'Invalid document ID');

  const body = await c.req.json().catch(() => ({}));
  const updates: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (typeof body.title === 'string') {
    const title = body.title.trim();
    if (!title) return adminBadRequest(c, 'title cannot be empty');
    updates.title = title;
  }

  if (typeof body.content === 'string') {
    const sizeBytes = Buffer.byteLength(body.content, 'utf8');
    if (sizeBytes > MAX_DOCUMENT_SIZE_BYTES) {
      return adminBadRequest(c, `Content exceeds maximum size of 19 MB (got ${sizeBytes} bytes)`);
    }
    updates.content = body.content;
    updates.content_hash = sha256(body.content);
    updates.size_bytes = sizeBytes;
  }

  if (
    typeof body.visibility_scope === 'string' &&
    ['project', 'client', 'global'].includes(body.visibility_scope)
  ) {
    updates.visibility_scope = body.visibility_scope;
  }

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('documents')
    .update(updates)
    .eq('id', id)
    .select(DOCUMENT_LIST_COLUMNS)
    .single();

  if (error || !data) {
    return adminInternalError(c, error?.message ?? 'Failed to update document');
  }

  await writeAuditEvent({
    actorUserId: c.get('user').id,
    eventType: 'document.updated',
    entityType: 'document',
    entityId: id,
  });

  return c.json(data);
});

// DELETE /admin/documents/:id — delete document
adminDocumentsRouter.delete('/admin/documents/:id', async (c) => {
  const id = c.req.param('id');
  if (!isUuid(id)) return adminBadRequest(c, 'Invalid document ID');

  const supabase = getSupabase();

  const { data: existing, error: fetchError } = await supabase
    .from('documents')
    .select('id, project_id, title, visibility_scope, content_hash')
    .eq('id', id)
    .maybeSingle();

  if (fetchError) return adminInternalError(c, fetchError.message);
  if (!existing) return adminNotFound(c, 'Document not found');

  const { error } = await supabase.from('documents').delete().eq('id', id);
  if (error) return adminInternalError(c, error.message);

  await writeAuditEvent({
    actorUserId: c.get('user').id,
    eventType: 'document.deleted',
    entityType: 'document',
    entityId: id,
    payload: {
      title: existing.title,
      visibility_scope: existing.visibility_scope,
      project_id: existing.project_id,
      content_hash: existing.content_hash,
    },
  });

  return c.json({ ok: true });
});

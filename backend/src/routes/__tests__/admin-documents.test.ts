/* eslint-disable @typescript-eslint/no-explicit-any */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Hono } from 'hono';
import { adminDocumentsRouter } from '../admin-documents.js';
import type { AppVariables } from '../../types.js';
import { getSupabase } from '../../lib/supabase.js';
import { writeAuditEvent } from '../../lib/audit.js';

vi.mock('../../lib/supabase.js', () => ({
  getSupabase: vi.fn(),
}));

vi.mock('../../lib/audit.js', () => ({
  writeAuditEvent: vi.fn(async () => undefined),
}));

const mockUser = {
  id: 'admin-1',
  clerkId: 'clerk-1',
  email: 'admin@oxy.so',
  fullName: 'Admin',
  avatarUrl: null,
  context: null,
};

function createAuthedApp() {
  const app = new Hono<{ Variables: AppVariables }>();
  app.use('*', async (c, next) => {
    c.set('user', mockUser);
    await next();
  });
  app.route('/api', adminDocumentsRouter);
  return app;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function post(app: any, body: Record<string, unknown>) {
  return app.request('/api/admin/documents', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('admin documents CRUD', () => {
  beforeEach(() => vi.clearAllMocks());

  // --- Validation ---

  it('rejects upload without title', async () => {
    const app = createAuthedApp();
    const res = await post(app, { content: '# Hello', project_id: 'p1' });
    expect(res.status).toBe(400);
    const body = await res.json() as any;
    expect(body.error.code).toBe('admin_bad_request');
    expect(body.error.message).toContain('title');
  });

  it('rejects upload without content', async () => {
    const app = createAuthedApp();
    const res = await post(app, { title: 'Test', content: '', project_id: 'p1' });
    expect(res.status).toBe(400);
    const body = await res.json() as any;
    expect(body.error.message).toContain('content');
  });

  it('rejects upload without project_id', async () => {
    const app = createAuthedApp();
    const res = await post(app, { title: 'Test', content: '# Hello' });
    expect(res.status).toBe(400);
    const body = await res.json() as any;
    expect(body.error.message).toContain('project_id');
  });

  it('rejects oversized content', async () => {
    const app = createAuthedApp();
    const res = await post(app, {
      title: 'Test',
      content: 'x'.repeat(20 * 1024 * 1024),
      project_id: 'p1',
    });
    expect(res.status).toBe(400);
    const body = await res.json() as any;
    expect(body.error.message).toContain('19 MB');
  });

  // --- Dedupe ---

  it('returns 409 on content-hash duplicate', async () => {
    vi.mocked(getSupabase).mockReturnValue({
      from: vi.fn(() => ({
        insert: () => ({
          select: () => ({
            single: async () => ({
              data: null,
              error: {
                code: '23505',
                message: 'duplicate key value violates unique constraint "idx_documents_project_content_hash"',
              },
            }),
          }),
        }),
      })),
    } as never);

    const app = createAuthedApp();
    const res = await post(app, { title: 'Test', content: '# Hello', project_id: 'p1' });
    expect(res.status).toBe(409);
    const body = await res.json() as any;
    expect(body.error.code).toBe('admin_conflict');
    expect(body.error.details?.content_hash).toBeDefined();
  });

  it('returns 409 on title duplicate', async () => {
    vi.mocked(getSupabase).mockReturnValue({
      from: vi.fn(() => ({
        insert: () => ({
          select: () => ({
            single: async () => ({
              data: null,
              error: {
                code: '23505',
                message: 'duplicate key value violates unique constraint "idx_documents_project_title"',
              },
            }),
          }),
        }),
      })),
    } as never);

    const app = createAuthedApp();
    const res = await post(app, { title: 'Test', content: '# Different', project_id: 'p1' });
    expect(res.status).toBe(409);
    const body = await res.json() as any;
    expect(body.error.code).toBe('admin_conflict');
  });

  // --- Create ---

  it('creates document and writes audit event', async () => {
    const mockDoc = {
      id: 'doc-1',
      project_id: 'p1',
      title: 'Test',
      content_hash: 'abc',
      visibility_scope: 'project',
      size_bytes: 7,
      uploaded_by: 'admin-1',
      created_at: '2026-03-25T00:00:00Z',
      updated_at: '2026-03-25T00:00:00Z',
    };

    vi.mocked(getSupabase).mockReturnValue({
      from: vi.fn(() => ({
        insert: () => ({
          select: () => ({
            single: async () => ({ data: mockDoc, error: null }),
          }),
        }),
      })),
    } as never);

    const app = createAuthedApp();
    const res = await post(app, { title: 'Test', content: '# Hello', project_id: 'p1' });
    expect(res.status).toBe(201);
    const body = await res.json() as any;
    expect(body.id).toBe('doc-1');
    expect(vi.mocked(writeAuditEvent)).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'document.created',
        entityType: 'document',
        entityId: 'doc-1',
      })
    );
  });

  // --- List ---

  it('lists documents with project_id filter', async () => {
    const terminal = {
      eq: vi.fn(async () => ({
        data: [{ id: 'doc-1', title: 'Test' }],
        error: null,
      })),
    };

    const query = {
      order: vi.fn(() => terminal),
    };

    vi.mocked(getSupabase).mockReturnValue({
      from: vi.fn(() => ({
        select: vi.fn(() => query),
      })),
    } as never);

    const app = createAuthedApp();
    const res = await app.request('/api/admin/documents?project_id=p1');
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body).toHaveLength(1);
    expect(terminal.eq).toHaveBeenCalledWith('project_id', 'p1');
  });

  // --- Get single ---

  it('returns 404 for non-existent document', async () => {
    vi.mocked(getSupabase).mockReturnValue({
      from: vi.fn(() => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: null, error: null }),
          }),
        }),
      })),
    } as never);

    const app = createAuthedApp();
    const res = await app.request('/api/admin/documents/00000000-0000-1000-8000-000000000000');
    expect(res.status).toBe(404);
    const body = await res.json() as any;
    expect(body.error.code).toBe('admin_not_found');
  });

  it('rejects invalid UUID on get', async () => {
    const app = createAuthedApp();
    const res = await app.request('/api/admin/documents/not-a-uuid');
    expect(res.status).toBe(400);
  });

  // --- Delete ---

  it('deletes document and writes audit event', async () => {
    const existing = {
      id: 'doc-1',
      project_id: 'p1',
      title: 'Test',
      visibility_scope: 'project',
      content_hash: 'abc',
    };

    let deleteCalled = false;
    vi.mocked(getSupabase).mockReturnValue({
      from: vi.fn(() => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: existing, error: null }),
          }),
        }),
        delete: () => ({
          eq: async () => {
            deleteCalled = true;
            return { error: null };
          },
        }),
      })),
    } as never);

    const app = createAuthedApp();
    const res = await app.request('/api/admin/documents/00000000-0000-1000-8000-000000000000', {
      method: 'DELETE',
    });
    expect(res.status).toBe(200);
    expect(deleteCalled).toBe(true);
    expect(vi.mocked(writeAuditEvent)).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'document.deleted',
        entityType: 'document',
        payload: expect.objectContaining({ title: 'Test' }),
      })
    );
  });

  it('returns 404 when deleting non-existent document', async () => {
    vi.mocked(getSupabase).mockReturnValue({
      from: vi.fn(() => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: null, error: null }),
          }),
        }),
      })),
    } as never);

    const app = createAuthedApp();
    const res = await app.request('/api/admin/documents/00000000-0000-1000-8000-000000000000', {
      method: 'DELETE',
    });
    expect(res.status).toBe(404);
  });
});

/* eslint-disable @typescript-eslint/no-explicit-any */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Hono } from 'hono';
import { documentsRouter } from '../documents.js';
import type { AppVariables } from '../../types.js';
import { assertProjectAccess, assertConversationOwnership, AccessDeniedError } from '../../lib/acl.js';
import { searchAccessibleDocumentsForProject, searchDocumentsGlobal } from '../../lib/document-access.js';
import { getSupabase } from '../../lib/supabase.js';

vi.mock('../../lib/supabase.js', () => ({
  getSupabase: vi.fn(),
}));

vi.mock('../../lib/acl.js', () => ({
  assertProjectAccess: vi.fn(),
  assertConversationOwnership: vi.fn(),
  AccessDeniedError: class extends Error {
    name = 'AccessDeniedError';
  },
}));

vi.mock('../../lib/document-access.js', () => ({
  searchAccessibleDocumentsForProject: vi.fn(async () => []),
  searchDocumentsGlobal: vi.fn(async () => []),
}));

const mockUser = {
  id: 'user-1',
  clerkId: 'clerk-1',
  email: 'user@oxy.so',
  fullName: 'User',
  avatarUrl: null,
  context: null,
};

function createAuthedApp() {
  const app = new Hono<{ Variables: AppVariables }>();
  app.use('*', async (c, next) => {
    c.set('user', mockUser);
    await next();
  });
  app.route('/api', documentsRouter);
  return app;
}

function postQuery(app: any, body: Record<string, unknown>) {
  return app.request('/api/documents/mentions/query', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /documents/mentions/query', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 400 without query', async () => {
    const app = createAuthedApp();
    const res = await postQuery(app, {});
    expect(res.status).toBe(400);
  });

  it('returns global_only when no project context', async () => {
    vi.mocked(searchDocumentsGlobal).mockResolvedValue([
      { id: 'doc-1', title: 'Global Doc', visibility_scope: 'global', project_id: 'p1', size_bytes: 100, created_at: '2026-01-01' },
    ]);

    const app = createAuthedApp();
    const res = await postQuery(app, { query: 'test' });
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.mode).toBe('global_only');
    expect(body.project).toEqual([]);
    expect(body.global).toHaveLength(1);
    expect(body.took_ms).toBeDefined();
  });

  it('returns project+global buckets when project_id provided', async () => {
    vi.mocked(assertProjectAccess).mockResolvedValue(undefined);
    // Mock project scope lookup
    vi.mocked(getSupabase).mockReturnValue({
      from: vi.fn(() => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: { scope: 'client' }, error: null }),
          }),
        }),
      })),
    } as never);

    vi.mocked(searchAccessibleDocumentsForProject).mockResolvedValue([
      { id: 'doc-1', title: 'Project Doc', visibility_scope: 'project', project_id: 'p1', size_bytes: 50, created_at: '2026-01-01' },
      { id: 'doc-2', title: 'Global Doc', visibility_scope: 'global', project_id: 'p2', size_bytes: 100, created_at: '2026-01-01' },
    ]);

    const app = createAuthedApp();
    const res = await postQuery(app, { query: 'test', project_id: 'p1' });
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.mode).toBe('project_global');
    expect(body.project).toHaveLength(1);
    expect(body.project[0].visibility_scope).toBe('project');
    expect(body.global).toHaveLength(1);
    expect(body.global[0].visibility_scope).toBe('global');
  });

  it('returns 403 when user lacks project access', async () => {
    vi.mocked(assertProjectAccess).mockRejectedValue(new AccessDeniedError('Forbidden project'));

    const app = createAuthedApp();
    const res = await postQuery(app, { query: 'test', project_id: 'p1' });
    expect(res.status).toBe(403);
  });

  it('client-scoped docs go into project bucket', async () => {
    vi.mocked(assertProjectAccess).mockResolvedValue(undefined);
    vi.mocked(getSupabase).mockReturnValue({
      from: vi.fn(() => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: { scope: 'client' }, error: null }),
          }),
        }),
      })),
    } as never);

    vi.mocked(searchAccessibleDocumentsForProject).mockResolvedValue([
      { id: 'doc-1', title: 'Client Doc', visibility_scope: 'client', project_id: 'p2', size_bytes: 50, created_at: '2026-01-01' },
    ]);

    const app = createAuthedApp();
    const res = await postQuery(app, { query: 'test', project_id: 'p1' });
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.project).toHaveLength(1);
    expect(body.project[0].visibility_scope).toBe('client');
    expect(body.global).toHaveLength(0);
  });
});

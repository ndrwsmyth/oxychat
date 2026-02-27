import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Hono } from 'hono';
import { adminProjectsRouter } from '../admin-projects.js';
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
  app.route('/api', adminProjectsRouter);
  return app;
}

describe('admin projects overview_markdown support', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns overview_markdown in project list payload', async () => {
    const query = {
      order: vi.fn(async () => ({
        data: [
          {
            id: 'project-1',
            client_id: 'client-1',
            name: 'Acme',
            scope: 'client',
            owner_user_id: null,
            is_inbox: false,
            overview_markdown: '## Acme Overview',
            created_at: '2026-02-25T00:00:00.000Z',
            updated_at: '2026-02-25T00:00:00.000Z',
          },
        ],
        error: null,
      })),
      eq: vi.fn(() => query),
    };

    vi.mocked(getSupabase).mockReturnValue({
      from: vi.fn(() => ({
        select: vi.fn(() => query),
      })),
    } as never);

    const app = createAuthedApp();
    const response = await app.request('/api/admin/projects');

    expect(response.status).toBe(200);
    const body = await response.json() as Array<{ overview_markdown: string | null }>;
    expect(body[0]?.overview_markdown).toBe('## Acme Overview');
  });

  it('writes overview_markdown on create and update', async () => {
    let insertedPayload: Record<string, unknown> | null = null;
    let updatedPayload: Record<string, unknown> | null = null;

    vi.mocked(getSupabase).mockReturnValue({
      from: vi.fn((table: string) => {
        if (table !== 'projects') {
          throw new Error(`Unexpected table: ${table}`);
        }

        return {
          insert: (payload: Record<string, unknown>) => {
            insertedPayload = payload;
            return {
              select: () => ({
                single: async () => ({
                  data: {
                    id: 'project-1',
                    client_id: 'client-1',
                    name: 'Acme',
                    scope: 'client',
                    owner_user_id: null,
                    is_inbox: false,
                    overview_markdown: payload.overview_markdown ?? null,
                    created_at: '2026-02-25T00:00:00.000Z',
                    updated_at: '2026-02-25T00:00:00.000Z',
                  },
                  error: null,
                }),
              }),
            };
          },
          update: (payload: Record<string, unknown>) => {
            updatedPayload = payload;
            return {
              eq: () => ({
                select: () => ({
                  single: async () => ({
                    data: {
                      id: 'project-1',
                      client_id: 'client-1',
                      name: 'Acme',
                      scope: 'client',
                      owner_user_id: null,
                      is_inbox: false,
                      overview_markdown: payload.overview_markdown ?? null,
                      created_at: '2026-02-25T00:00:00.000Z',
                      updated_at: '2026-02-25T00:00:00.000Z',
                    },
                    error: null,
                  }),
                }),
              }),
            };
          },
        };
      }),
    } as never);

    const app = createAuthedApp();
    const createResponse = await app.request('/api/admin/projects', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        client_id: 'client-1',
        name: 'Acme',
        overview_markdown: '## Initial overview',
      }),
    });

    expect(createResponse.status).toBe(201);
    expect(insertedPayload?.['overview_markdown']).toBe('## Initial overview');

    const updateResponse = await app.request('/api/admin/projects/project-1', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ overview_markdown: '## Updated overview' }),
    });

    expect(updateResponse.status).toBe(200);
    expect(updatedPayload?.['overview_markdown']).toBe('## Updated overview');
    expect(vi.mocked(writeAuditEvent)).toHaveBeenCalledTimes(2);
  });
});

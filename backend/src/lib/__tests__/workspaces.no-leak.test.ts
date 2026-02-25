import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildWorkspaceTree } from '../workspaces.js';
import { getSupabase } from '../supabase.js';
import { isAdmin } from '../acl.js';

vi.mock('../supabase.js', () => ({
  getSupabase: vi.fn(),
}));

vi.mock('../acl.js', () => ({
  isAdmin: vi.fn(),
}));

describe('buildWorkspaceTree no-leak behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not query transcript tables while building tree metadata (RPC path)', async () => {
    const from = vi.fn();
    const rpc = vi.fn(async () => ({
      data: [
        {
          client_id: 'client-1',
          client_name: 'Acme',
          client_scope: 'client',
          project_id: 'project-1',
          project_name: 'Acme Core',
          project_scope: 'client',
          project_client_id: 'client-1',
          conversation_count: 1,
        },
      ],
      error: null,
    }));

    vi.mocked(getSupabase).mockReturnValue({ rpc, from } as never);

    const tree = await buildWorkspaceTree('user-1');
    expect(tree).toHaveLength(1);
    expect(tree[0].projects[0].conversation_count).toBe(1);
    expect(from).not.toHaveBeenCalledWith('transcripts');
    expect(from).not.toHaveBeenCalledWith('transcript_project_links');
  });

  it('does not query transcript tables while building tree metadata (legacy fallback)', async () => {
    vi.mocked(isAdmin).mockResolvedValue(false);

    const from = vi.fn((table: string) => {
      if (table === 'clients') {
        const query = {
          order: vi.fn(async () => ({
            data: [{ id: 'client-1', name: 'Acme', scope: 'client', owner_user_id: null }],
            error: null,
          })),
        };
        return {
          select: vi.fn(() => query),
        };
      }

      if (table === 'projects') {
        const query = {
          order: vi.fn(async () => ({
            data: [
              {
                id: 'project-1',
                client_id: 'client-1',
                name: 'Acme Core',
                scope: 'client',
                owner_user_id: null,
              },
            ],
            error: null,
          })),
        };
        return {
          select: vi.fn(() => query),
        };
      }

      if (table === 'client_memberships') {
        const query = {
          eq: vi.fn(async () => ({
            data: [{ client_id: 'client-1' }],
            error: null,
          })),
        };
        return {
          select: vi.fn(() => query),
        };
      }

      if (table === 'project_memberships') {
        const query = {
          eq: vi.fn(async () => ({
            data: [{ project_id: 'project-1' }],
            error: null,
          })),
        };
        return {
          select: vi.fn(() => query),
        };
      }

      if (table === 'conversations') {
        const query = {
          in: vi.fn(() => query),
          is: vi.fn(async () => ({
            data: [{ project_id: 'project-1' }],
            error: null,
          })),
        };
        return {
          select: vi.fn(() => query),
        };
      }

      throw new Error(`Unexpected table requested: ${table}`);
    });

    const rpc = vi.fn(async () => ({
      data: null,
      error: { code: 'PGRST202', message: 'Could not find workspace_tree_rows' },
    }));

    vi.mocked(getSupabase).mockReturnValue({ rpc, from } as never);

    const tree = await buildWorkspaceTree('user-1');
    expect(tree).toHaveLength(1);
    expect(tree[0].projects[0].conversation_count).toBe(1);
    expect(from).not.toHaveBeenCalledWith('transcripts');
    expect(from).not.toHaveBeenCalledWith('transcript_project_links');
  });
});

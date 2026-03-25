import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getSupabase } from '../supabase.js';
import { canAccessProject } from '../acl.js';
import { filterVisibleDocumentIdsForUser } from '../document-access.js';

vi.mock('../supabase.js', () => ({
  getSupabase: vi.fn(),
}));

vi.mock('../acl.js', () => ({
  canAccessProject: vi.fn(),
}));

describe('filterVisibleDocumentIdsForUser', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns empty for empty input', async () => {
    const result = await filterVisibleDocumentIdsForUser('user-1', []);
    expect(result).toEqual([]);
  });

  it('filters by project access', async () => {
    vi.mocked(getSupabase).mockReturnValue({
      from: vi.fn(() => ({
        select: () => ({
          in: async () => ({
            data: [
              { id: 'doc-1', project_id: 'proj-a' },
              { id: 'doc-2', project_id: 'proj-b' },
              { id: 'doc-3', project_id: 'proj-a' },
            ],
            error: null,
          }),
        }),
      })),
    } as never);

    vi.mocked(canAccessProject)
      .mockResolvedValueOnce(true)   // proj-a
      .mockResolvedValueOnce(false); // proj-b

    const result = await filterVisibleDocumentIdsForUser('user-1', ['doc-1', 'doc-2', 'doc-3']);
    expect(result).toEqual(['doc-1', 'doc-3']);
    // proj-a checked only once (cached)
    expect(canAccessProject).toHaveBeenCalledTimes(2);
  });

  it('returns empty when DB query fails', async () => {
    vi.mocked(getSupabase).mockReturnValue({
      from: vi.fn(() => ({
        select: () => ({
          in: async () => ({ data: null, error: { message: 'fail' } }),
        }),
      })),
    } as never);

    const result = await filterVisibleDocumentIdsForUser('user-1', ['doc-1']);
    expect(result).toEqual([]);
  });
});

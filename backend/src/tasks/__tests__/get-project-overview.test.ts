import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getProjectOverviewTask } from '../get-project-overview.js';
import { getSupabase } from '../../lib/supabase.js';

vi.mock('../../lib/supabase.js', () => ({
  getSupabase: vi.fn(),
}));

describe('getProjectOverviewTask', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns overview markdown when project exists', async () => {
    const query = {
      eq: vi.fn(() => ({
        maybeSingle: async () => ({
          data: { id: 'project-1', overview_markdown: '## Overview' },
          error: null,
        }),
      })),
    };

    vi.mocked(getSupabase).mockReturnValue({
      from: vi.fn(() => ({
        select: vi.fn(() => query),
      })),
    } as never);

    const outputs: Array<{ projectId: string; overviewMarkdown?: string }> = [];
    for await (const output of getProjectOverviewTask.execute({ projectId: 'project-1' }, {} as never)) {
      outputs.push(output);
    }

    expect(outputs).toEqual([{ projectId: 'project-1', overviewMarkdown: '## Overview' }]);
  });

  it('returns undefined overview when markdown is empty', async () => {
    const query = {
      eq: vi.fn(() => ({
        maybeSingle: async () => ({
          data: { id: 'project-1', overview_markdown: '   ' },
          error: null,
        }),
      })),
    };

    vi.mocked(getSupabase).mockReturnValue({
      from: vi.fn(() => ({
        select: vi.fn(() => query),
      })),
    } as never);

    const outputs: Array<{ projectId: string; overviewMarkdown?: string }> = [];
    for await (const output of getProjectOverviewTask.execute({ projectId: 'project-1' }, {} as never)) {
      outputs.push(output);
    }

    expect(outputs).toEqual([{ projectId: 'project-1', overviewMarkdown: undefined }]);
  });

  it('throws when project does not exist', async () => {
    const query = {
      eq: vi.fn(() => ({
        maybeSingle: async () => ({
          data: null,
          error: null,
        }),
      })),
    };

    vi.mocked(getSupabase).mockReturnValue({
      from: vi.fn(() => ({
        select: vi.fn(() => query),
      })),
    } as never);

    await expect(async () => {
      for await (const _ of getProjectOverviewTask.execute({ projectId: 'project-missing' }, {} as never)) {
        // consume
      }
    }).rejects.toThrow('Project not found: project-missing');
  });
});

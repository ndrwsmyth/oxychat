import { beforeEach, describe, expect, it, vi } from 'vitest';
import { chooseProjectLinkCandidate, resolveProjectLinksTask } from '../resolve-project-links.js';
import { getSupabase } from '../../lib/supabase.js';

vi.mock('../../lib/supabase.js', () => ({
  getSupabase: vi.fn(),
}));

describe('chooseProjectLinkCandidate', () => {
  const domainMatch = { projectId: 'project-domain', clientId: 'client-1' };
  const aliasMatch = { projectId: 'project-alias', clientId: 'client-2' };
  const clientInboxMatch = { projectId: 'project-inbox', clientId: 'client-3' };
  const globalInboxMatch = { projectId: 'project-global', clientId: 'client-global' };

  it('enforces precedence: domain -> alias -> client inbox -> global', () => {
    const resolved = chooseProjectLinkCandidate({
      domainMatch,
      aliasMatch,
      clientInboxMatch,
      globalInboxMatch,
    });

    expect(resolved.candidate?.projectId).toBe('project-domain');
    expect(resolved.source).toBe('domain_match');
  });

  it('uses title alias when no domain match exists', () => {
    const resolved = chooseProjectLinkCandidate({
      domainMatch: null,
      aliasMatch,
      clientInboxMatch,
      globalInboxMatch,
    });

    expect(resolved.candidate?.projectId).toBe('project-alias');
    expect(resolved.source).toBe('title_alias');
  });

  it('falls back to client inbox for known client routing', () => {
    const resolved = chooseProjectLinkCandidate({
      domainMatch: null,
      aliasMatch: null,
      clientInboxMatch,
      globalInboxMatch,
    });

    expect(resolved.candidate?.projectId).toBe('project-inbox');
    expect(resolved.source).toBe('client_inbox_fallback');
  });

  it('falls back to global triage for unknown client routing', () => {
    const resolved = chooseProjectLinkCandidate({
      domainMatch: null,
      aliasMatch: null,
      clientInboxMatch: null,
      globalInboxMatch,
    });

    expect(resolved.candidate?.projectId).toBe('project-global');
    expect(resolved.source).toBe('global_triage_fallback');
  });
});

describe('resolveProjectLinksTask', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('preserves existing admin_manual link for non-private transcripts', async () => {
    const insert = vi.fn(async () => ({ error: null }));
    const maybeSingleClassification = vi.fn(async () => ({
      data: { visibility: 'non_private' },
      error: null,
    }));
    const maybeSingleExistingLink = vi.fn(async () => ({
      data: { project_id: 'project-manual', link_source: 'admin_manual' },
      error: null,
    }));
    const from = vi.fn((table: string) => {
      if (table === 'transcript_classification') {
        const query = {
          eq: vi.fn(() => query),
          maybeSingle: maybeSingleClassification,
        };
        return {
          select: vi.fn(() => query),
        };
      }

      if (table === 'transcript_project_links') {
        const query = {
          eq: vi.fn(() => query),
          maybeSingle: maybeSingleExistingLink,
        };
        return {
          select: vi.fn(() => query),
        };
      }

      if (table === 'audit_events') {
        return { insert };
      }

      throw new Error(`Unexpected table: ${table}`);
    });

    vi.mocked(getSupabase).mockReturnValue({ from } as never);

    const outputs = [];
    for await (const output of resolveProjectLinksTask.execute({ transcriptId: 't-1' }, {} as never)) {
      outputs.push(output);
    }

    expect(outputs).toEqual([
      {
        transcriptId: 't-1',
        visibility: 'non_private',
        projectId: 'project-manual',
        linkSource: 'admin_manual',
      },
    ]);
    expect(insert).toHaveBeenCalledTimes(1);
  });

  it('rejects admin_manual source from auto-resolve upsert path', async () => {
    const from = vi.fn((table: string) => {
      if (table === 'transcript_classification') {
        const query = {
          eq: vi.fn(() => query),
          maybeSingle: vi.fn(async () => ({
            data: { visibility: 'non_private' },
            error: null,
          })),
        };
        return { select: vi.fn(() => query) };
      }

      if (table === 'transcript_project_links') {
        return {
          select: vi.fn(() => {
            const query = {
              eq: vi.fn(() => query),
              maybeSingle: vi.fn(async () => ({ data: null, error: null })),
            };
            return query;
          }),
          upsert: vi.fn(() => ({
            select: vi.fn(() => ({
              single: vi.fn(async () => ({
                data: {
                  project_id: 'project-global',
                  link_source: 'admin_manual',
                },
                error: null,
              })),
            })),
          })),
        };
      }

      if (table === 'transcripts') {
        const query = {
          eq: vi.fn(() => query),
          maybeSingle: vi.fn(async () => ({
            data: { title: 'Weekly sync' },
            error: null,
          })),
        };
        return { select: vi.fn(() => query) };
      }

      if (table === 'transcript_attendees') {
        const query = {
          eq: vi.fn(async () => ({
            data: [],
            error: null,
          })),
        };
        return { select: vi.fn(() => query) };
      }

      if (table === 'project_domains') {
        return {
          select: vi.fn(() => ({
            in: vi.fn(() => ({
              order: vi.fn(() => ({
                limit: vi.fn(async () => ({ data: [], error: null })),
              })),
            })),
          })),
        };
      }

      if (table === 'project_aliases') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn(async () => ({ data: null, error: null })),
            })),
          })),
        };
      }

      if (table === 'projects') {
        const query = {
          eq: vi.fn(() => query),
          order: vi.fn(() => query),
          limit: vi.fn(async () => ({
            data: [{ id: 'project-global', client_id: 'client-global', name: 'Global Inbox' }],
            error: null,
          })),
        };
        return { select: vi.fn(() => query) };
      }

      throw new Error(`Unexpected table: ${table}`);
    });

    vi.mocked(getSupabase).mockReturnValue({ from } as never);

    await expect(async () => {
      for await (const _output of resolveProjectLinksTask.execute({ transcriptId: 't-2' }, {} as never)) {
        void _output;
      }
    }).rejects.toThrow('Invalid auto transcript link source: admin_manual');
  });
});

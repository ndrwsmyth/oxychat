/**
 * Tests for API utility functions
 *
 * Run with: pnpm test
 * (after installing vitest: pnpm add -D vitest)
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { parseMentions, queryMentionTranscripts, setAuthTokenGetter } from '../lib/api';
import { parseAdminError } from '../lib/admin-errors';

describe('parseMentions', () => {
  it('extracts mentions in @[Title] format', () => {
    const result = parseMentions('@[Oxy Marketing Meeting] summarize');
    expect(result).toEqual(['Oxy Marketing Meeting']);
  });

  it('handles multiple mentions', () => {
    const result = parseMentions('@[Meeting 1] and @[Meeting 2]');
    expect(result).toEqual(['Meeting 1', 'Meeting 2']);
  });

  it('handles mentions with special characters', () => {
    const result = parseMentions('@[Q4 2024 Review - Sales] tell me about it');
    expect(result).toEqual(['Q4 2024 Review - Sales']);
  });

  it('returns empty array for no mentions', () => {
    const result = parseMentions('Just a regular message');
    expect(result).toEqual([]);
  });

  it('returns empty array for empty string', () => {
    const result = parseMentions('');
    expect(result).toEqual([]);
  });

  it('handles mentions at end of message', () => {
    const result = parseMentions('What about @[Important Meeting]');
    expect(result).toEqual(['Important Meeting']);
  });

  it('handles mentions with numbers', () => {
    const result = parseMentions('@[Meeting 123] summary');
    expect(result).toEqual(['Meeting 123']);
  });

  it('trims whitespace from mention titles', () => {
    const result = parseMentions('@[  Spaced Title  ] test');
    expect(result).toEqual(['Spaced Title']);
  });

  it('ignores @mentions without brackets (old format)', () => {
    const result = parseMentions('@OldStyleMention should not match');
    expect(result).toEqual([]);
  });

  it('handles complex real-world example', () => {
    const result = parseMentions(
      'Based on @[Oxy Brand Strategy Session] and @[Q4 Planning Meeting], what were the key decisions?'
    );
    expect(result).toEqual(['Oxy Brand Strategy Session', 'Q4 Planning Meeting']);
  });
});

describe('queryMentionTranscripts', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    setAuthTokenGetter(async () => null);
  });

  it('flattens project/global buckets with scope_bucket ordering', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        project: [{ id: 'p1', title: 'Project Doc', date: '2026-02-25T00:00:00.000Z' }],
        global: [{ id: 'g1', title: 'Global Doc', date: '2026-02-24T00:00:00.000Z' }],
        mode: 'project_global',
        took_ms: 12.3,
      }),
    } as Response);

    const result = await queryMentionTranscripts('plan', { projectId: 'project-1' });

    expect(result.mode).toBe('project_global');
    expect(result.tookMs).toBe(12.3);
    expect(result.transcripts.map((item) => item.id)).toEqual(['p1', 'g1']);
    expect(result.transcripts.map((item) => item.scope_bucket)).toEqual(['project', 'global']);
  });
});

describe('parseAdminError', () => {
  it('parses typed admin error envelope', () => {
    const parsed = parseAdminError(
      {
        error: {
          code: 'admin_forbidden',
          message: 'Admin access required',
          details: { path: '/api/admin/projects' },
        },
      },
      403
    );

    expect(parsed).toEqual({
      code: 'admin_forbidden',
      message: 'Admin access required',
      details: { path: '/api/admin/projects' },
      status: 403,
    });
  });

  it('parses legacy admin error envelope', () => {
    const parsed = parseAdminError({ error: 'Admin access required' }, 403);

    expect(parsed).toEqual({
      code: 'legacy_admin_error',
      message: 'Admin access required',
      status: 403,
    });
  });
});

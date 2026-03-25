import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  LockConflictError,
  acquireTranscriptRelinkLock,
  releaseTranscriptRelinkLock,
} from '../transcript-relink-lock.js';
import { withDbClient } from '../db.js';

vi.mock('../db.js', () => ({
  withDbClient: vi.fn(),
}));

describe('transcript relink lock helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('acquires lock with explicit ttlSeconds override', async () => {
    const query = vi.fn(async () => ({ rowCount: 1, rows: [{ transcript_id: 't-1' }] }));
    vi.mocked(withDbClient).mockImplementation(async (fn) => fn({ query } as never));

    await acquireTranscriptRelinkLock({
      transcriptId: '00000000-0000-4000-8000-000000000001',
      userId: '00000000-0000-4000-8000-000000000002',
      ttlSeconds: 15,
    });

    expect(query).toHaveBeenCalledTimes(1);
    const acquireCall = (query as unknown as { mock: { calls: Array<[string, unknown[]]> } }).mock.calls[0];
    expect(acquireCall?.[0]).toContain('make_interval(secs => $3::integer)');
    expect(acquireCall?.[1]).toEqual([
      '00000000-0000-4000-8000-000000000001',
      '00000000-0000-4000-8000-000000000002',
      15,
    ]);
  });

  it('throws LockConflictError when acquire returns zero rows', async () => {
    const query = vi.fn(async () => ({ rowCount: 0, rows: [] }));
    vi.mocked(withDbClient).mockImplementation(async (fn) => fn({ query } as never));

    await expect(
      acquireTranscriptRelinkLock({
        transcriptId: '00000000-0000-4000-8000-000000000001',
        userId: '00000000-0000-4000-8000-000000000002',
      })
    ).rejects.toBeInstanceOf(LockConflictError);
  });

  it('releases lock scoped to transcript_id and locked_by', async () => {
    const query = vi.fn(async () => ({ rowCount: 1, rows: [] }));
    vi.mocked(withDbClient).mockImplementation(async (fn) => fn({ query } as never));

    await releaseTranscriptRelinkLock({
      transcriptId: '00000000-0000-4000-8000-000000000001',
      userId: '00000000-0000-4000-8000-000000000002',
    });

    expect(query).toHaveBeenCalledTimes(1);
    const releaseCall = (query as unknown as { mock: { calls: Array<[string, unknown[]]> } }).mock.calls[0];
    expect(releaseCall?.[0]).toContain('WHERE transcript_id = $1::uuid');
    expect(releaseCall?.[0]).toContain('AND locked_by = $2::uuid');
    expect(releaseCall?.[1]).toEqual([
      '00000000-0000-4000-8000-000000000001',
      '00000000-0000-4000-8000-000000000002',
    ]);
  });
});

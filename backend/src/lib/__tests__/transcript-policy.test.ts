import { beforeEach, describe, expect, it, vi } from 'vitest';
import { assertTranscriptRelinkAllowed } from '../transcript-policy.js';
import { getSupabase } from '../supabase.js';
import { AccessDeniedError } from '../acl.js';

vi.mock('../supabase.js', () => ({
  getSupabase: vi.fn(),
}));

describe('assertTranscriptRelinkAllowed', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('throws for private transcripts', async () => {
    const query = {
      eq: vi.fn(() => query),
      maybeSingle: vi.fn(async () => ({
        data: { visibility: 'private' },
        error: null,
      })),
    };

    vi.mocked(getSupabase).mockReturnValue({
      from: vi.fn(() => ({
        select: vi.fn(() => query),
      })),
    } as never);

    await expect(assertTranscriptRelinkAllowed('t-private')).rejects.toBeInstanceOf(AccessDeniedError);
  });

  it('allows non-private transcripts', async () => {
    const query = {
      eq: vi.fn(() => query),
      maybeSingle: vi.fn(async () => ({
        data: { visibility: 'non_private' },
        error: null,
      })),
    };

    vi.mocked(getSupabase).mockReturnValue({
      from: vi.fn(() => ({
        select: vi.fn(() => query),
      })),
    } as never);

    await expect(assertTranscriptRelinkAllowed('t-public')).resolves.toBeUndefined();
  });
});

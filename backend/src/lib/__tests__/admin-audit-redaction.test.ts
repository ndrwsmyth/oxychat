import { beforeEach, describe, expect, it, vi } from 'vitest';
import { redactAuditEventsForViewer, type AuditEventRow } from '../admin-audit-redaction.js';
import { getSupabase } from '../supabase.js';

vi.mock('../supabase.js', () => ({
  getSupabase: vi.fn(),
}));

function buildEvent(): AuditEventRow {
  return {
    id: '00000000-0000-4000-8000-000000000010',
    actor_user_id: '00000000-0000-4000-8000-000000000011',
    event_type: 'transcript.routed',
    entity_type: 'transcript',
    entity_id: '00000000-0000-4000-8000-000000000012',
    request_id: 'req-1',
    payload: {
      project_id: '00000000-0000-4000-8000-000000000013',
      link_source: 'admin_manual',
    },
    created_at: '2026-03-02T00:00:00.000Z',
  };
}

function mockSupabaseForRedaction(attendee: boolean) {
  const from = vi.fn((table: string) => {
    if (table === 'transcript_classification') {
      return {
        select: vi.fn(() => ({
          in: vi.fn(async () => ({
            data: [
              {
                transcript_id: '00000000-0000-4000-8000-000000000012',
                visibility: 'private',
              },
            ],
            error: null,
          })),
        })),
      };
    }

    if (table === 'transcript_attendees') {
      return {
        select: vi.fn(() => ({
          in: vi.fn(() => ({
            eq: vi.fn(async () => ({
              data: attendee
                ? [{ transcript_id: '00000000-0000-4000-8000-000000000012' }]
                : [],
              error: null,
            })),
          })),
        })),
      };
    }

    throw new Error(`Unexpected table ${table}`);
  });

  vi.mocked(getSupabase).mockReturnValue({ from } as never);
}

describe('redactAuditEventsForViewer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not redact private transcript events for transcript attendees', async () => {
    mockSupabaseForRedaction(true);
    const input = [buildEvent()];

    const output = await redactAuditEventsForViewer(input, 'viewer@oxy.so');

    expect(output).toEqual([
      {
        ...input[0],
        redacted: false,
        redaction_reason: null,
      },
    ]);
  });

  it('redacts private transcript events for non-attendees without mutating source rows', async () => {
    mockSupabaseForRedaction(false);
    const input = [buildEvent()];

    const output = await redactAuditEventsForViewer(input, 'viewer@oxy.so');

    expect(output).toEqual([
      {
        ...input[0],
        entity_id: null,
        payload: { redacted: true },
        redacted: true,
        redaction_reason: 'private_transcript_not_attendee',
      },
    ]);
    expect(input[0].entity_id).toBe('00000000-0000-4000-8000-000000000012');
    expect(input[0].payload).toEqual({
      project_id: '00000000-0000-4000-8000-000000000013',
      link_source: 'admin_manual',
    });
  });
});

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ingestTranscriptEnvelope } from '../ingest-envelope.js';
import { withDbClient } from '../db.js';
import { computeTranscriptClassification } from '../transcript-classification.js';
import type { TranscriptLinkSource } from '../../types/transcript-link.js';

vi.mock('../db.js', () => ({
  withDbClient: vi.fn(),
}));

vi.mock('../transcript-classification.js', () => ({
  computeTranscriptClassification: vi.fn(),
}));

interface TestClientOptions {
  existingLink: null | { project_id: string; link_source: TranscriptLinkSource };
  existingClassification: {
    visibility: 'private' | 'non_private';
    classification_reason: string;
    is_weekly_exception: boolean;
  };
}

function createTestClient(options: TestClientOptions) {
  const deleteStatements: string[] = [];
  const auditEvents: string[] = [];
  const query = vi.fn(async (sql: string, params?: unknown[]) => {
    if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK') {
      return { rows: [] };
    }

    if (sql.includes('INSERT INTO transcripts')) {
      return { rows: [{ id: 'transcript-1', inserted: false }] };
    }

    if (sql.includes('SELECT visibility, classification_reason, is_weekly_exception')) {
      return { rows: [options.existingClassification] };
    }

    if (sql.includes('INSERT INTO transcript_classification')) {
      return { rows: [] };
    }

    if (sql.includes('SELECT project_id, link_source')) {
      return { rows: options.existingLink ? [options.existingLink] : [] };
    }

    if (sql.includes('DELETE FROM transcript_project_links')) {
      deleteStatements.push(sql);
      return { rows: [] };
    }

    if (sql.includes('INSERT INTO transcript_project_links')) {
      return { rows: [] };
    }

    if (sql.includes('INSERT INTO audit_events')) {
      auditEvents.push(String(params?.[0] ?? ''));
      return { rows: [] };
    }

    throw new Error(`Unexpected query in test: ${sql}`);
  });

  return {
    client: { query },
    deleteStatements,
    auditEvents,
  };
}

function buildTranscriptFixture() {
  return {
    sourceId: 'fixture:source:1',
    title: 'Fixture transcript',
    content: 'content',
    summary: null,
    date: new Date('2026-03-01T00:00:00.000Z'),
    rawJson: {},
    attendees: [] as Array<{ email: string; name: string | null }>,
  };
}

describe('ingestTranscriptEnvelope admin_manual preservation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('preserves existing admin_manual link on non-private re-ingest', async () => {
    vi.mocked(computeTranscriptClassification).mockReturnValue({
      visibility: 'non_private',
      reason: 'external_attendee',
      isWeeklyException: false,
      normalizedTitle: 'fixture transcript',
      attendeeCount: 0,
      externalAttendeeCount: 0,
    });

    const { client, deleteStatements, auditEvents } = createTestClient({
      existingLink: {
        project_id: 'project-manual',
        link_source: 'admin_manual',
      },
      existingClassification: {
        visibility: 'non_private',
        classification_reason: 'external_attendee',
        is_weekly_exception: false,
      },
    });

    vi.mocked(withDbClient).mockImplementation(async (fn) => fn(client as never));

    const result = await ingestTranscriptEnvelope({
      transcript: buildTranscriptFixture(),
      requestId: 'req-1',
    });

    expect(result.projectId).toBe('project-manual');
    expect(result.linkSource).toBe('admin_manual');
    expect(deleteStatements).toHaveLength(0);
    expect(auditEvents).toContain('transcript.routed.preserved');
  });

  it('clears existing links when transcript reclassifies to private', async () => {
    vi.mocked(computeTranscriptClassification).mockReturnValue({
      visibility: 'private',
      reason: 'no_attendees',
      isWeeklyException: false,
      normalizedTitle: 'fixture transcript',
      attendeeCount: 0,
      externalAttendeeCount: 0,
    });

    const { client, deleteStatements } = createTestClient({
      existingLink: {
        project_id: 'project-manual',
        link_source: 'admin_manual',
      },
      existingClassification: {
        visibility: 'non_private',
        classification_reason: 'external_attendee',
        is_weekly_exception: false,
      },
    });

    vi.mocked(withDbClient).mockImplementation(async (fn) => fn(client as never));

    const result = await ingestTranscriptEnvelope({
      transcript: buildTranscriptFixture(),
      requestId: 'req-2',
    });

    expect(result.visibility).toBe('private');
    expect(result.projectId).toBeNull();
    expect(result.linkSource).toBeNull();
    expect(deleteStatements).toHaveLength(1);
  });
});

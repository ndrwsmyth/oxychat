import { getSupabase } from './supabase.js';
import { normalizeEmail } from './transcript-normalization.js';

export interface AuditEventRow {
  id: string;
  actor_user_id: string | null;
  event_type: string;
  entity_type: string;
  entity_id: string | null;
  request_id: string | null;
  payload: Record<string, unknown>;
  created_at: string;
}

export interface AuditEventView extends AuditEventRow {
  redacted: boolean;
  redaction_reason: 'private_transcript_not_attendee' | null;
}

interface TranscriptClassificationRow {
  transcript_id: string;
  visibility: 'private' | 'non_private';
}

interface TranscriptAttendeeRow {
  transcript_id: string;
}

function toViewRow(row: AuditEventRow): AuditEventView {
  return {
    ...row,
    redacted: false,
    redaction_reason: null,
  };
}

export async function redactAuditEventsForViewer(
  rows: AuditEventRow[],
  viewerEmail: string
): Promise<AuditEventView[]> {
  if (rows.length === 0) {
    return [];
  }

  const transcriptIds = [
    ...new Set(
      rows
        .filter((row) => row.entity_type === 'transcript' && Boolean(row.entity_id))
        .map((row) => row.entity_id as string)
    ),
  ];

  if (transcriptIds.length === 0) {
    return rows.map(toViewRow);
  }

  const supabase = getSupabase();
  const { data: classifications, error: classificationError } = await supabase
    .from('transcript_classification')
    .select('transcript_id, visibility')
    .in('transcript_id', transcriptIds);

  if (classificationError) {
    throw new Error(`Failed to load transcript classification for audit redaction: ${classificationError.message}`);
  }

  const privateTranscriptIds = new Set(
    ((classifications ?? []) as TranscriptClassificationRow[])
      .filter((row) => row.visibility === 'private')
      .map((row) => row.transcript_id)
  );

  if (privateTranscriptIds.size === 0) {
    return rows.map(toViewRow);
  }

  const normalizedViewerEmail = normalizeEmail(viewerEmail);
  const { data: attendeeRows, error: attendeeError } = await supabase
    .from('transcript_attendees')
    .select('transcript_id')
    .in('transcript_id', [...privateTranscriptIds])
    .eq('normalized_email', normalizedViewerEmail);

  if (attendeeError) {
    throw new Error(`Failed to load transcript attendees for audit redaction: ${attendeeError.message}`);
  }

  const attendeeTranscriptIds = new Set(
    ((attendeeRows ?? []) as TranscriptAttendeeRow[]).map((row) => row.transcript_id)
  );

  return rows.map((row) => {
    if (row.entity_type !== 'transcript' || !row.entity_id) {
      return toViewRow(row);
    }

    if (!privateTranscriptIds.has(row.entity_id)) {
      return toViewRow(row);
    }

    if (attendeeTranscriptIds.has(row.entity_id)) {
      return toViewRow(row);
    }

    return {
      ...row,
      entity_id: null,
      payload: { redacted: true },
      redacted: true,
      redaction_reason: 'private_transcript_not_attendee',
    };
  });
}

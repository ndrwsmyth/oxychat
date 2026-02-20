import { defineTask } from '@ndrwsmyth/sediment';
import { computeTranscriptClassification } from '../lib/transcript-classification.js';
import { getSupabase } from '../lib/supabase.js';

export interface ClassifyTranscriptVisibilityInput {
  transcriptId: string;
}

export interface ClassifyTranscriptVisibilityResult {
  transcriptId: string;
  visibility: 'private' | 'non_private';
  reason: 'weekly_exception' | 'external_attendee' | 'internal_attendees_only' | 'no_attendees';
  isWeeklyException: boolean;
  normalizedTitle: string;
  attendeeCount: number;
  externalAttendeeCount: number;
  classifiedAt: string;
}

export const classifyTranscriptVisibilityTask = defineTask<
  ClassifyTranscriptVisibilityInput,
  ClassifyTranscriptVisibilityResult
>('classify_transcript_visibility', async function* (input) {
  const supabase = getSupabase();

  const { data: transcript, error: transcriptError } = await supabase
    .from('transcripts')
    .select('id, title')
    .eq('id', input.transcriptId)
    .maybeSingle();

  if (transcriptError || !transcript) {
    throw new Error(
      `Failed to load transcript ${input.transcriptId}: ${transcriptError?.message ?? 'not found'}`
    );
  }

  const { data: attendees, error: attendeesError } = await supabase
    .from('transcript_attendees')
    .select('email')
    .eq('transcript_id', input.transcriptId);

  if (attendeesError) {
    throw new Error(`Failed to load attendees: ${attendeesError.message}`);
  }

  const attendeeEmails = (attendees ?? [])
    .map((row) => row.email)
    .filter((email): email is string => typeof email === 'string' && email.trim().length > 0);

  const decision = computeTranscriptClassification({
    title: transcript.title,
    attendeeEmails,
  });

  const now = new Date().toISOString();
  const { data: saved, error: saveError } = await supabase
    .from('transcript_classification')
    .upsert(
      {
        transcript_id: input.transcriptId,
        visibility: decision.visibility,
        classification_reason: decision.reason,
        is_weekly_exception: decision.isWeeklyException,
        normalized_title: decision.normalizedTitle,
        attendee_count: decision.attendeeCount,
        external_attendee_count: decision.externalAttendeeCount,
        classified_at: now,
        updated_at: now,
      },
      { onConflict: 'transcript_id' }
    )
    .select('classified_at')
    .single();

  if (saveError) {
    throw new Error(`Failed to save transcript classification: ${saveError.message}`);
  }

  yield {
    transcriptId: input.transcriptId,
    visibility: decision.visibility,
    reason: decision.reason,
    isWeeklyException: decision.isWeeklyException,
    normalizedTitle: decision.normalizedTitle,
    attendeeCount: decision.attendeeCount,
    externalAttendeeCount: decision.externalAttendeeCount,
    classifiedAt: saved?.classified_at ?? now,
  };
});

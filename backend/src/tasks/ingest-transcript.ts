import { defineTask } from 'sediment';
import { getSupabase } from '../lib/supabase.js';
import type {
  NormalizedTranscript,
  TranscriptSource,
} from '../adapters/transcript-sources.js';

export interface IngestTranscriptInput<T = unknown> {
  source: TranscriptSource<T>;
  payload: T;
}

export interface IngestTranscriptResult {
  transcriptId: string;
  isNew: boolean;
}

/**
 * Layer 1: Ingest a transcript from any source.
 * 1. Transform via source adapter
 * 2. Check deduplication by source_id
 * 3. Insert or return existing
 */
export const ingestTranscriptTask = defineTask<
  IngestTranscriptInput,
  IngestTranscriptResult
>('ingest_transcript', async function* (input) {
  const normalized: NormalizedTranscript = input.source.transform(input.payload);
  const supabase = getSupabase();

  // Check for existing transcript (deduplication)
  const { data: existing } = await supabase
    .from('transcripts')
    .select('id')
    .eq('source_id', normalized.sourceId)
    .single();

  if (existing) {
    yield { transcriptId: existing.id, isNew: false };
    return;
  }

  // Insert new transcript
  const { data, error } = await supabase
    .from('transcripts')
    .insert({
      source_id: normalized.sourceId,
      title: normalized.title,
      content: normalized.content,
      summary: normalized.summary,
      date: normalized.date.toISOString(),
      raw_json: normalized.rawJson,
    })
    .select('id')
    .single();

  if (error || !data) {
    throw new Error(`Failed to insert transcript: ${error?.message}`);
  }

  yield { transcriptId: data.id, isNew: true };
});

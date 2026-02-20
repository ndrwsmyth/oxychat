import { defineTask } from '@ndrwsmyth/sediment';
import { ingestTranscriptEnvelope } from '../lib/ingest-envelope.js';
import type {
  NormalizedTranscript,
  TranscriptSource,
} from '../adapters/transcript-sources.js';

export interface IngestTranscriptInput<T = unknown> {
  source: TranscriptSource<T>;
  payload: T;
  requestId?: string | null;
}

export interface IngestTranscriptResult {
  transcriptId: string;
  isNew: boolean;
}

/**
 * Layer 1: Ingest a transcript from any source.
 * 1. Transform via source adapter
 * 2. Persist in an atomic envelope:
 *    transcript + attendees + classification + project links + audit events
 */
export const ingestTranscriptTask = defineTask<
  IngestTranscriptInput,
  IngestTranscriptResult
>('ingest_transcript', async function* (input) {
  const normalized: NormalizedTranscript = input.source.transform(input.payload);
  const result = await ingestTranscriptEnvelope({
    transcript: normalized,
    requestId: input.requestId ?? null,
  });

  yield { transcriptId: result.transcriptId, isNew: result.isNew };
});

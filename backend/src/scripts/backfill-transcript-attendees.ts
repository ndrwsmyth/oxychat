import 'dotenv/config';
import { getSupabase } from '../lib/supabase.js';
import { extractAttendeesFromRawJson } from '../lib/transcript-attendees.js';

function parseBatchSize(): number {
  const argIndex = process.argv.findIndex((arg) => arg === '--batch-size');
  if (argIndex === -1) return 200;

  const parsed = Number(process.argv[argIndex + 1]);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`Invalid --batch-size value: ${process.argv[argIndex + 1]}`);
  }
  return parsed;
}

async function main() {
  const supabase = getSupabase();
  const batchSize = parseBatchSize();
  let from = 0;
  let scanned = 0;
  let upserted = 0;

  while (true) {
    const { data: transcripts, error } = await supabase
      .from('transcripts')
      .select('id, raw_json')
      .order('created_at', { ascending: true })
      .range(from, from + batchSize - 1);

    if (error) {
      throw new Error(`Failed to load transcript batch: ${error.message}`);
    }

    if (!transcripts || transcripts.length === 0) {
      break;
    }

    scanned += transcripts.length;
    from += transcripts.length;

    const attendeeRows = transcripts.flatMap((transcript) =>
      extractAttendeesFromRawJson(transcript.raw_json).map((attendee) => ({
        transcript_id: transcript.id,
        email: attendee.email,
        name: attendee.name,
      }))
    );

    if (attendeeRows.length > 0) {
      const { error: upsertError } = await supabase
        .from('transcript_attendees')
        .upsert(attendeeRows, { onConflict: 'transcript_id,normalized_email' });

      if (upsertError) {
        throw new Error(`Failed to upsert attendees: ${upsertError.message}`);
      }

      upserted += attendeeRows.length;
    }

    console.log(
      `[backfill:transcript-attendees] scanned=${scanned} upserted=${upserted} (batch=${transcripts.length})`
    );

    if (transcripts.length < batchSize) {
      break;
    }
  }

  console.log(`[backfill:transcript-attendees] complete scanned=${scanned} upserted=${upserted}`);
}

main().catch((error) => {
  console.error('[backfill:transcript-attendees] Failed:', error);
  process.exitCode = 1;
});

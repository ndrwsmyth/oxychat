import 'dotenv/config';
import { runTaskToCompletion } from '@ndrwsmyth/sediment';
import { getSupabase } from '../lib/supabase.js';
import { createIngestRuntime } from '../lib/runtime.js';
import { classifyTranscriptVisibilityTask } from '../tasks/classify-transcript-visibility.js';
import { resolveProjectLinksTask } from '../tasks/resolve-project-links.js';

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
  const runtime = createIngestRuntime();
  const deps = runtime.getDeps();
  const batchSize = parseBatchSize();
  let from = 0;
  let scanned = 0;

  while (true) {
    const { data: transcripts, error } = await supabase
      .from('transcripts')
      .select('id')
      .order('created_at', { ascending: true })
      .range(from, from + batchSize - 1);

    if (error) {
      throw new Error(`Failed to load transcripts for backfill: ${error.message}`);
    }

    if (!transcripts || transcripts.length === 0) {
      break;
    }

    for (const transcript of transcripts) {
      await runTaskToCompletion(
        classifyTranscriptVisibilityTask,
        { transcriptId: transcript.id },
        deps
      );
      await runTaskToCompletion(
        resolveProjectLinksTask,
        { transcriptId: transcript.id },
        deps
      );
    }

    scanned += transcripts.length;
    from += transcripts.length;
    console.log(`[backfill:transcript-classification-links] processed=${scanned}`);

    if (transcripts.length < batchSize) {
      break;
    }
  }

  console.log(`[backfill:transcript-classification-links] complete processed=${scanned}`);
}

main().catch((error) => {
  console.error('[backfill:transcript-classification-links] Failed:', error);
  process.exitCode = 1;
});

import 'dotenv/config';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { runTaskToCompletion } from '@ndrwsmyth/sediment';
import { getSupabase } from '../lib/supabase.js';
import { createIngestRuntime } from '../lib/runtime.js';
import { classifyTranscriptVisibilityTask } from '../tasks/classify-transcript-visibility.js';

const DATASET_SIZE = 200;
const AVERAGE_ATTENDEES = 4;
const CONCURRENCY = 10;
const TARGET_MS_P95 = 300;

function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, index)];
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = [];
  const queue = [...items];

  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, async () => {
      while (queue.length > 0) {
        const item = queue.shift();
        if (!item) break;
        results.push(await worker(item));
      }
    })
  );

  return results;
}

async function seedBenchmarkDataset(): Promise<string[]> {
  const supabase = getSupabase();
  const now = new Date().toISOString();
  const transcriptRows = Array.from({ length: DATASET_SIZE }, (_, index) => {
    const ordinal = index + 1;
    return {
      source_id: `bench:s2-classify:${ordinal}`,
      title: ordinal % 20 === 0 ? 'Oxy <> Weekly Planning' : `Client Sync ${ordinal}`,
      content: `Benchmark transcript ${ordinal}`,
      summary: null,
      date: now,
      raw_json: {
        id: ordinal,
        attendees: Array.from({ length: AVERAGE_ATTENDEES }, (_unused, attendeeIndex) => ({
          name: `Attendee ${attendeeIndex + 1}`,
          email:
            attendeeIndex % 2 === 0
              ? `member${attendeeIndex + 1}@oxy.so`
              : `contact${attendeeIndex + 1}@client${ordinal}.com`,
        })),
      },
      updated_at: now,
    };
  });

  const { data: transcripts, error: transcriptError } = await supabase
    .from('transcripts')
    .upsert(transcriptRows, { onConflict: 'source_id' })
    .select('id, source_id');

  if (transcriptError || !transcripts) {
    throw new Error(`Failed to seed benchmark transcripts: ${transcriptError?.message}`);
  }

  const transcriptIdBySource = new Map(transcripts.map((row) => [row.source_id, row.id]));
  const attendeeRows = transcriptRows.flatMap((row) => {
    const transcriptId = transcriptIdBySource.get(row.source_id);
    if (!transcriptId) return [];

    const attendees = Array.isArray((row.raw_json as { attendees?: unknown[] }).attendees)
      ? ((row.raw_json as { attendees: Array<{ email: string; name: string }> }).attendees ?? [])
      : [];

    return attendees.map((attendee) => ({
      transcript_id: transcriptId,
      email: attendee.email,
      name: attendee.name,
    }));
  });

  if (attendeeRows.length > 0) {
    const { error: attendeeError } = await supabase
      .from('transcript_attendees')
      .upsert(attendeeRows, { onConflict: 'transcript_id,normalized_email' });

    if (attendeeError) {
      throw new Error(`Failed to seed benchmark attendees: ${attendeeError.message}`);
    }
  }

  return transcripts.map((row) => row.id);
}

async function writeReport(samples: number[]): Promise<void> {
  const p50 = percentile(samples, 50);
  const p95 = percentile(samples, 95);
  const status = p95 < TARGET_MS_P95 ? 'PASS' : 'WARN';

  const report = `# S2 Classification Baseline

- Generated at: ${new Date().toISOString()}
- Dataset: ${DATASET_SIZE} transcripts
- Avg attendees: ${AVERAGE_ATTENDEES}
- Concurrency: ${CONCURRENCY}
- Samples: ${samples.length}
- P50: ${p50.toFixed(2)}ms
- P95: ${p95.toFixed(2)}ms
- Target: < ${TARGET_MS_P95}ms
- Status: ${status}
`;

  const reportPath = path.resolve(
    process.cwd(),
    '..',
    'docs',
    'prd_dev',
    'perf',
    's2_classification_baseline.md'
  );
  await fs.mkdir(path.dirname(reportPath), { recursive: true });
  await fs.writeFile(reportPath, report, 'utf-8');
}

async function main() {
  const transcriptIds = await seedBenchmarkDataset();
  const runtime = createIngestRuntime();
  const deps = runtime.getDeps();

  // warm-up
  for (const transcriptId of transcriptIds.slice(0, 10)) {
    await runTaskToCompletion(
      classifyTranscriptVisibilityTask,
      { transcriptId },
      deps
    );
  }

  const durations = await mapWithConcurrency(transcriptIds, CONCURRENCY, async (transcriptId) => {
    const start = performance.now();
    await runTaskToCompletion(
      classifyTranscriptVisibilityTask,
      { transcriptId },
      deps
    );
    return performance.now() - start;
  });

  await writeReport(durations);
  console.log(
    `[bench:transcript-classification] p95=${percentile(durations, 95).toFixed(2)}ms samples=${durations.length}`
  );
}

main().catch((error) => {
  console.error('[bench:transcript-classification] Failed:', error);
  process.exitCode = 1;
});

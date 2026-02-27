import 'dotenv/config';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { getSupabase } from '../lib/supabase.js';
import { getVisibleTranscriptAccessForUser } from '../lib/transcript-visibility.js';
import { assertRequiredEnvVars, assertSupabaseServiceRoleKey } from './lib/preflight.js';

const DATASET_MENTION_TRANSCRIPTS = 500;
const DATASET_NOISE_DOCS = 100;
const SAMPLES = 20;
const TARGET_P95_MS = 350;
const POLICY_LABEL = 'hard-fail';
const BUCKET_LIMIT = 20;
const SEARCH_LIMIT = 120;
const DELETE_CHUNK_SIZE = 200;

const BENCH_USER_ID = process.env.BENCH_S4_USER_ID ?? '00000000-0000-0000-0000-0000000000d4';
const BENCH_USER_EMAIL = process.env.BENCH_S4_USER_EMAIL ?? 'bench-s4-member@oxy.so';
const BENCH_CLIENT_ID = '52000000-0000-0000-0000-000000000001';
const BENCH_GLOBAL_CLIENT_ID = '52000000-0000-0000-0000-000000000002';
const BENCH_PROJECT_ID = '62000000-0000-0000-0000-000000000001';
const BENCH_GLOBAL_PROJECT_ID = '62000000-0000-0000-0000-000000000002';

function idFor(prefix: string, index: number): string {
  return `${prefix}-0000-0000-0000-${String(index).padStart(12, '0')}`;
}

function buildIds(prefix: string, count: number): string[] {
  return Array.from({ length: count }, (_unused, index) => idFor(prefix, index + 1));
}

const BENCH_MENTION_IDS = buildIds('82000000', DATASET_MENTION_TRANSCRIPTS);
const BENCH_NOISE_IDS = buildIds('83000000', DATASET_NOISE_DOCS);
const ALL_BENCH_TRANSCRIPT_IDS = [...BENCH_MENTION_IDS, ...BENCH_NOISE_IDS];

function isProjectScopedMention(index: number): boolean {
  // Keep 70/30 split while interleaving so any recency-limited window has both buckets.
  return index % 10 < 7;
}

function isPermissionDenied(message: string | null | undefined): boolean {
  return typeof message === 'string' && message.toLowerCase().includes('permission denied');
}

function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

async function deleteRowsByIds(
  table: 'transcripts' | 'transcript_classification' | 'transcript_project_links' | 'transcript_attendees',
  ids: string[],
  column = 'id'
): Promise<void> {
  if (ids.length === 0) return;
  const supabase = getSupabase();

  for (let start = 0; start < ids.length; start += DELETE_CHUNK_SIZE) {
    const chunk = ids.slice(start, start + DELETE_CHUNK_SIZE);
    const { error } = await supabase
      .from(table)
      .delete()
      .in(column, chunk);

    if (error) {
      if (isPermissionDenied(error.message)) {
        console.warn(`[bench:s4-mentions] cleanup skipped for ${table}: ${error.message}`);
        return;
      }
      throw new Error(`Failed to cleanup ${table}: ${error.message}`);
    }
  }
}

async function cleanupBenchData(): Promise<void> {
  const supabase = getSupabase();

  await deleteRowsByIds('transcript_project_links', ALL_BENCH_TRANSCRIPT_IDS, 'transcript_id');
  await deleteRowsByIds('transcript_classification', ALL_BENCH_TRANSCRIPT_IDS, 'transcript_id');
  await deleteRowsByIds('transcript_attendees', ALL_BENCH_TRANSCRIPT_IDS, 'transcript_id');
  await deleteRowsByIds('transcripts', ALL_BENCH_TRANSCRIPT_IDS);

  await supabase.from('project_memberships').delete().eq('user_id', BENCH_USER_ID).in('project_id', [
    BENCH_PROJECT_ID,
    BENCH_GLOBAL_PROJECT_ID,
  ]);
  await supabase.from('client_memberships').delete().eq('user_id', BENCH_USER_ID).in('client_id', [
    BENCH_CLIENT_ID,
    BENCH_GLOBAL_CLIENT_ID,
  ]);
  await supabase.from('projects').delete().in('id', [BENCH_PROJECT_ID, BENCH_GLOBAL_PROJECT_ID]);
  await supabase.from('clients').delete().in('id', [BENCH_CLIENT_ID, BENCH_GLOBAL_CLIENT_ID]);
  await supabase.from('user_roles').delete().eq('user_id', BENCH_USER_ID);
  await supabase.from('user_profiles').delete().eq('id', BENCH_USER_ID);
}

async function ensureBenchData(): Promise<void> {
  const supabase = getSupabase();
  const now = new Date();
  const nowIso = now.toISOString();

  await supabase.from('user_profiles').upsert(
    {
      id: BENCH_USER_ID,
      email: BENCH_USER_EMAIL,
      clerk_id: 'bench_s4_mentions',
      full_name: 'Bench S4 Member',
      updated_at: nowIso,
    },
    { onConflict: 'id' }
  );

  await supabase.from('user_roles').upsert(
    {
      user_id: BENCH_USER_ID,
      role: 'member',
      updated_at: nowIso,
    },
    { onConflict: 'user_id' }
  );

  const { error: clientError } = await supabase.from('clients').upsert(
    [
      { id: BENCH_CLIENT_ID, name: 'S4 Bench Client', scope: 'client', updated_at: nowIso },
      { id: BENCH_GLOBAL_CLIENT_ID, name: 'S4 Bench Global', scope: 'global', updated_at: nowIso },
    ],
    { onConflict: 'id' }
  );
  if (clientError) {
    if (isPermissionDenied(clientError.message)) {
      throw new Error(
        `Failed to seed bench clients: ${clientError.message}. ` +
          'The configured SUPABASE_SERVICE_KEY cannot write to public schema tables. ' +
          'Re-run `pnpm run db:reset` to restore grants, then retry. If it still fails, rotate ' +
          'SUPABASE_SERVICE_KEY from the same Supabase project as SUPABASE_URL.'
      );
    }
    throw new Error(`Failed to seed bench clients: ${clientError.message}`);
  }

  const { error: projectError } = await supabase.from('projects').upsert(
    [
      {
        id: BENCH_PROJECT_ID,
        client_id: BENCH_CLIENT_ID,
        name: 'S4 Bench Project',
        scope: 'client',
        is_inbox: false,
        updated_at: nowIso,
      },
      {
        id: BENCH_GLOBAL_PROJECT_ID,
        client_id: BENCH_GLOBAL_CLIENT_ID,
        name: 'S4 Bench Global Inbox',
        scope: 'global',
        is_inbox: true,
        updated_at: nowIso,
      },
    ],
    { onConflict: 'id' }
  );
  if (projectError) {
    throw new Error(`Failed to seed bench projects: ${projectError.message}`);
  }

  await supabase.from('project_memberships').upsert(
    [
      { user_id: BENCH_USER_ID, project_id: BENCH_PROJECT_ID, role: 'member' },
      { user_id: BENCH_USER_ID, project_id: BENCH_GLOBAL_PROJECT_ID, role: 'member' },
    ],
    { onConflict: 'user_id,project_id' }
  );

  await supabase.from('client_memberships').upsert(
    [
      { user_id: BENCH_USER_ID, client_id: BENCH_CLIENT_ID, role: 'member' },
      { user_id: BENCH_USER_ID, client_id: BENCH_GLOBAL_CLIENT_ID, role: 'member' },
    ],
    { onConflict: 'user_id,client_id' }
  );

  const mentionRows = BENCH_MENTION_IDS.map((id, index) => ({
    id,
    source_id: `bench:s4:mention:${index + 1}`,
    title: `S4 Mention Candidate ${String(index + 1).padStart(3, '0')}`,
    content: `Mention benchmark content ${index + 1}`,
    summary: null,
    date: new Date(now.getTime() - index * 60_000).toISOString(),
    raw_json: {
      id: index + 1,
      attendees: [{ email: BENCH_USER_EMAIL, name: 'Bench Member' }],
    },
    updated_at: nowIso,
  }));

  const noiseRows = BENCH_NOISE_IDS.map((id, index) => ({
    id,
    source_id: `bench:s4:noise:${index + 1}`,
    title: `S4 Noise Document ${String(index + 1).padStart(3, '0')}`,
    content: `Noise benchmark content ${index + 1}`,
    summary: null,
    date: new Date(now.getTime() - (index + DATASET_MENTION_TRANSCRIPTS) * 60_000).toISOString(),
    raw_json: {
      id: index + DATASET_MENTION_TRANSCRIPTS + 1,
      attendees: [{ email: BENCH_USER_EMAIL, name: 'Bench Member' }],
    },
    updated_at: nowIso,
  }));

  const { error: transcriptError } = await supabase
    .from('transcripts')
    .upsert([...mentionRows, ...noiseRows], { onConflict: 'id' });
  if (transcriptError) {
    throw new Error(`Failed to seed bench transcripts: ${transcriptError.message}`);
  }

  const { error: classificationError } = await supabase
    .from('transcript_classification')
    .upsert(
      ALL_BENCH_TRANSCRIPT_IDS.map((transcriptId, index) => ({
        transcript_id: transcriptId,
        visibility: 'non_private' as const,
        classification_reason: 'external_attendee' as const,
        is_weekly_exception: false,
        normalized_title: `s4 benchmark ${index + 1}`,
        attendee_count: 1,
        external_attendee_count: 1,
        classified_at: nowIso,
        updated_at: nowIso,
      })),
      { onConflict: 'transcript_id' }
    );
  if (classificationError) {
    throw new Error(`Failed to seed bench transcript classifications: ${classificationError.message}`);
  }

  const { error: linkError } = await supabase
    .from('transcript_project_links')
    .upsert(
      ALL_BENCH_TRANSCRIPT_IDS.map((transcriptId, index) => ({
        transcript_id: transcriptId,
        project_id: isProjectScopedMention(index) ? BENCH_PROJECT_ID : BENCH_GLOBAL_PROJECT_ID,
        link_source: isProjectScopedMention(index) ? 'domain_match' : 'global_triage_fallback',
        updated_at: nowIso,
      })),
      { onConflict: 'transcript_id' }
    );
  if (linkError) {
    throw new Error(`Failed to seed bench transcript links: ${linkError.message}`);
  }
}

async function runMentionQuery(projectId: string): Promise<void> {
  const supabase = getSupabase();
  const { data: rows, error } = await supabase
    .from('transcripts')
    .select('id, title, date, summary')
    .textSearch('title_search', 'S4 Mention', { type: 'websearch' })
    .order('date', { ascending: false })
    .limit(SEARCH_LIMIT);

  if (error) {
    throw new Error(`Mention query failed: ${error.message}`);
  }

  const candidateRows = (rows ?? []) as Array<{ id: string; title: string; date: string; summary: string | null }>;
  const candidateIds = candidateRows.map((row) => row.id);
  const access = await getVisibleTranscriptAccessForUser(BENCH_USER_ID, BENCH_USER_EMAIL, candidateIds);
  const visibleIds = access.visibleIds;
  const visibleRows = candidateRows.filter((row) => visibleIds.has(row.id));
  const projectRows = visibleRows
    .filter((row) => access.projectByTranscriptId.get(row.id) === projectId)
    .slice(0, BUCKET_LIMIT);
  const globalRows = visibleRows
    .filter((row) => access.projectByTranscriptId.get(row.id) !== projectId)
    .slice(0, BUCKET_LIMIT);

  // Ensure both code paths execute during benchmark samples.
  if (projectRows.length === 0 || globalRows.length === 0) {
    throw new Error('Benchmark dataset did not produce both mention buckets');
  }
}

async function writeReport(samples: number[]): Promise<void> {
  const p50 = percentile(samples, 50);
  const p95 = percentile(samples, 95);
  const status = p95 < TARGET_P95_MS ? 'PASS' : 'FAIL';

  const report = `# S4 Mention Baseline

- Generated at: ${new Date().toISOString()}
- Dataset: ${DATASET_MENTION_TRANSCRIPTS} mention transcripts + ${DATASET_NOISE_DOCS} noise docs
- Samples: ${SAMPLES}
- P50: ${p50.toFixed(2)}ms
- P95: ${p95.toFixed(2)}ms
- Target: < ${TARGET_P95_MS}ms
- Policy: ${POLICY_LABEL}
- Status: ${status}
`;

  const reportPath = path.resolve(
    process.cwd(),
    '..',
    'docs',
    'prd_dev',
    'perf',
    's4_mention_baseline.md'
  );
  await fs.mkdir(path.dirname(reportPath), { recursive: true });
  await fs.writeFile(reportPath, report, 'utf-8');
}

async function main() {
  assertRequiredEnvVars('bench:s4-mentions', ['SUPABASE_URL', 'SUPABASE_SERVICE_KEY']);
  assertSupabaseServiceRoleKey('bench:s4-mentions');
  await cleanupBenchData();

  try {
    await ensureBenchData();

    for (let i = 0; i < 5; i += 1) {
      await runMentionQuery(BENCH_PROJECT_ID);
    }

    const durations: number[] = [];
    for (let i = 0; i < SAMPLES; i += 1) {
      const startedAt = performance.now();
      await runMentionQuery(BENCH_PROJECT_ID);
      durations.push(performance.now() - startedAt);
    }

    await writeReport(durations);
    const p95 = percentile(durations, 95);
    console.log(`[bench:s4-mentions] p95=${p95.toFixed(2)}ms samples=${durations.length}`);

    if (p95 >= TARGET_P95_MS) {
      throw new Error(`S4 mention benchmark above target (p95=${p95.toFixed(2)}ms)`);
    }
  } finally {
    await cleanupBenchData();
  }
}

main().catch((error) => {
  console.error('[bench:s4-mentions] Failed:', error);
  process.exitCode = 1;
});

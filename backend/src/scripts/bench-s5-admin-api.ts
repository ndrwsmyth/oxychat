import 'dotenv/config';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { getDbPool, withDbClient } from '../lib/db.js';

const BENCH_PROJECT_COUNT = 50;
const BENCH_OPERATION_COUNT = 100;
const BENCH_ADMIN_USER_ID = process.env.BENCH_ADMIN_USER_ID ?? '00000000-0000-0000-0000-0000000000a1';
const BENCH_ADMIN_EMAIL = process.env.BENCH_ADMIN_EMAIL ?? 'admin@oxy.so';

function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

function assertRequiredEnv(): void {
  if (!process.env.SUPABASE_DATABASE_URL) {
    throw new Error('Missing SUPABASE_DATABASE_URL for bench-s5-admin-api');
  }
}

async function ensureBenchAdminUser(nowIso: string): Promise<void> {
  await withDbClient(async (client) => {
    await client.query(
      `
        INSERT INTO user_profiles (id, clerk_id, email, full_name, updated_at)
        VALUES ($1::uuid, $2, $3, $4, $5::timestamptz)
        ON CONFLICT (id)
        DO UPDATE SET
          email = EXCLUDED.email,
          full_name = EXCLUDED.full_name,
          updated_at = EXCLUDED.updated_at
      `,
      [BENCH_ADMIN_USER_ID, 'bench_s5_admin_api', BENCH_ADMIN_EMAIL, 'Bench S5 Admin', nowIso]
    );

    await client.query(
      `
        INSERT INTO user_roles (user_id, role, updated_at)
        VALUES ($1::uuid, 'admin', $2::timestamptz)
        ON CONFLICT (user_id)
        DO UPDATE SET
          role = 'admin',
          updated_at = EXCLUDED.updated_at
      `,
      [BENCH_ADMIN_USER_ID, nowIso]
    );
  });
}

async function emitBenchAuditEvent(
  eventType: string,
  runId: string,
  payload: Record<string, unknown>,
  entityType = 'benchmark',
  entityId: string | null = null
): Promise<void> {
  await withDbClient((client) =>
    client.query(
      `
        INSERT INTO audit_events (
          actor_user_id,
          event_type,
          entity_type,
          entity_id,
          request_id,
          payload
        )
        VALUES ($1::uuid, $2, $3, $4::uuid, $5, $6::jsonb)
      `,
      [BENCH_ADMIN_USER_ID, eventType, entityType, entityId, `bench:s5:${runId}`, JSON.stringify(payload)]
    )
  );
}

async function cleanupRunData(runId: string): Promise<void> {
  // Cleanup intentionally excludes audit_events to preserve append-only audit history.
  await withDbClient(async (client) => {
    const transcriptRows = await client.query<{ id: string }>(
      `
        SELECT id
        FROM transcripts
        WHERE source_id LIKE $1
      `,
      [`bench:s5:${runId}:%`]
    );
    const transcriptIds = transcriptRows.rows.map((row) => row.id);

    if (transcriptIds.length > 0) {
      await client.query('DELETE FROM transcript_project_links WHERE transcript_id = ANY($1::uuid[])', [transcriptIds]);
      await client.query('DELETE FROM transcript_classification WHERE transcript_id = ANY($1::uuid[])', [transcriptIds]);
      await client.query('DELETE FROM transcript_attendees WHERE transcript_id = ANY($1::uuid[])', [transcriptIds]);
      await client.query('DELETE FROM transcripts WHERE id = ANY($1::uuid[])', [transcriptIds]);
    }

    const projectRows = await client.query<{ id: string }>(
      `
        SELECT id
        FROM projects
        WHERE name LIKE $1
      `,
      [`S5 Bench ${runId} Project %`]
    );
    const projectIds = projectRows.rows.map((row) => row.id);
    if (projectIds.length > 0) {
      await client.query('DELETE FROM projects WHERE id = ANY($1::uuid[])', [projectIds]);
    }

    const clientRows = await client.query<{ id: string }>(
      `
        SELECT id
        FROM clients
        WHERE name = $1
      `,
      [`S5 Bench ${runId} Client`]
    );
    const clientIds = clientRows.rows.map((row) => row.id);
    if (clientIds.length > 0) {
      await client.query('DELETE FROM clients WHERE id = ANY($1::uuid[])', [clientIds]);
    }
  });
}

async function seedDataset(runId: string, nowIso: string): Promise<{ projectIds: string[]; transcriptIds: string[] }> {
  return withDbClient(async (client) => {
    await client.query('BEGIN');
    try {
      const clientInsert = await client.query<{ id: string }>(
        `
          INSERT INTO clients (name, scope, updated_at)
          VALUES ($1, 'client', $2::timestamptz)
          RETURNING id
        `,
        [`S5 Bench ${runId} Client`, nowIso]
      );
      const benchClientId = clientInsert.rows[0].id;

      const projectIds: string[] = [];
      for (let i = 0; i < BENCH_PROJECT_COUNT; i += 1) {
        const result = await client.query<{ id: string }>(
          `
            INSERT INTO projects (client_id, name, scope, is_inbox, updated_at)
            VALUES ($1::uuid, $2, 'client', false, $3::timestamptz)
            RETURNING id
          `,
          [benchClientId, `S5 Bench ${runId} Project ${String(i + 1).padStart(3, '0')}`, nowIso]
        );
        projectIds.push(result.rows[0].id);
      }

      const transcriptIds: string[] = [];
      for (let i = 0; i < BENCH_OPERATION_COUNT; i += 1) {
        const transcriptResult = await client.query<{ id: string }>(
          `
            INSERT INTO transcripts (source_id, title, content, summary, date, raw_json, updated_at)
            VALUES ($1, $2, $3, $4, $5::timestamptz, $6::jsonb, $7::timestamptz)
            RETURNING id
          `,
          [
            `bench:s5:${runId}:transcript:${String(i + 1).padStart(3, '0')}`,
            `S5 Bench Transcript ${String(i + 1).padStart(3, '0')}`,
            `S5 benchmark transcript payload ${i + 1}`,
            null,
            nowIso,
            JSON.stringify({ id: i + 1 }),
            nowIso,
          ]
        );
        const transcriptId = transcriptResult.rows[0].id;
        transcriptIds.push(transcriptId);

        await client.query(
          `
            INSERT INTO transcript_classification (
              transcript_id,
              visibility,
              classification_reason,
              is_weekly_exception,
              normalized_title,
              attendee_count,
              external_attendee_count,
              classified_at,
              updated_at
            )
            VALUES ($1::uuid, 'non_private', 'external_attendee', false, $2, 1, 1, $3::timestamptz, $3::timestamptz)
          `,
          [transcriptId, `s5 bench transcript ${i + 1}`, nowIso]
        );

        await client.query(
          `
            INSERT INTO transcript_project_links (transcript_id, project_id, link_source, updated_at)
            VALUES ($1::uuid, $2::uuid, 'domain_match', $3::timestamptz)
          `,
          [transcriptId, projectIds[i % projectIds.length], nowIso]
        );
      }

      await client.query('COMMIT');
      return { projectIds, transcriptIds };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
  });
}

async function runBenchmarkOperations(
  runId: string,
  projectIds: string[],
  transcriptIds: string[]
): Promise<number[]> {
  const pool = getDbPool();

  return Promise.all(
    Array.from({ length: BENCH_OPERATION_COUNT }, async (_unused, index) => {
      const startedAt = performance.now();

      if (index % 2 === 0) {
        const transcriptId = transcriptIds[index];
        const nextProjectId = projectIds[(index + 1) % projectIds.length];
        await pool.query(
          `
            INSERT INTO transcript_project_links (transcript_id, project_id, link_source, updated_at)
            VALUES ($1::uuid, $2::uuid, 'admin_manual', now())
            ON CONFLICT (transcript_id)
            DO UPDATE SET
              project_id = EXCLUDED.project_id,
              link_source = 'admin_manual',
              updated_at = now()
          `,
          [transcriptId, nextProjectId]
        );

        await emitBenchAuditEvent(
          'bench.s5.admin_api.relink',
          runId,
          { operation: index + 1, transcript_id: transcriptId, project_id: nextProjectId },
          'transcript',
          transcriptId
        );
      } else {
        const projectId = projectIds[index % projectIds.length];
        await pool.query(
          `
            UPDATE projects
            SET overview_markdown = $2,
                updated_at = now()
            WHERE id = $1::uuid
          `,
          [projectId, `# S5 bench overview run=${runId} op=${index + 1}`]
        );

        await emitBenchAuditEvent(
          'bench.s5.admin_api.project_update',
          runId,
          { operation: index + 1, project_id: projectId },
          'project',
          projectId
        );
      }

      return performance.now() - startedAt;
    })
  );
}

async function appendReport(
  runId: string,
  durations: number[],
  startedAtIso: string,
  completedAtIso: string
): Promise<void> {
  const reportPath = path.resolve(process.cwd(), '..', 'docs', 'prd_dev', 'perf', 's5_admin_api_baseline.md');
  await fs.mkdir(path.dirname(reportPath), { recursive: true });

  const p50 = percentile(durations, 50);
  const p95 = percentile(durations, 95);
  const max = Math.max(...durations);
  const min = Math.min(...durations);

  const section = `## Run ${runId}

- Started: ${startedAtIso}
- Completed: ${completedAtIso}
- Dataset: ${BENCH_PROJECT_COUNT} projects
- Concurrent operations: ${BENCH_OPERATION_COUNT}
- Duration P50: ${p50.toFixed(2)}ms
- Duration P95: ${p95.toFixed(2)}ms
- Duration min/max: ${min.toFixed(2)}ms / ${max.toFixed(2)}ms
- Audit event prefix: \`bench.s5.admin_api.*\`
- Notes: append-only report accumulation retained.

`;

  let existing = '';
  try {
    existing = await fs.readFile(reportPath, 'utf-8');
  } catch {
    existing = '# S5 Admin API Baseline\n\nAppend-only run log. Existing sections are never deleted.\n\n';
  }

  await fs.writeFile(reportPath, `${existing}${section}`, 'utf-8');
}

async function main() {
  assertRequiredEnv();

  const runId = `run_${Date.now()}`;
  const nowIso = new Date().toISOString();

  await ensureBenchAdminUser(nowIso);
  await cleanupRunData(runId);

  await emitBenchAuditEvent('bench.s5.admin_api.start', runId, {
    run_id: runId,
    projects: BENCH_PROJECT_COUNT,
    operations: BENCH_OPERATION_COUNT,
  });

  try {
    const { projectIds, transcriptIds } = await seedDataset(runId, nowIso);
    const startedAtIso = new Date().toISOString();
    const durations = await runBenchmarkOperations(runId, projectIds, transcriptIds);
    const completedAtIso = new Date().toISOString();

    await emitBenchAuditEvent('bench.s5.admin_api.complete', runId, {
      run_id: runId,
      p50_ms: Number(percentile(durations, 50).toFixed(2)),
      p95_ms: Number(percentile(durations, 95).toFixed(2)),
    });

    await appendReport(runId, durations, startedAtIso, completedAtIso);

    console.log(
      `[bench-s5-admin-api] run_id=${runId} p95=${percentile(durations, 95).toFixed(2)}ms operations=${BENCH_OPERATION_COUNT}`
    );
  } finally {
    await cleanupRunData(runId);
  }
}

main().catch((error) => {
  console.error('[bench-s5-admin-api] Failed:', error);
  process.exitCode = 1;
});

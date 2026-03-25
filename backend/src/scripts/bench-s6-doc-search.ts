import 'dotenv/config';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { getDbPool, withDbClient } from '../lib/db.js';

const BENCH_DOC_COUNT = 50;
const BENCH_QUERY_COUNT = 500;
const TARGET_P95_MS = 500;

function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

function assertRequiredEnv(): void {
  if (!process.env.SUPABASE_DATABASE_URL) {
    throw new Error('Missing SUPABASE_DATABASE_URL for bench-s6-doc-search');
  }
}

async function seedBenchDocuments(projectId: string): Promise<void> {
  await withDbClient(async (client) => {
    for (let i = 0; i < BENCH_DOC_COUNT; i++) {
      const title = `Bench Doc ${i.toString().padStart(3, '0')} ${['Design', 'Strategy', 'Analysis', 'Overview', 'Report'][i % 5]}`;
      const content = `# ${title}\n\n${'Lorem ipsum dolor sit amet. '.repeat(100 * (1 + (i % 10)))}`;
      const contentHash = createHash('sha256').update(content, 'utf8').digest('hex');
      const sizeBytes = Buffer.byteLength(content, 'utf8');

      await client.query(
        `
          INSERT INTO documents (project_id, title, content, content_hash, visibility_scope, size_bytes)
          VALUES ($1::uuid, $2, $3, $4, $5::document_scope, $6)
          ON CONFLICT (project_id, title) DO NOTHING
        `,
        [projectId, title, content, contentHash, 'project', sizeBytes]
      );
    }
  });
}

async function runSearchBenchmark(projectId: string): Promise<number[]> {
  const queries = [
    'design', 'strategy', 'analysis', 'overview', 'report',
    'bench', 'doc', 'lorem', 'ipsum', 'dolor',
  ];
  const latencies: number[] = [];

  await withDbClient(async (client) => {
    for (let i = 0; i < BENCH_QUERY_COUNT; i++) {
      const query = queries[i % queries.length];
      const start = performance.now();

      await client.query(
        `
          SELECT id, title, visibility_scope, project_id, size_bytes, created_at
          FROM documents
          WHERE title ILIKE $1
            AND project_id = $2::uuid
          ORDER BY created_at DESC
          LIMIT 20
        `,
        [`%${query}%`, projectId]
      );

      latencies.push(performance.now() - start);
    }
  });

  return latencies;
}

async function cleanupBenchDocuments(projectId: string): Promise<void> {
  await withDbClient(async (client) => {
    await client.query(
      `DELETE FROM documents WHERE project_id = $1::uuid AND title LIKE 'Bench Doc %'`,
      [projectId]
    );
  });
}

async function main(): Promise<void> {
  assertRequiredEnv();

  // Use a known project ID from the fixtures
  const projectId = '00000000-0000-0000-0000-000000000103';

  console.log(`[bench:s6] Seeding ${BENCH_DOC_COUNT} documents...`);
  await seedBenchDocuments(projectId);

  console.log(`[bench:s6] Running ${BENCH_QUERY_COUNT} search queries...`);
  const latencies = await runSearchBenchmark(projectId);

  const p50 = percentile(latencies, 50);
  const p95 = percentile(latencies, 95);
  const p99 = percentile(latencies, 99);

  console.log(`[bench:s6] Results: p50=${p50.toFixed(2)}ms p95=${p95.toFixed(2)}ms p99=${p99.toFixed(2)}ms`);

  const status = p95 < TARGET_P95_MS ? 'PASS' : 'WARN';
  console.log(`[bench:s6] Status: ${status} (target p95 < ${TARGET_P95_MS}ms)`);

  // Write results file
  const resultDir = path.resolve(process.cwd(), '..', 'docs', 'prd_dev', 'perf');
  await fs.mkdir(resultDir, { recursive: true });

  const resultContent = [
    '# S6 Document Search Baseline',
    '',
    `**Date**: ${new Date().toISOString()}`,
    `**Dataset**: ${BENCH_DOC_COUNT} documents, ${BENCH_QUERY_COUNT} queries`,
    `**Target**: p95 < ${TARGET_P95_MS}ms`,
    '',
    '## Results',
    '',
    `| Metric | Value |`,
    `|--------|-------|`,
    `| p50 | ${p50.toFixed(2)}ms |`,
    `| p95 | ${p95.toFixed(2)}ms |`,
    `| p99 | ${p99.toFixed(2)}ms |`,
    `| Status | ${status} |`,
    '',
  ].join('\n');

  await fs.writeFile(path.join(resultDir, 's6_document_search_baseline.md'), resultContent);
  console.log(`[bench:s6] Results written to docs/prd_dev/perf/s6_document_search_baseline.md`);

  await cleanupBenchDocuments(projectId);

  const pool = getDbPool();
  await pool.end();

  if (status === 'WARN') {
    console.warn('[bench:s6] WARNING: p95 exceeded target');
  }
}

main().catch((error) => {
  console.error('[bench:s6] Failed:', error);
  process.exit(1);
});

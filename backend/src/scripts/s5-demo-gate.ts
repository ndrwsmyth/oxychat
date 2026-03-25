import 'dotenv/config';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { withDbClient } from '../lib/db.js';
import {
  assertAnyEnvVar,
  assertRequiredEnvVars,
  assertSupabaseServiceRoleKey,
  getRequiredDatabaseHostname,
} from './lib/preflight.js';

interface Step {
  name: string;
  cmd?: string;
  args?: string[];
  run?: () => Promise<void> | void;
}

async function runStep(step: Step, cwd: string): Promise<void> {
  console.log(`[gate:s5] ${step.name}`);
  if (step.run) {
    await step.run();
    return;
  }

  if (!step.cmd) {
    throw new Error(`Step misconfigured: ${step.name}`);
  }

  const result = spawnSync(step.cmd, step.args ?? [], {
    cwd,
    stdio: 'inherit',
    env: process.env,
  });
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error(`Step failed: ${step.name}`);
  }
}

async function verifyS5DatabaseArtifacts(): Promise<void> {
  await withDbClient(async (client) => {
    const lockTable = await client.query<{ rel: string | null }>(
      `SELECT to_regclass('public.transcript_relink_locks') AS rel`
    );
    if (!lockTable.rows[0]?.rel) {
      throw new Error('Missing transcript_relink_locks table');
    }

    const auditCursorIndex = await client.query<{ rel: string | null }>(
      `SELECT to_regclass('public.idx_audit_events_cursor') AS rel`
    );
    if (!auditCursorIndex.rows[0]?.rel) {
      throw new Error('Missing idx_audit_events_cursor index');
    }

    const linkSourceConstraint = await client.query<{ def: string }>(
      `
        SELECT pg_get_constraintdef(oid) AS def
        FROM pg_constraint
        WHERE conname = 'transcript_project_links_link_source_check'
        LIMIT 1
      `
    );
    if (!linkSourceConstraint.rows[0]?.def.includes('admin_manual')) {
      throw new Error('transcript_project_links link_source constraint is missing admin_manual');
    }

    const relinkFunction = await client.query<{ def: string }>(
      `
        SELECT pg_get_functiondef(p.oid) AS def
        FROM pg_proc p
        WHERE p.proname = 'prevent_private_transcript_relink'
        LIMIT 1
      `
    );
    if (!relinkFunction.rows[0]?.def.includes("transcript_visibility IS NULL OR transcript_visibility = 'private'")) {
      throw new Error('prevent_private_transcript_relink is not fail-closed');
    }
  });
}

function verifySchemaSnapshot(backendRoot: string): void {
  const schemaPath = path.resolve(backendRoot, 'schema.sql');
  const schema = readFileSync(schemaPath, 'utf-8');

  const requiredSnippets = [
    'CREATE TABLE transcript_relink_locks',
    'CREATE INDEX idx_audit_events_cursor',
    "'admin_manual'",
    "transcript_visibility IS NULL OR transcript_visibility = 'private'",
  ];

  for (const snippet of requiredSnippets) {
    if (!schema.includes(snippet)) {
      throw new Error(`schema.sql missing required S5 snippet: ${snippet}`);
    }
  }
}

function runPreflight(): void {
  assertRequiredEnvVars('gate:s5', ['SUPABASE_DATABASE_URL', 'SUPABASE_URL', 'SUPABASE_SERVICE_KEY']);
  assertSupabaseServiceRoleKey('gate:s5');
  const hostname = getRequiredDatabaseHostname('gate:s5');
  console.log(`[gate:s5] SUPABASE_DATABASE_URL host: ${hostname}`);

  const presentKey = assertAnyEnvVar('gate:s5', ['ANTHROPIC_API_KEY', 'OPENAI_API_KEY']);
  console.log(`[gate:s5] LLM key preflight ok (${presentKey})`);
}

async function main() {
  const backendRoot = path.resolve(process.cwd());
  runPreflight();

  const steps: Step[] = [
    { name: 'Run Sprint 4 regression gate first', cmd: 'pnpm', args: ['run', 'gate:s4'] },
    { name: 'Reset database to clean state', cmd: 'pnpm', args: ['run', 'db:reset'] },
    { name: 'Backfill transcript attendees', cmd: 'pnpm', args: ['run', 'backfill:transcript-attendees'] },
    {
      name: 'Backfill transcript classification + links',
      cmd: 'pnpm',
      args: ['run', 'backfill:transcript-classification-links'],
    },
    { name: 'Seed Sprint 4 fixtures', cmd: 'pnpm', args: ['run', 'seed:s4'] },
    { name: 'Seed Sprint 5 fixtures', cmd: 'pnpm', args: ['run', 'seed:s5'] },
    { name: 'Verify S5 database artifacts', run: () => verifyS5DatabaseArtifacts() },
    { name: 'Verify schema snapshot includes S5 artifacts', run: () => verifySchemaSnapshot(backendRoot) },
    { name: 'Run backend lint', cmd: 'pnpm', args: ['run', 'lint'] },
    { name: 'Run backend tests', cmd: 'pnpm', args: ['run', 'test'] },
    { name: 'Run Sprint 5 benchmark', cmd: 'pnpm', args: ['run', 'bench:s5'] },
  ];

  for (const step of steps) {
    await runStep(step, backendRoot);
  }

  console.log('[gate:s5] PASS');
}

main().catch((error) => {
  console.error('[gate:s5] Failed:', error);
  process.exitCode = 1;
});

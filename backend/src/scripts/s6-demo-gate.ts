import 'dotenv/config';
import { spawnSync } from 'node:child_process';
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
  console.log(`[gate:s6] ${step.name}`);
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

async function verifyS6DatabaseArtifacts(): Promise<void> {
  await withDbClient(async (client) => {
    const documentsTable = await client.query<{ rel: string | null }>(
      `SELECT to_regclass('public.documents') AS rel`
    );
    if (!documentsTable.rows[0]?.rel) {
      throw new Error('Missing documents table');
    }

    const contentHashIndex = await client.query<{ rel: string | null }>(
      `SELECT to_regclass('public.idx_documents_project_content_hash') AS rel`
    );
    if (!contentHashIndex.rows[0]?.rel) {
      throw new Error('Missing idx_documents_project_content_hash index');
    }

    const titleTrgmIndex = await client.query<{ rel: string | null }>(
      `SELECT to_regclass('public.idx_documents_title_trgm') AS rel`
    );
    if (!titleTrgmIndex.rows[0]?.rel) {
      throw new Error('Missing idx_documents_title_trgm index');
    }

    const titleUniqueIndex = await client.query<{ rel: string | null }>(
      `SELECT to_regclass('public.idx_documents_project_title') AS rel`
    );
    if (!titleUniqueIndex.rows[0]?.rel) {
      throw new Error('Missing idx_documents_project_title index');
    }

    console.log('[gate:s6] All S6 database artifacts verified');
  });
}

async function main(): Promise<void> {
  const cwd = process.cwd();
  const frontendCwd = `${cwd}/../frontend`;

  assertRequiredEnvVars('gate:s6', ['SUPABASE_URL', 'SUPABASE_SERVICE_KEY']);
  assertAnyEnvVar('gate:s6', ['SUPABASE_DATABASE_URL', 'DATABASE_URL']);
  assertSupabaseServiceRoleKey('gate:s6');

  const dbHostname = getRequiredDatabaseHostname('gate:s6');
  console.log(`[gate:s6] Database: ${dbHostname}`);

  const steps: Step[] = [
    // S5 regression gate (includes S1-S4)
    {
      name: 'Run S5 regression gate',
      cmd: 'pnpm',
      args: ['run', 'gate:s5'],
    },
    // S6 database verification
    {
      name: 'Verify S6 database artifacts',
      run: verifyS6DatabaseArtifacts,
    },
    // Backend lint + tests
    {
      name: 'Backend lint',
      cmd: 'pnpm',
      args: ['run', 'lint'],
    },
    {
      name: 'Backend tests',
      cmd: 'pnpm',
      args: ['test'],
    },
    // Document search benchmark
    {
      name: 'Document search benchmark',
      cmd: 'pnpm',
      args: ['run', 'bench:s6'],
    },
    // Frontend
    {
      name: 'Frontend lint',
      cmd: 'pnpm',
      args: ['run', 'lint'],
    },
    {
      name: 'Frontend tests',
      cmd: 'pnpm',
      args: ['test'],
    },
    {
      name: 'Frontend build',
      cmd: 'pnpm',
      args: ['run', 'build'],
    },
  ];

  // Run backend steps from backend cwd, frontend steps from frontend cwd
  for (const step of steps) {
    const stepCwd = step.name.startsWith('Frontend') ? frontendCwd : cwd;
    await runStep(step, stepCwd);
  }

  console.log('[gate:s6] All Sprint 6 gates PASSED');
}

main().catch((error) => {
  console.error('[gate:s6] FAILED:', error);
  process.exit(1);
});

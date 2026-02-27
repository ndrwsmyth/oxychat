import 'dotenv/config';
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
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
  run?: () => void;
}

function runStep(step: Step, cwd: string): void {
  console.log(`[gate:s4] ${step.name}`);
  if (step.run) {
    step.run();
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

function verifyBenchmarkReportHeaders(repoRoot: string): void {
  const reportFiles = [
    path.resolve(repoRoot, 'docs', 'prd_dev', 'perf', 's4_mention_baseline.md'),
    path.resolve(repoRoot, 'docs', 'prd_dev', 'perf', 's4_chat_latency_baseline.md'),
  ];
  const requiredHeaders = ['Generated at:', 'Policy:', 'Status:'];

  for (const file of reportFiles) {
    if (!existsSync(file)) {
      throw new Error(`Missing benchmark report: ${file}`);
    }

    const content = readFileSync(file, 'utf-8');
    const missingHeaders = requiredHeaders.filter((header) => !content.includes(header));
    if (missingHeaders.length > 0) {
      throw new Error(`Benchmark report missing header(s) ${missingHeaders.join(', ')}: ${file}`);
    }
  }
}

function runPreflight(): void {
  assertRequiredEnvVars('gate:s4', ['SUPABASE_DATABASE_URL', 'SUPABASE_URL', 'SUPABASE_SERVICE_KEY']);
  assertSupabaseServiceRoleKey('gate:s4');
  const hostname = getRequiredDatabaseHostname('gate:s4');
  console.log(`[gate:s4] SUPABASE_DATABASE_URL host: ${hostname}`);

  const presentKey = assertAnyEnvVar('gate:s4', ['ANTHROPIC_API_KEY', 'OPENAI_API_KEY']);
  console.log(`[gate:s4] LLM key preflight ok (${presentKey})`);
}

function main() {
  const backendRoot = path.resolve(process.cwd());
  const repoRoot = path.resolve(backendRoot, '..');
  runPreflight();

  const steps: Step[] = [
    { name: 'Reset database to clean state', cmd: 'pnpm', args: ['run', 'db:reset'] },
    { name: 'Backfill transcript attendees', cmd: 'pnpm', args: ['run', 'backfill:transcript-attendees'] },
    {
      name: 'Backfill transcript classification + links',
      cmd: 'pnpm',
      args: ['run', 'backfill:transcript-classification-links'],
    },
    { name: 'Seed Sprint 4 fixtures', cmd: 'pnpm', args: ['run', 'seed:s4'] },
    { name: 'Run backend lint', cmd: 'pnpm', args: ['run', 'lint'] },
    { name: 'Run backend tests', cmd: 'pnpm', args: ['run', 'test'] },
    { name: 'Run frontend lint', cmd: 'pnpm', args: ['--dir', '../frontend', 'run', 'lint'] },
    { name: 'Run frontend tests', cmd: 'pnpm', args: ['--dir', '../frontend', 'run', 'test:run'] },
    { name: 'Run frontend build', cmd: 'pnpm', args: ['--dir', '../frontend', 'run', 'build'] },
    { name: 'Run Sprint 3 regression gate', cmd: 'pnpm', args: ['run', 'gate:s3'] },
    { name: 'Run Sprint 4 mention benchmark', cmd: 'pnpm', args: ['run', 'bench:s4-mentions'] },
    { name: 'Run Sprint 4 chat latency benchmark', cmd: 'pnpm', args: ['run', 'bench:s4-chat-latency'] },
    {
      name: 'Verify benchmark report headers',
      run: () => verifyBenchmarkReportHeaders(repoRoot),
    },
  ];

  for (const step of steps) {
    runStep(step, backendRoot);
  }

  console.log('[gate:s4] PASS');
}

try {
  main();
} catch (error) {
  console.error('[gate:s4] Failed:', error);
  process.exitCode = 1;
}

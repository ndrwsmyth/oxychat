import { spawnSync } from 'node:child_process';
import path from 'node:path';

interface Step {
  name: string;
  cmd: string;
  args: string[];
}

function runStep(step: Step, cwd: string): void {
  console.log(`[gate:s1] ${step.name}`);

  const result = spawnSync(step.cmd, step.args, {
    cwd,
    stdio: 'inherit',
    env: process.env,
  });

  if (result.status !== 0) {
    throw new Error(`Step failed: ${step.name}`);
  }
}

function main() {
  const backendRoot = path.resolve(process.cwd());

  const steps: Step[] = [
    { name: 'Apply migrations', cmd: 'pnpm', args: ['run', 'migrate:up'] },
    { name: 'Backfill conversations.project_id', cmd: 'pnpm', args: ['run', 'backfill:conversation-project'] },
    { name: 'Zero-null gate', cmd: 'pnpm', args: ['run', 'check:conversation-project-nulls'] },
    { name: 'Seed Sprint 1 fixtures', cmd: 'pnpm', args: ['run', 'seed:s1'] },
    { name: 'Run backend test suite', cmd: 'pnpm', args: ['run', 'test'] },
    { name: 'Run workspace tree baseline benchmark', cmd: 'pnpm', args: ['run', 'bench:workspaces-tree'] },
  ];

  for (const step of steps) {
    runStep(step, backendRoot);
  }

  console.log('[gate:s1] PASS');
}

try {
  main();
} catch (error) {
  console.error('[gate:s1] Failed:', error);
  process.exitCode = 1;
}

import { spawnSync } from 'node:child_process';
import path from 'node:path';

interface Step {
  name: string;
  cmd: string;
  args: string[];
}

function runStep(step: Step, cwd: string): void {
  console.log(`[gate:s3] ${step.name}`);
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
    { name: 'Reset database to clean state', cmd: 'pnpm', args: ['run', 'db:reset'] },
    { name: 'Backfill transcript attendees', cmd: 'pnpm', args: ['run', 'backfill:transcript-attendees'] },
    {
      name: 'Backfill transcript classification + links',
      cmd: 'pnpm',
      args: ['run', 'backfill:transcript-classification-links'],
    },
    { name: 'Seed Sprint 3 fixtures', cmd: 'pnpm', args: ['run', 'seed:s3'] },
    { name: 'Run backend lint', cmd: 'pnpm', args: ['run', 'lint'] },
    { name: 'Run backend test suite', cmd: 'pnpm', args: ['run', 'test'] },
    { name: 'Run Sprint 3 sidebar benchmark', cmd: 'pnpm', args: ['run', 'bench:s3-sidebar'] },
    { name: 'Run frontend lint', cmd: 'pnpm', args: ['--dir', '../frontend', 'run', 'lint'] },
    { name: 'Run frontend tests', cmd: 'pnpm', args: ['--dir', '../frontend', 'run', 'test:run'] },
    { name: 'Run frontend build', cmd: 'pnpm', args: ['--dir', '../frontend', 'run', 'build'] },
    { name: 'Run Sprint 2 regression gate', cmd: 'pnpm', args: ['run', 'gate:s2'] },
  ];

  for (const step of steps) {
    runStep(step, backendRoot);
  }

  console.log('[gate:s3] PASS');
}

try {
  main();
} catch (error) {
  console.error('[gate:s3] Failed:', error);
  process.exitCode = 1;
}

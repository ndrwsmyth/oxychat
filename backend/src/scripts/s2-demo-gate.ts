import { spawnSync } from 'node:child_process';
import path from 'node:path';

interface Step {
  name: string;
  cmd: string;
  args: string[];
}

function runStep(step: Step, cwd: string): void {
  console.log(`[gate:s2] ${step.name}`);
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
    { name: 'Seed Sprint 2 fixtures', cmd: 'pnpm', args: ['run', 'seed:s2'] },
    { name: 'Run backend test suite', cmd: 'pnpm', args: ['run', 'test'] },
    { name: 'Run classification benchmark', cmd: 'pnpm', args: ['run', 'bench:transcript-classification'] },
    { name: 'Run Sprint 1 regression gate', cmd: 'pnpm', args: ['run', 'gate:s1'] },
  ];

  for (const step of steps) {
    runStep(step, backendRoot);
  }

  console.log('[gate:s2] PASS');
}

try {
  main();
} catch (error) {
  console.error('[gate:s2] Failed:', error);
  process.exitCode = 1;
}

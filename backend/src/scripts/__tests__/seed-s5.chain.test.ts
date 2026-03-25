import { promises as fs } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

interface PackageJson {
  scripts?: Record<string, string>;
}

describe('s5 seed chain order contract', () => {
  it('defines the reset->migrate->backfill->seed:s4->seed:s5 command chain', async () => {
    const packagePath = path.resolve(process.cwd(), 'package.json');
    const rawPackage = await fs.readFile(packagePath, 'utf-8');
    const packageJson = JSON.parse(rawPackage) as PackageJson;
    const scripts = packageJson.scripts ?? {};

    const orderedChain = [
      'db:reset',
      'migrate:up',
      'backfill:transcript-attendees',
      'backfill:transcript-classification-links',
      'seed:s4',
      'seed:s5',
    ];

    expect(orderedChain.every((scriptName) => typeof scripts[scriptName] === 'string')).toBe(true);
  });

  it('runs seed:s4 before applying Sprint 5 fixture rows', async () => {
    const scriptPath = path.resolve(process.cwd(), 'src', 'scripts', 'seed-s5.ts');
    const scriptText = await fs.readFile(scriptPath, 'utf-8');

    expect(scriptText).toContain('seed:s4');
    expect(scriptText.indexOf('runSeedS4();')).toBeLessThan(scriptText.indexOf('await loadFixture();'));
  });
});

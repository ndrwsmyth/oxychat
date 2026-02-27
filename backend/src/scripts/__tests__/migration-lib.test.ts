import { describe, expect, it } from 'vitest';
import { loadMigrationFiles, parseStepArg } from '../migrations/lib.js';

describe('migration lib', () => {
  it('loads ordered up/down migration pairs', async () => {
    const migrations = await loadMigrationFiles();
    expect(migrations.length).toBeGreaterThan(0);
    expect(migrations[0].id).toBe('0001_s1_t00b_user_profiles_clerk_context');
    expect(migrations[migrations.length - 1].id).toBe('0020_s4_t01_projects_overview_markdown');
  });

  it('parses --step with default fallback', () => {
    const originalArgv = [...process.argv];

    process.argv = ['node', 'script.ts'];
    expect(parseStepArg(3)).toBe(3);

    process.argv = ['node', 'script.ts', '--step', '2'];
    expect(parseStepArg()).toBe(2);

    process.argv = originalArgv;
  });
});

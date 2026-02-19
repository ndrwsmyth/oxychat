import 'dotenv/config';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { closeDbPool, withDbClient } from '../lib/db.js';
import {
  ensureMigrationTable,
  getAppliedMigrations,
  loadMigrationFiles,
  runMigrationTransaction,
  verifyAppliedChecksums,
} from './migrations/lib.js';
import { spawnSync } from 'node:child_process';

function parseFlags(): { withSeed: boolean } {
  return {
    withSeed: process.argv.includes('--seed'),
  };
}

async function dropAndRecreatePublicSchema(): Promise<void> {
  await withDbClient(async (client) => {
    await client.query('DROP SCHEMA IF EXISTS public CASCADE');
    await client.query('CREATE SCHEMA public');
    await client.query('GRANT ALL ON SCHEMA public TO postgres');
  });
}

async function restoreSupabaseRoleGrants(): Promise<void> {
  await withDbClient(async (client) => {
    await client.query('GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role');
    await client.query(
      'GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role'
    );
    await client.query(
      'GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role'
    );
    await client.query(
      'GRANT ALL PRIVILEGES ON ALL ROUTINES IN SCHEMA public TO anon, authenticated, service_role'
    );
    await client.query(
      'ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role'
    );
    await client.query(
      'ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated, service_role'
    );
    await client.query(
      'ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON ROUTINES TO anon, authenticated, service_role'
    );
  });
}

async function applyBaselineSchema(): Promise<void> {
  const schemaPath = path.resolve(process.cwd(), 'schema.sql');
  const schemaSql = await fs.readFile(schemaPath, 'utf-8');

  await withDbClient(async (client) => {
    await client.query(schemaSql);
  });
}

async function applyAllMigrations(): Promise<number> {
  return withDbClient(async (client) => {
    await ensureMigrationTable(client);

    const migrations = await loadMigrationFiles();
    await verifyAppliedChecksums(client, migrations);

    const applied = await getAppliedMigrations(client);
    const appliedIds = new Set(applied.map((migration) => migration.id));
    const pending = migrations.filter((migration) => !appliedIds.has(migration.id));

    for (const migration of pending) {
      console.log(`[db:reset] Applying migration ${migration.id}`);
      await runMigrationTransaction(client, migration.upSql, async () => {
        await client.query('INSERT INTO schema_migrations (id, checksum) VALUES ($1, $2)', [
          migration.id,
          migration.checksum,
        ]);
      });
    }

    return pending.length;
  });
}

function runSeedScript(): void {
  const result = spawnSync('pnpm', ['run', 'seed:s1'], {
    cwd: process.cwd(),
    stdio: 'inherit',
    env: process.env,
  });

  if (result.status !== 0) {
    throw new Error('Failed to run seed:s1');
  }
}

async function main() {
  const flags = parseFlags();

  console.log('[db:reset] Dropping and recreating public schema');
  await dropAndRecreatePublicSchema();

  console.log('[db:reset] Applying baseline schema.sql');
  await applyBaselineSchema();

  console.log('[db:reset] Applying versioned migrations');
  const appliedCount = await applyAllMigrations();
  console.log(`[db:reset] Applied ${appliedCount} migration(s)`);

  console.log('[db:reset] Restoring Supabase role grants');
  await restoreSupabaseRoleGrants();

  if (flags.withSeed) {
    console.log('[db:reset] Running seed:s1');
    runSeedScript();
  }

  console.log('[db:reset] Complete');
}

main()
  .catch((error) => {
    console.error('[db:reset] Failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeDbPool();
  });

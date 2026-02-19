import 'dotenv/config';
import { closeDbPool, withDbClient } from '../../lib/db.js';
import {
  ensureMigrationTable,
  getAppliedMigrations,
  loadMigrationFiles,
  parseArgValue,
  runMigrationTransaction,
  verifyAppliedChecksums,
} from './lib.js';

async function main() {
  const to = parseArgValue('--to');

  await withDbClient(async (client) => {
    await ensureMigrationTable(client);
    const migrations = await loadMigrationFiles();
    await verifyAppliedChecksums(client, migrations);

    const applied = await getAppliedMigrations(client);
    const appliedIds = new Set(applied.map((m) => m.id));

    const pending = migrations.filter((migration) => !appliedIds.has(migration.id));
    const targetPending = to
      ? pending.filter((migration) => migration.id.localeCompare(to) <= 0)
      : pending;

    if (to && !migrations.some((migration) => migration.id === to)) {
      throw new Error(`Unknown migration id for --to: ${to}`);
    }

    if (targetPending.length === 0) {
      console.log('[migrate:up] No pending migrations');
      return;
    }

    for (const migration of targetPending) {
      console.log(`[migrate:up] Applying ${migration.id}`);
      await runMigrationTransaction(client, migration.upSql, async () => {
        await client.query(
          'INSERT INTO schema_migrations (id, checksum) VALUES ($1, $2)',
          [migration.id, migration.checksum]
        );
      });
    }

    console.log(`[migrate:up] Applied ${targetPending.length} migration(s)`);
  });
}

main()
  .catch((error) => {
    console.error('[migrate:up] Failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeDbPool();
  });

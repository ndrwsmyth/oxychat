import 'dotenv/config';
import { closeDbPool, withDbClient } from '../../lib/db.js';
import {
  ensureMigrationTable,
  getAppliedMigrations,
  loadMigrationFiles,
  parseArgValue,
  parseStepArg,
  runMigrationTransaction,
  verifyAppliedChecksums,
} from './lib.js';

async function main() {
  const to = parseArgValue('--to');
  const step = parseStepArg(1);

  await withDbClient(async (client) => {
    await ensureMigrationTable(client);

    const migrations = await loadMigrationFiles();
    await verifyAppliedChecksums(client, migrations);

    const appliedAsc = await getAppliedMigrations(client);
    const byId = new Map(migrations.map((migration) => [migration.id, migration]));

    let candidates = [...appliedAsc].sort((a, b) => b.id.localeCompare(a.id));

    if (to) {
      if (!migrations.some((migration) => migration.id === to)) {
        throw new Error(`Unknown migration id for --to: ${to}`);
      }
      candidates = candidates.filter((migration) => migration.id.localeCompare(to) > 0);
    } else {
      candidates = candidates.slice(0, step);
    }

    if (candidates.length === 0) {
      console.log('[migrate:down] No migrations to rollback');
      return;
    }

    for (const applied of candidates) {
      const migration = byId.get(applied.id);
      if (!migration) {
        throw new Error(`Missing migration file for applied migration ${applied.id}`);
      }

      console.log(`[migrate:down] Rolling back ${migration.id}`);
      await runMigrationTransaction(client, migration.downSql, async () => {
        await client.query('DELETE FROM schema_migrations WHERE id = $1', [migration.id]);
      });
    }

    console.log(`[migrate:down] Rolled back ${candidates.length} migration(s)`);
  });
}

main()
  .catch((error) => {
    console.error('[migrate:down] Failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeDbPool();
  });

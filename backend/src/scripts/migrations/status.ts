import 'dotenv/config';
import { closeDbPool, withDbClient } from '../../lib/db.js';
import {
  ensureMigrationTable,
  getAppliedMigrations,
  loadMigrationFiles,
  verifyAppliedChecksums,
} from './lib.js';

async function main() {
  await withDbClient(async (client) => {
    await ensureMigrationTable(client);

    const migrations = await loadMigrationFiles();
    await verifyAppliedChecksums(client, migrations);

    const applied = await getAppliedMigrations(client);
    const appliedMap = new Map(applied.map((migration) => [migration.id, migration]));

    const rows = migrations.map((migration) => {
      const record = appliedMap.get(migration.id);
      return {
        id: migration.id,
        status: record ? 'applied' : 'pending',
        applied_at: record?.applied_at ?? '-',
      };
    });

    console.table(rows);
  });
}

main()
  .catch((error) => {
    console.error('[migrate:status] Failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeDbPool();
  });

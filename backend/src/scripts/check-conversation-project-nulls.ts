import 'dotenv/config';
import { withDbClient, closeDbPool } from '../lib/db.js';

async function main() {
  await withDbClient(async (client) => {
    const { rows } = await client.query<{ null_count: string }>(
      'SELECT COUNT(*)::text AS null_count FROM conversations WHERE project_id IS NULL'
    );

    const nullCount = Number(rows[0]?.null_count ?? '0');
    if (nullCount !== 0) {
      throw new Error(`Expected zero NULL conversations.project_id rows, found ${nullCount}`);
    }

    console.log('[check:conversation-project-nulls] PASS (null_count = 0)');
  });
}

main()
  .catch((error) => {
    console.error('[check:conversation-project-nulls] Failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeDbPool();
  });

import { Pool, type PoolClient } from 'pg';

let pool: Pool | null = null;

function getConnectionString(): string {
  const connectionString = process.env.SUPABASE_DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      'SUPABASE_DATABASE_URL is required (set it in backend/.env or export it in your shell before running migration/DB scripts)'
    );
  }
  return connectionString;
}

export function getDbPool(): Pool {
  if (!pool) {
    pool = new Pool({ connectionString: getConnectionString() });
  }
  return pool;
}

export async function withDbClient<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await getDbPool().connect();
  try {
    return await fn(client);
  } finally {
    client.release();
  }
}

export async function closeDbPool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

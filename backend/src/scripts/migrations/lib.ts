import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { PoolClient } from 'pg';

export interface MigrationFile {
  id: string;
  upPath: string;
  downPath: string;
  upSql: string;
  downSql: string;
  checksum: string;
}

export interface AppliedMigration {
  id: string;
  checksum: string;
  applied_at: string;
}

const UP_SUFFIX = '.up.sql';
const DOWN_SUFFIX = '.down.sql';

function migrationsDir(): string {
  return path.resolve(process.cwd(), 'migrations');
}

function sha256(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

export async function ensureMigrationTable(client: PoolClient): Promise<void> {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id TEXT PRIMARY KEY,
      checksum TEXT NOT NULL,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
}

export async function loadMigrationFiles(): Promise<MigrationFile[]> {
  const dir = migrationsDir();
  const files = await fs.readdir(dir);

  const upFiles = files
    .filter((file) => file.endsWith(UP_SUFFIX))
    .sort((a, b) => a.localeCompare(b));

  const migrations: MigrationFile[] = [];

  for (const upFile of upFiles) {
    const id = upFile.slice(0, -UP_SUFFIX.length);
    const downFile = `${id}${DOWN_SUFFIX}`;

    if (!files.includes(downFile)) {
      throw new Error(`Missing down migration for ${id}: ${downFile}`);
    }

    const upPath = path.join(dir, upFile);
    const downPath = path.join(dir, downFile);
    const upSql = await fs.readFile(upPath, 'utf-8');
    const downSql = await fs.readFile(downPath, 'utf-8');

    migrations.push({
      id,
      upPath,
      downPath,
      upSql,
      downSql,
      checksum: sha256(upSql),
    });
  }

  return migrations;
}

export async function getAppliedMigrations(client: PoolClient): Promise<AppliedMigration[]> {
  const { rows } = await client.query<AppliedMigration>(
    'SELECT id, checksum, applied_at FROM schema_migrations ORDER BY id ASC'
  );
  return rows;
}

export function parseArgValue(flag: string): string | undefined {
  const index = process.argv.findIndex((arg) => arg === flag);
  if (index === -1) return undefined;
  return process.argv[index + 1];
}

export function parseStepArg(defaultValue = 1): number {
  const raw = parseArgValue('--step');
  if (!raw) return defaultValue;
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`Invalid --step value: ${raw}`);
  }
  return parsed;
}

export async function verifyAppliedChecksums(
  client: PoolClient,
  migrations: MigrationFile[]
): Promise<void> {
  const applied = await getAppliedMigrations(client);
  const byId = new Map(migrations.map((m) => [m.id, m]));

  for (const row of applied) {
    const file = byId.get(row.id);
    if (!file) {
      throw new Error(`Applied migration ${row.id} not found on disk`);
    }
    if (file.checksum !== row.checksum) {
      throw new Error(
        `Checksum mismatch for ${row.id}. Expected ${row.checksum}, found ${file.checksum}`
      );
    }
  }
}

export async function runMigrationTransaction(
  client: PoolClient,
  sql: string,
  onCommit: () => Promise<void>
): Promise<void> {
  await client.query('BEGIN');
  try {
    await client.query(sql);
    await onCommit();
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
}

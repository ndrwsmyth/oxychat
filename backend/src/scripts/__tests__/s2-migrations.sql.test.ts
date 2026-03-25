import { describe, expect, it } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';

async function readMigration(name: string): Promise<string> {
  return fs.readFile(path.resolve(process.cwd(), 'migrations', name), 'utf-8');
}

describe('Sprint 2 migration contracts', () => {
  it('creates transcript classification table with unique transcript constraint', async () => {
    const sql = await readMigration('0014_s2_t01_transcript_classification.up.sql');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS transcript_classification');
    expect(sql).toContain('transcript_id UUID PRIMARY KEY');
  });

  it('creates transcript project links table with uniqueness guards', async () => {
    const sql = await readMigration('0015_s2_t02_transcript_project_links.up.sql');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS transcript_project_links');
    expect(sql).toContain('UNIQUE(transcript_id, project_id)');
  });

  it('adds dedicated transcript visibility RLS function + policies', async () => {
    const sql = await readMigration('0018_s2_t15_transcript_rls_defense.up.sql');
    expect(sql).toContain('CREATE OR REPLACE FUNCTION user_can_view_transcript');
    expect(sql).toContain('CREATE POLICY "Users can view visible transcripts"');
  });

  it('adds fail-closed relink guard + admin_manual link source contract', async () => {
    const upSql = await readMigration('0021_s5_sec00_relink_fail_closed_and_link_source.up.sql');
    const downSql = await readMigration('0021_s5_sec00_relink_fail_closed_and_link_source.down.sql');

    expect(upSql).toContain("transcript_visibility IS NULL OR transcript_visibility = 'private'");
    expect(upSql).toContain("'admin_manual'");
    expect(downSql).toContain("DELETE FROM transcript_project_links");
    expect(downSql).toContain("IF transcript_visibility = 'private' THEN");
  });

  it('adds transcript relink lock table with owner-scoped foreign key', async () => {
    const upSql = await readMigration('0022_s5_t06_relink_locks.up.sql');
    const downSql = await readMigration('0022_s5_t06_relink_locks.down.sql');

    expect(upSql).toContain('CREATE TABLE IF NOT EXISTS transcript_relink_locks');
    expect(upSql).toContain('locked_by UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE');
    expect(upSql).toContain('expires_at TIMESTAMPTZ NOT NULL');
    expect(downSql).toContain('DROP TABLE IF EXISTS transcript_relink_locks');
  });

  it('replaces audit created_at index with composite cursor index', async () => {
    const upSql = await readMigration('0023_s5_t08_audit_cursor_index.up.sql');
    const downSql = await readMigration('0023_s5_t08_audit_cursor_index.down.sql');

    expect(upSql).toContain('DROP INDEX IF EXISTS idx_audit_events_created_at');
    expect(upSql).toContain('CREATE INDEX IF NOT EXISTS idx_audit_events_cursor');
    expect(upSql).toContain('ON audit_events(created_at DESC, id DESC)');
    expect(downSql).toContain('CREATE INDEX IF NOT EXISTS idx_audit_events_created_at');
  });
});

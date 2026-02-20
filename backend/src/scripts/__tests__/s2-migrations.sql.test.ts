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
});

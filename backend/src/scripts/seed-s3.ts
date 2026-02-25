import 'dotenv/config';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { getSupabase } from '../lib/supabase.js';

interface ClientFixture {
  id: string;
  name: string;
  scope: 'personal' | 'client' | 'global';
}

interface ProjectFixture {
  id: string;
  client_id: string;
  name: string;
  scope: 'personal' | 'client' | 'global';
  is_inbox: boolean;
}

interface MembershipFixture {
  user_id: string;
  client_id?: string;
  project_id?: string;
  role: 'admin' | 'member';
}

interface ConversationFixture {
  id: string;
  user_id: string;
  project_id: string;
  title: string;
  model: string;
}

interface TranscriptProjectLinkFixture {
  transcript_id: string;
  project_id: string;
  link_source: 'domain_match' | 'title_alias' | 'client_inbox_fallback' | 'global_triage_fallback';
}

interface SeedFixture {
  clients: ClientFixture[];
  projects: ProjectFixture[];
  client_memberships: MembershipFixture[];
  project_memberships: MembershipFixture[];
  conversations: ConversationFixture[];
  transcript_project_links: TranscriptProjectLinkFixture[];
}

function runSeedS2(): void {
  const result = spawnSync('pnpm', ['run', 'seed:s2'], {
    cwd: process.cwd(),
    stdio: 'inherit',
    env: process.env,
  });
  if (result.status !== 0) {
    throw new Error('seed:s2 failed');
  }
}

async function loadFixture(): Promise<SeedFixture> {
  const fixturePath = path.resolve(process.cwd(), 'seeds', 's3.fixture.json');
  const raw = await fs.readFile(fixturePath, 'utf-8');
  return JSON.parse(raw) as SeedFixture;
}

async function main() {
  runSeedS2();

  const fixture = await loadFixture();
  const supabase = getSupabase();
  const now = new Date().toISOString();

  if (fixture.clients.length > 0) {
    const { error } = await supabase.from('clients').upsert(
      fixture.clients.map((client) => ({
        ...client,
        updated_at: now,
      })),
      { onConflict: 'id' }
    );

    if (error) {
      throw new Error(`Failed to upsert Sprint 3 clients: ${error.message}`);
    }
  }

  if (fixture.projects.length > 0) {
    const { error } = await supabase.from('projects').upsert(
      fixture.projects.map((project) => ({
        ...project,
        updated_at: now,
      })),
      { onConflict: 'id' }
    );

    if (error) {
      throw new Error(`Failed to upsert Sprint 3 projects: ${error.message}`);
    }
  }

  if (fixture.client_memberships.length > 0) {
    const { error } = await supabase
      .from('client_memberships')
      .upsert(fixture.client_memberships, { onConflict: 'user_id,client_id' });

    if (error) {
      throw new Error(`Failed to upsert Sprint 3 client memberships: ${error.message}`);
    }
  }

  if (fixture.project_memberships.length > 0) {
    const { error } = await supabase
      .from('project_memberships')
      .upsert(fixture.project_memberships, { onConflict: 'user_id,project_id' });

    if (error) {
      throw new Error(`Failed to upsert Sprint 3 project memberships: ${error.message}`);
    }
  }

  if (fixture.conversations.length > 0) {
    const { error } = await supabase.from('conversations').upsert(
      fixture.conversations.map((conversation) => ({
        ...conversation,
        updated_at: now,
      })),
      { onConflict: 'id' }
    );

    if (error) {
      throw new Error(`Failed to upsert Sprint 3 conversations: ${error.message}`);
    }
  }

  if (fixture.transcript_project_links.length > 0) {
    const { error } = await supabase.from('transcript_project_links').upsert(
      fixture.transcript_project_links.map((row) => ({
        ...row,
        updated_at: now,
      })),
      { onConflict: 'transcript_id' }
    );

    if (error) {
      throw new Error(`Failed to upsert Sprint 3 transcript links: ${error.message}`);
    }
  }

  console.log('[seed:s3] Seeded Sprint 3 fixture successfully');
}

main().catch((error) => {
  console.error('[seed:s3] Failed:', error);
  process.exitCode = 1;
});

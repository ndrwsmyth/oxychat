import 'dotenv/config';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { getSupabase } from '../lib/supabase.js';
import { ensurePersonalWorkspace } from '../lib/workspace-bootstrap.js';

interface UserFixture {
  id: string;
  email: string;
  clerk_id: string;
  full_name: string;
  is_admin: boolean;
}

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

interface SeedFixture {
  users: UserFixture[];
  clients: ClientFixture[];
  projects: ProjectFixture[];
  client_memberships: MembershipFixture[];
  project_memberships: MembershipFixture[];
  conversations: ConversationFixture[];
}

async function loadFixture(): Promise<SeedFixture> {
  const fixturePath = path.resolve(process.cwd(), 'seeds', 's1.fixture.json');
  const raw = await fs.readFile(fixturePath, 'utf-8');
  return JSON.parse(raw) as SeedFixture;
}

async function main() {
  const fixture = await loadFixture();
  const supabase = getSupabase();
  const now = new Date().toISOString();

  const { error: userError } = await supabase.from('user_profiles').upsert(
    fixture.users.map((user) => ({
      id: user.id,
      email: user.email,
      clerk_id: user.clerk_id,
      full_name: user.full_name,
      updated_at: now,
    })),
    { onConflict: 'id' }
  );

  if (userError) {
    throw new Error(`Failed to upsert user profiles: ${userError.message}`);
  }

  const { error: roleError } = await supabase.from('user_roles').upsert(
    fixture.users.map((user) => ({
      user_id: user.id,
      role: user.is_admin ? 'admin' : 'member',
      updated_at: now,
    })),
    { onConflict: 'user_id' }
  );

  if (roleError) {
    throw new Error(`Failed to upsert user roles: ${roleError.message}`);
  }

  const { error: clientError } = await supabase.from('clients').upsert(
    fixture.clients.map((client) => ({
      id: client.id,
      name: client.name,
      scope: client.scope,
      updated_at: now,
    })),
    { onConflict: 'id' }
  );

  if (clientError) {
    throw new Error(`Failed to upsert clients: ${clientError.message}`);
  }

  const { error: projectError } = await supabase.from('projects').upsert(
    fixture.projects.map((project) => ({
      id: project.id,
      client_id: project.client_id,
      name: project.name,
      scope: project.scope,
      is_inbox: project.is_inbox,
      updated_at: now,
    })),
    { onConflict: 'id' }
  );

  if (projectError) {
    throw new Error(`Failed to upsert projects: ${projectError.message}`);
  }

  const { error: clientMembershipError } = await supabase.from('client_memberships').upsert(
    fixture.client_memberships.map((membership) => ({
      user_id: membership.user_id,
      client_id: membership.client_id,
      role: membership.role,
    })),
    { onConflict: 'user_id,client_id' }
  );

  if (clientMembershipError) {
    throw new Error(`Failed to upsert client memberships: ${clientMembershipError.message}`);
  }

  const { error: projectMembershipError } = await supabase
    .from('project_memberships')
    .upsert(
      fixture.project_memberships.map((membership) => ({
        user_id: membership.user_id,
        project_id: membership.project_id,
        role: membership.role,
      })),
      { onConflict: 'user_id,project_id' }
    );

  if (projectMembershipError) {
    throw new Error(`Failed to upsert project memberships: ${projectMembershipError.message}`);
  }

  for (const user of fixture.users) {
    await ensurePersonalWorkspace(user.id, user.email);
  }

  const { error: conversationError } = await supabase.from('conversations').upsert(
    fixture.conversations.map((conversation) => ({
      id: conversation.id,
      user_id: conversation.user_id,
      project_id: conversation.project_id,
      title: conversation.title,
      model: conversation.model,
      updated_at: now,
    })),
    { onConflict: 'id' }
  );

  if (conversationError) {
    throw new Error(`Failed to upsert conversations: ${conversationError.message}`);
  }

  console.log('[seed:s1] Seeded Sprint 1 fixture successfully');
}

main().catch((error) => {
  console.error('[seed:s1] Failed:', error);
  process.exitCode = 1;
});

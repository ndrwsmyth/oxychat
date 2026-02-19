import { getSupabase } from './supabase.js';
import { isAdmin } from './acl.js';

export interface WorkspaceTreeProject {
  id: string;
  name: string;
  scope: 'personal' | 'client' | 'global';
  client_id: string;
  conversation_count: number;
}

export interface WorkspaceTreeClient {
  id: string;
  name: string;
  scope: 'personal' | 'client' | 'global';
  projects: WorkspaceTreeProject[];
}

interface ClientRow {
  id: string;
  name: string;
  scope: 'personal' | 'client' | 'global';
  owner_user_id: string | null;
}

interface ProjectRow {
  id: string;
  client_id: string;
  name: string;
  scope: 'personal' | 'client' | 'global';
  owner_user_id: string | null;
}

export async function buildWorkspaceTree(userId: string): Promise<WorkspaceTreeClient[]> {
  const supabase = getSupabase();
  const admin = await isAdmin(userId);

  const [
    clientsResult,
    projectsResult,
    clientMembershipsResult,
    projectMembershipsResult,
  ] = await Promise.all([
    supabase
      .from('clients')
      .select('id, name, scope, owner_user_id')
      .order('name', { ascending: true }),
    supabase
      .from('projects')
      .select('id, client_id, name, scope, owner_user_id')
      .order('name', { ascending: true }),
    supabase
      .from('client_memberships')
      .select('client_id')
      .eq('user_id', userId),
    supabase
      .from('project_memberships')
      .select('project_id')
      .eq('user_id', userId),
  ]);

  if (clientsResult.error) {
    throw new Error(`Failed to load clients: ${clientsResult.error.message}`);
  }
  if (projectsResult.error) {
    throw new Error(`Failed to load projects: ${projectsResult.error.message}`);
  }
  if (clientMembershipsResult.error) {
    throw new Error(`Failed to load client memberships: ${clientMembershipsResult.error.message}`);
  }
  if (projectMembershipsResult.error) {
    throw new Error(`Failed to load project memberships: ${projectMembershipsResult.error.message}`);
  }

  const clients = (clientsResult.data ?? []) as ClientRow[];
  const projects = (projectsResult.data ?? []) as ProjectRow[];

  const memberClientIds = new Set((clientMembershipsResult.data ?? []).map((row) => row.client_id));
  const memberProjectIds = new Set((projectMembershipsResult.data ?? []).map((row) => row.project_id));

  const visibleProjects = admin
    ? projects
    : projects.filter((project) => {
        if (project.owner_user_id === userId) {
          return true;
        }
        if (memberProjectIds.has(project.id)) {
          return true;
        }
        if (memberClientIds.has(project.client_id)) {
          return true;
        }
        return false;
      });

  const visibleClientIds = new Set(
    visibleProjects.map((project) => project.client_id)
  );

  if (!admin) {
    for (const client of clients) {
      if (client.owner_user_id === userId) {
        visibleClientIds.add(client.id);
      }
    }
    for (const clientId of memberClientIds) {
      visibleClientIds.add(clientId);
    }
  }

  const visibleClients = admin
    ? clients
    : clients.filter((client) => visibleClientIds.has(client.id));

  const projectIds = visibleProjects.map((project) => project.id);
  const conversationCountByProject = new Map<string, number>();

  if (projectIds.length > 0) {
    const { data: conversations, error: conversationError } = await supabase
      .from('conversations')
      .select('project_id')
      .in('project_id', projectIds)
      .is('deleted_at', null);

    if (conversationError) {
      throw new Error(`Failed to load conversation counts: ${conversationError.message}`);
    }

    for (const conversation of conversations ?? []) {
      if (!conversation.project_id) continue;
      conversationCountByProject.set(
        conversation.project_id,
        (conversationCountByProject.get(conversation.project_id) ?? 0) + 1
      );
    }
  }

  const projectsByClient = new Map<string, WorkspaceTreeProject[]>();

  for (const project of visibleProjects) {
    const row: WorkspaceTreeProject = {
      id: project.id,
      name: project.name,
      scope: project.scope,
      client_id: project.client_id,
      conversation_count: conversationCountByProject.get(project.id) ?? 0,
    };

    const clientProjects = projectsByClient.get(project.client_id) ?? [];
    clientProjects.push(row);
    projectsByClient.set(project.client_id, clientProjects);
  }

  return visibleClients.map((client) => ({
    id: client.id,
    name: client.name,
    scope: client.scope,
    projects: (projectsByClient.get(client.id) ?? []).sort((a, b) =>
      a.name.localeCompare(b.name)
    ),
  }));
}

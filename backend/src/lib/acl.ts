import { getSupabase } from './supabase.js';

export class AccessDeniedError extends Error {
  constructor(message = 'Forbidden') {
    super(message);
    this.name = 'AccessDeniedError';
  }
}

export async function getUserRole(userId: string): Promise<'admin' | 'member'> {
  const supabase = getSupabase();
  const { data } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', userId)
    .maybeSingle();

  if (!data?.role || data.role === 'member') {
    return 'member';
  }

  return data.role === 'admin' ? 'admin' : 'member';
}

export async function isAdmin(userId: string): Promise<boolean> {
  return (await getUserRole(userId)) === 'admin';
}

export async function canAccessProject(userId: string, projectId: string): Promise<boolean> {
  if (await isAdmin(userId)) {
    return true;
  }

  const supabase = getSupabase();

  const { data: project, error: projectError } = await supabase
    .from('projects')
    .select('id, client_id, owner_user_id')
    .eq('id', projectId)
    .maybeSingle();

  if (projectError || !project) {
    return false;
  }

  if (project.owner_user_id === userId) {
    return true;
  }

  const { data: projectMembership } = await supabase
    .from('project_memberships')
    .select('id')
    .eq('user_id', userId)
    .eq('project_id', projectId)
    .maybeSingle();

  if (projectMembership) {
    return true;
  }

  const { data: clientMembership } = await supabase
    .from('client_memberships')
    .select('id')
    .eq('user_id', userId)
    .eq('client_id', project.client_id)
    .maybeSingle();

  return Boolean(clientMembership);
}

export async function assertProjectAccess(userId: string, projectId: string): Promise<void> {
  const allowed = await canAccessProject(userId, projectId);
  if (!allowed) {
    throw new AccessDeniedError('Forbidden project');
  }
}

export async function assertConversationOwnership(
  userId: string,
  conversationId: string
): Promise<{ id: string; model: string | null; project_id: string | null }> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('conversations')
    .select('id, model, project_id')
    .eq('id', conversationId)
    .eq('user_id', userId)
    .is('deleted_at', null)
    .maybeSingle();

  if (error || !data) {
    throw new AccessDeniedError('Conversation not found');
  }

  return data;
}

export async function assertClientAccess(userId: string, clientId: string): Promise<void> {
  if (await isAdmin(userId)) {
    return;
  }

  const supabase = getSupabase();

  const { data: ownedClient } = await supabase
    .from('clients')
    .select('id')
    .eq('id', clientId)
    .eq('owner_user_id', userId)
    .maybeSingle();

  if (ownedClient) {
    return;
  }

  const { data: membership } = await supabase
    .from('client_memberships')
    .select('id')
    .eq('user_id', userId)
    .eq('client_id', clientId)
    .maybeSingle();

  if (!membership) {
    throw new AccessDeniedError('Forbidden client');
  }
}

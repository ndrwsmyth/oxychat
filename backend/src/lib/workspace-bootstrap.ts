import { getSupabase } from './supabase.js';

export interface PersonalWorkspace {
  clientId: string;
  projectId: string;
}

function normalizePersonalClientName(email: string): string {
  const prefix = email.split('@')[0]?.trim();
  if (!prefix) {
    return 'Personal Client';
  }
  return `${prefix} Personal`;
}

export async function ensurePersonalWorkspace(
  userId: string,
  email: string
): Promise<PersonalWorkspace> {
  const supabase = getSupabase();

  const { data: existingClient } = await supabase
    .from('clients')
    .select('id')
    .eq('owner_user_id', userId)
    .eq('scope', 'personal')
    .maybeSingle();

  let clientId = existingClient?.id;

  if (!clientId) {
    const { data, error } = await supabase
      .from('clients')
      .insert({
        name: normalizePersonalClientName(email),
        scope: 'personal',
        owner_user_id: userId,
      })
      .select('id')
      .single();

    if (error && error.code !== '23505') {
      throw new Error(`Failed to create personal client: ${error.message}`);
    }

    if (!data?.id) {
      const { data: racedClient, error: racedClientError } = await supabase
        .from('clients')
        .select('id')
        .eq('owner_user_id', userId)
        .eq('scope', 'personal')
        .single();

      if (racedClientError || !racedClient) {
        throw new Error(`Failed to resolve personal client after race: ${racedClientError?.message}`);
      }

      clientId = racedClient.id;
    } else {
      clientId = data.id;
    }
  }

  const { data: existingProject } = await supabase
    .from('projects')
    .select('id')
    .eq('owner_user_id', userId)
    .eq('scope', 'personal')
    .maybeSingle();

  let projectId = existingProject?.id;

  if (!projectId) {
    const { data, error } = await supabase
      .from('projects')
      .insert({
        client_id: clientId,
        name: 'Personal Workspace',
        scope: 'personal',
        owner_user_id: userId,
        is_inbox: true,
      })
      .select('id')
      .single();

    if (error && error.code !== '23505') {
      throw new Error(`Failed to create personal project: ${error.message}`);
    }

    if (!data?.id) {
      const { data: racedProject, error: racedProjectError } = await supabase
        .from('projects')
        .select('id')
        .eq('owner_user_id', userId)
        .eq('scope', 'personal')
        .single();

      if (racedProjectError || !racedProject) {
        throw new Error(
          `Failed to resolve personal project after race: ${racedProjectError?.message}`
        );
      }

      projectId = racedProject.id;
    } else {
      projectId = data.id;
    }
  }

  return {
    clientId,
    projectId,
  };
}

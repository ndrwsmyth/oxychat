import { getSupabase } from './supabase.js';
import { canAccessProject } from './acl.js';

export interface AccessibleDocument {
  id: string;
  title: string;
  visibility_scope: string;
  project_id: string;
  size_bytes: number;
  created_at: string;
}

/**
 * Returns documents visible for a given project, applying visibility inheritance:
 * - project-scoped: only docs where project_id matches
 * - client-scoped: docs owned by any project under the same client
 * - global-scoped: all global docs
 */
export async function getAccessibleDocumentsForProject(
  projectId: string
): Promise<AccessibleDocument[]> {
  const supabase = getSupabase();

  const { data: project } = await supabase
    .from('projects')
    .select('client_id')
    .eq('id', projectId)
    .maybeSingle();

  if (!project) return [];

  const { data: siblingProjects } = await supabase
    .from('projects')
    .select('id')
    .eq('client_id', project.client_id);

  const siblingProjectIds = (siblingProjects ?? []).map((p: { id: string }) => p.id);

  const orClauses = [
    `and(visibility_scope.eq.project,project_id.eq.${projectId})`,
    siblingProjectIds.length > 0
      ? `and(visibility_scope.eq.client,project_id.in.(${siblingProjectIds.join(',')}))`
      : '',
    'visibility_scope.eq.global',
  ].filter(Boolean).join(',');

  const { data, error } = await supabase
    .from('documents')
    .select('id, title, visibility_scope, project_id, size_bytes, created_at')
    .or(orClauses)
    .order('created_at', { ascending: false });

  if (error) throw new Error(`Failed to load documents: ${error.message}`);
  return (data ?? []) as AccessibleDocument[];
}

/**
 * Search accessible documents by title for a given project.
 */
export async function searchAccessibleDocumentsForProject(
  projectId: string,
  query: string,
  limit: number
): Promise<AccessibleDocument[]> {
  const supabase = getSupabase();

  const { data: project } = await supabase
    .from('projects')
    .select('client_id')
    .eq('id', projectId)
    .maybeSingle();

  if (!project) return [];

  const { data: siblingProjects } = await supabase
    .from('projects')
    .select('id')
    .eq('client_id', project.client_id);

  const siblingProjectIds = (siblingProjects ?? []).map((p: { id: string }) => p.id);

  const orClauses = [
    `and(visibility_scope.eq.project,project_id.eq.${projectId})`,
    siblingProjectIds.length > 0
      ? `and(visibility_scope.eq.client,project_id.in.(${siblingProjectIds.join(',')}))`
      : '',
    'visibility_scope.eq.global',
  ].filter(Boolean).join(',');

  const { data, error } = await supabase
    .from('documents')
    .select('id, title, visibility_scope, project_id, size_bytes, created_at')
    .ilike('title', `%${query}%`)
    .or(orClauses)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw new Error(`Failed to search documents: ${error.message}`);
  return (data ?? []) as AccessibleDocument[];
}

/**
 * Search all documents by title (global mode, no project scoping).
 */
export async function searchDocumentsGlobal(
  query: string,
  limit: number
): Promise<AccessibleDocument[]> {
  const supabase = getSupabase();

  const { data, error } = await supabase
    .from('documents')
    .select('id, title, visibility_scope, project_id, size_bytes, created_at')
    .ilike('title', `%${query}%`)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw new Error(`Failed to search documents: ${error.message}`);
  return (data ?? []) as AccessibleDocument[];
}

/**
 * Filters document IDs to only those the user can access via project membership.
 */
export async function filterVisibleDocumentIdsForUser(
  userId: string,
  documentIds: string[]
): Promise<string[]> {
  if (documentIds.length === 0) return [];

  const supabase = getSupabase();
  const { data: docs, error } = await supabase
    .from('documents')
    .select('id, project_id')
    .in('id', documentIds);

  if (error || !docs) return [];

  const visibleIds: string[] = [];
  const accessCache = new Map<string, boolean>();

  for (const doc of docs as Array<{ id: string; project_id: string }>) {
    if (!accessCache.has(doc.project_id)) {
      accessCache.set(doc.project_id, await canAccessProject(userId, doc.project_id));
    }
    if (accessCache.get(doc.project_id)) {
      visibleIds.push(doc.id);
    }
  }

  return visibleIds;
}

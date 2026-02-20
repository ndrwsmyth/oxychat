import { isAdmin } from './acl.js';
import { getSupabase } from './supabase.js';
import { normalizeEmail } from './transcript-normalization.js';

interface TranscriptClassificationRow {
  transcript_id: string;
  visibility: 'private' | 'non_private';
}

interface TranscriptProjectLinkRow {
  transcript_id: string;
  project_id: string;
}

interface ProjectAccessRow {
  id: string;
  client_id: string;
  owner_user_id: string | null;
}

export async function getVisibleTranscriptIdsForUser(
  userId: string,
  userEmail: string,
  candidateTranscriptIds: string[]
): Promise<Set<string>> {
  const supabase = getSupabase();
  const transcriptIds = [...new Set(candidateTranscriptIds.filter(Boolean))];
  const visibleIds = new Set<string>();

  if (transcriptIds.length === 0) {
    return visibleIds;
  }

  const { data: classifications, error: classificationError } = await supabase
    .from('transcript_classification')
    .select('transcript_id, visibility')
    .in('transcript_id', transcriptIds);

  if (classificationError) {
    throw new Error(`Failed to load transcript classifications: ${classificationError.message}`);
  }

  const classificationRows = (classifications ?? []) as TranscriptClassificationRow[];
  const privateTranscriptIds = classificationRows
    .filter((row) => row.visibility === 'private')
    .map((row) => row.transcript_id);
  const nonPrivateTranscriptIds = classificationRows
    .filter((row) => row.visibility === 'non_private')
    .map((row) => row.transcript_id);

  if (privateTranscriptIds.length > 0) {
    const { data: privateAccessRows, error: privateAccessError } = await supabase
      .from('transcript_attendees')
      .select('transcript_id')
      .in('transcript_id', privateTranscriptIds)
      .eq('normalized_email', normalizeEmail(userEmail));

    if (privateAccessError) {
      throw new Error(`Failed to evaluate private transcript access: ${privateAccessError.message}`);
    }

    for (const row of privateAccessRows ?? []) {
      if (row.transcript_id) {
        visibleIds.add(row.transcript_id);
      }
    }
  }

  if (nonPrivateTranscriptIds.length > 0) {
    const { data: links, error: linksError } = await supabase
      .from('transcript_project_links')
      .select('transcript_id, project_id')
      .in('transcript_id', nonPrivateTranscriptIds);

    if (linksError) {
      throw new Error(`Failed to load transcript project links: ${linksError.message}`);
    }

    const linkRows = (links ?? []) as TranscriptProjectLinkRow[];
    if (linkRows.length > 0) {
      if (await isAdmin(userId)) {
        for (const row of linkRows) {
          visibleIds.add(row.transcript_id);
        }
      } else {
        const projectIds = [...new Set(linkRows.map((row) => row.project_id))];
        const accessibleProjectIds = await getAccessibleProjectIds(userId, projectIds);

        for (const row of linkRows) {
          if (accessibleProjectIds.has(row.project_id)) {
            visibleIds.add(row.transcript_id);
          }
        }
      }
    }
  }

  return visibleIds;
}

async function getAccessibleProjectIds(userId: string, projectIds: string[]): Promise<Set<string>> {
  const supabase = getSupabase();
  const uniqueProjectIds = [...new Set(projectIds.filter(Boolean))];
  const accessibleProjectIds = new Set<string>();

  if (uniqueProjectIds.length === 0) {
    return accessibleProjectIds;
  }

  const { data: projects, error: projectError } = await supabase
    .from('projects')
    .select('id, client_id, owner_user_id')
    .in('id', uniqueProjectIds);

  if (projectError) {
    throw new Error(`Failed to load projects for access evaluation: ${projectError.message}`);
  }

  const projectRows = (projects ?? []) as ProjectAccessRow[];
  const clientIds = [...new Set(projectRows.map((project) => project.client_id))];

  const [projectMembershipsResult, clientMembershipsResult] = await Promise.all([
    supabase
      .from('project_memberships')
      .select('project_id')
      .eq('user_id', userId)
      .in('project_id', uniqueProjectIds),
    supabase
      .from('client_memberships')
      .select('client_id')
      .eq('user_id', userId)
      .in('client_id', clientIds),
  ]);

  if (projectMembershipsResult.error) {
    throw new Error(`Failed to load project memberships: ${projectMembershipsResult.error.message}`);
  }
  if (clientMembershipsResult.error) {
    throw new Error(`Failed to load client memberships: ${clientMembershipsResult.error.message}`);
  }

  const memberProjectIds = new Set(
    (projectMembershipsResult.data ?? [])
      .map((row) => row.project_id)
      .filter((value): value is string => typeof value === 'string')
  );
  const memberClientIds = new Set(
    (clientMembershipsResult.data ?? [])
      .map((row) => row.client_id)
      .filter((value): value is string => typeof value === 'string')
  );

  for (const project of projectRows) {
    if (project.owner_user_id === userId) {
      accessibleProjectIds.add(project.id);
      continue;
    }
    if (memberProjectIds.has(project.id)) {
      accessibleProjectIds.add(project.id);
      continue;
    }
    if (memberClientIds.has(project.client_id)) {
      accessibleProjectIds.add(project.id);
    }
  }

  return accessibleProjectIds;
}

export async function canUserViewTranscript(
  userId: string,
  userEmail: string,
  transcriptId: string
): Promise<boolean> {
  const visible = await getVisibleTranscriptIdsForUser(userId, userEmail, [transcriptId]);
  return visible.has(transcriptId);
}

export async function filterVisibleTranscriptIdsForUser(
  userId: string,
  userEmail: string,
  transcriptIds: string[]
): Promise<string[]> {
  const visibleSet = await getVisibleTranscriptIdsForUser(userId, userEmail, transcriptIds);
  return transcriptIds.filter((transcriptId) => visibleSet.has(transcriptId));
}

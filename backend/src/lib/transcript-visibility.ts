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

interface TranscriptLinkRelationRow {
  project_id: string;
}

interface TranscriptClassificationRelationRow {
  visibility: 'private' | 'non_private';
}

interface ProjectAccessRow {
  id: string;
  client_id: string;
  owner_user_id: string | null;
}

interface UserRoleRow {
  role: 'admin' | 'member';
}

interface ProjectMembershipRow {
  project_id: string;
}

interface ClientMembershipRow {
  client_id: string;
}

interface VisibleTranscriptAccessResult {
  visibleIds: Set<string>;
  projectByTranscriptId: Map<string, string>;
}

const ACCESS_CACHE_TTL_MS = 30_000;

const adminCache = new Map<string, { value: boolean; expiresAt: number }>();
const membershipCache = new Map<
  string,
  { value: { projectIds: Set<string>; clientIds: Set<string> }; expiresAt: number }
>();
const projectCache = new Map<string, { value: ProjectAccessRow; expiresAt: number }>();

function cacheIsFresh(expiresAt: number): boolean {
  return expiresAt > Date.now();
}

function createEmptyAccessResult(): VisibleTranscriptAccessResult {
  return {
    visibleIds: new Set<string>(),
    projectByTranscriptId: new Map<string, string>(),
  };
}

async function isAdminCached(userId: string): Promise<boolean> {
  const cached = adminCache.get(userId);
  if (cached && cacheIsFresh(cached.expiresAt)) {
    return cached.value;
  }

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load user role: ${error.message}`);
  }

  const isAdmin = ((data as UserRoleRow | null)?.role ?? 'member') === 'admin';
  adminCache.set(userId, { value: isAdmin, expiresAt: Date.now() + ACCESS_CACHE_TTL_MS });
  return isAdmin;
}

async function getMembershipSnapshotCached(
  userId: string
): Promise<{ projectIds: Set<string>; clientIds: Set<string> }> {
  const cached = membershipCache.get(userId);
  if (cached && cacheIsFresh(cached.expiresAt)) {
    return cached.value;
  }

  const supabase = getSupabase();
  const [projectMembershipsResult, clientMembershipsResult] = await Promise.all([
    supabase.from('project_memberships').select('project_id').eq('user_id', userId),
    supabase.from('client_memberships').select('client_id').eq('user_id', userId),
  ]);

  if (projectMembershipsResult.error) {
    throw new Error(`Failed to load project memberships: ${projectMembershipsResult.error.message}`);
  }
  if (clientMembershipsResult.error) {
    throw new Error(`Failed to load client memberships: ${clientMembershipsResult.error.message}`);
  }

  const snapshot = {
    projectIds: new Set(
      ((projectMembershipsResult.data ?? []) as ProjectMembershipRow[])
        .map((row) => row.project_id)
        .filter((value): value is string => typeof value === 'string')
    ),
    clientIds: new Set(
      ((clientMembershipsResult.data ?? []) as ClientMembershipRow[])
        .map((row) => row.client_id)
        .filter((value): value is string => typeof value === 'string')
    ),
  };

  membershipCache.set(userId, { value: snapshot, expiresAt: Date.now() + ACCESS_CACHE_TTL_MS });
  return snapshot;
}

async function getProjectsCached(projectIds: string[]): Promise<ProjectAccessRow[]> {
  const uniqueProjectIds = [...new Set(projectIds.filter(Boolean))];
  if (uniqueProjectIds.length === 0) {
    return [];
  }

  const now = Date.now();
  const projectById = new Map<string, ProjectAccessRow>();
  const missingIds: string[] = [];

  for (const projectId of uniqueProjectIds) {
    const cached = projectCache.get(projectId);
    if (cached && cached.expiresAt > now) {
      projectById.set(projectId, cached.value);
      continue;
    }
    missingIds.push(projectId);
  }

  if (missingIds.length > 0) {
    const supabase = getSupabase();
    const { data: projects, error: projectError } = await supabase
      .from('projects')
      .select('id, client_id, owner_user_id')
      .in('id', missingIds);

    if (projectError) {
      throw new Error(`Failed to load projects for access evaluation: ${projectError.message}`);
    }

    for (const project of (projects ?? []) as ProjectAccessRow[]) {
      projectById.set(project.id, project);
      projectCache.set(project.id, {
        value: project,
        expiresAt: Date.now() + ACCESS_CACHE_TTL_MS,
      });
    }
  }

  return uniqueProjectIds
    .map((projectId) => projectById.get(projectId))
    .filter((project): project is ProjectAccessRow => Boolean(project));
}

export async function getVisibleTranscriptAccessForUser(
  userId: string,
  userEmail: string,
  candidateTranscriptIds: string[]
): Promise<VisibleTranscriptAccessResult> {
  const supabase = getSupabase();
  const transcriptIds = [...new Set(candidateTranscriptIds.filter(Boolean))];
  const result = createEmptyAccessResult();

  if (transcriptIds.length === 0) {
    return result;
  }

  const { data: transcriptRows, error: transcriptAccessError } = await supabase
    .from('transcripts')
    .select('id, transcript_classification(visibility), transcript_project_links(project_id)')
    .in('id', transcriptIds);

  if (transcriptAccessError) {
    throw new Error(`Failed to load transcript visibility context: ${transcriptAccessError.message}`);
  }

  const privateTranscriptIds: string[] = [];
  const nonPrivateLinkRows: TranscriptProjectLinkRow[] = [];

  for (const row of (transcriptRows ?? []) as Array<{
    id: string;
    transcript_classification: TranscriptClassificationRelationRow | TranscriptClassificationRelationRow[] | null;
    transcript_project_links: TranscriptLinkRelationRow[] | null;
  }>) {
    const classification = Array.isArray(row.transcript_classification)
      ? row.transcript_classification[0]
      : row.transcript_classification;
    if (!classification) {
      continue;
    }

    if (classification.visibility === 'private') {
      privateTranscriptIds.push(row.id);
      continue;
    }

    for (const link of row.transcript_project_links ?? []) {
      if (link.project_id) {
        nonPrivateLinkRows.push({
          transcript_id: row.id,
          project_id: link.project_id,
        });
      }
    }
  }

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
        result.visibleIds.add(row.transcript_id);
      }
    }
  }

  if (nonPrivateLinkRows.length > 0) {
    if (await isAdminCached(userId)) {
      for (const row of nonPrivateLinkRows) {
        result.visibleIds.add(row.transcript_id);
        result.projectByTranscriptId.set(row.transcript_id, row.project_id);
      }
    } else {
      const projectIds = [...new Set(nonPrivateLinkRows.map((row) => row.project_id))];
      const accessibleProjectIds = await getAccessibleProjectIds(userId, projectIds);

      for (const row of nonPrivateLinkRows) {
        if (accessibleProjectIds.has(row.project_id)) {
          result.visibleIds.add(row.transcript_id);
          result.projectByTranscriptId.set(row.transcript_id, row.project_id);
        }
      }
    }
  }

  return result;
}

export async function getVisibleTranscriptIdsForUser(
  userId: string,
  userEmail: string,
  candidateTranscriptIds: string[]
): Promise<Set<string>> {
  const access = await getVisibleTranscriptAccessForUser(userId, userEmail, candidateTranscriptIds);
  return access.visibleIds;
}

async function getAccessibleProjectIds(userId: string, projectIds: string[]): Promise<Set<string>> {
  const uniqueProjectIds = [...new Set(projectIds.filter(Boolean))];
  const accessibleProjectIds = new Set<string>();

  if (uniqueProjectIds.length === 0) {
    return accessibleProjectIds;
  }

  const [projectRows, membershipSnapshot] = await Promise.all([
    getProjectsCached(uniqueProjectIds),
    getMembershipSnapshotCached(userId),
  ]);

  for (const project of projectRows) {
    if (project.owner_user_id === userId) {
      accessibleProjectIds.add(project.id);
      continue;
    }
    if (membershipSnapshot.projectIds.has(project.id)) {
      accessibleProjectIds.add(project.id);
      continue;
    }
    if (membershipSnapshot.clientIds.has(project.client_id)) {
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

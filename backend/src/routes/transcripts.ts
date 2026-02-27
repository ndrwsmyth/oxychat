import { Hono } from 'hono';
import type { AppVariables } from '../types.js';
import {
  canUserViewTranscript,
  filterVisibleTranscriptIdsForUser,
} from '../lib/transcript-visibility.js';
import { getSupabase } from '../lib/supabase.js';
import { AccessDeniedError, assertConversationOwnership, assertProjectAccess } from '../lib/acl.js';

export const transcriptsRouter = new Hono<{ Variables: AppVariables }>();

interface TranscriptRow {
  id: string;
  title: string;
  date: string;
  summary: string | null;
}

interface TranscriptTag {
  id: string;
  name: string;
  scope: 'personal' | 'client' | 'global';
}

interface TranscriptWithTags extends TranscriptRow {
  project_tag: TranscriptTag | null;
  client_tag: TranscriptTag | null;
}

interface TranscriptProjectLinkRow {
  transcript_id: string;
  project_id: string;
}

interface ProjectTagRow {
  id: string;
  name: string;
  scope: 'personal' | 'client' | 'global';
  client_id: string;
}

interface ClientTagRow {
  id: string;
  name: string;
  scope: 'personal' | 'client' | 'global';
}

interface MentionQueryProjectLinkRow {
  transcript_id: string;
}

interface MentionProjectScopeRow {
  scope: 'personal' | 'client' | 'global';
}

type MentionQueryMode = 'project_global' | 'global_only' | 'personal_global_fallback';
const DEFAULT_MENTION_BUCKET_LIMIT = 20;
const MAX_MENTION_SEARCH_CANDIDATES = 120;

async function getTranscriptTagMap(
  transcriptIds: string[]
): Promise<Map<string, { project_tag: TranscriptTag | null; client_tag: TranscriptTag | null }>> {
  const supabase = getSupabase();
  const uniqueTranscriptIds = [...new Set(transcriptIds.filter(Boolean))];
  const tagMap = new Map<string, { project_tag: TranscriptTag | null; client_tag: TranscriptTag | null }>();

  if (uniqueTranscriptIds.length === 0) {
    return tagMap;
  }

  const { data: links, error: linksError } = await supabase
    .from('transcript_project_links')
    .select('transcript_id, project_id')
    .in('transcript_id', uniqueTranscriptIds);

  if (linksError) {
    throw new Error(`Failed to load transcript project links: ${linksError.message}`);
  }

  const linkRows = (links ?? []) as TranscriptProjectLinkRow[];
  const projectIds = [...new Set(linkRows.map((row) => row.project_id).filter(Boolean))];
  if (projectIds.length === 0) {
    return tagMap;
  }

  const { data: projects, error: projectsError } = await supabase
    .from('projects')
    .select('id, name, scope, client_id')
    .in('id', projectIds);

  if (projectsError) {
    throw new Error(`Failed to load transcript project tags: ${projectsError.message}`);
  }

  const projectRows = (projects ?? []) as ProjectTagRow[];
  const projectById = new Map(projectRows.map((row) => [row.id, row]));
  const clientIds = [...new Set(projectRows.map((row) => row.client_id).filter(Boolean))];

  const clientById = new Map<string, ClientTagRow>();
  if (clientIds.length > 0) {
    const { data: clients, error: clientsError } = await supabase
      .from('clients')
      .select('id, name, scope')
      .in('id', clientIds);

    if (clientsError) {
      throw new Error(`Failed to load transcript client tags: ${clientsError.message}`);
    }

    for (const client of (clients ?? []) as ClientTagRow[]) {
      clientById.set(client.id, client);
    }
  }

  for (const row of linkRows) {
    const project = projectById.get(row.project_id);
    if (!project) continue;
    const client = clientById.get(project.client_id) ?? null;

    tagMap.set(row.transcript_id, {
      project_tag: {
        id: project.id,
        name: project.name,
        scope: project.scope,
      },
      client_tag: client
        ? {
            id: client.id,
            name: client.name,
            scope: client.scope,
          }
        : null,
    });
  }

  return tagMap;
}

async function withTranscriptTags(rows: TranscriptRow[]): Promise<TranscriptWithTags[]> {
  const tagMap = await getTranscriptTagMap(rows.map((row) => row.id));
  return rows.map((row) => {
    const tags = tagMap.get(row.id);
    return {
      ...row,
      project_tag: tags?.project_tag ?? null,
      client_tag: tags?.client_tag ?? null,
    };
  });
}

async function filterVisibleRows(
  userId: string,
  userEmail: string,
  rows: TranscriptRow[]
): Promise<TranscriptRow[]> {
  const visibleIds = await filterVisibleTranscriptIdsForUser(
    userId,
    userEmail,
    rows.map((row) => row.id)
  );
  const visibleSet = new Set(visibleIds);
  return rows.filter((row) => visibleSet.has(row.id));
}

async function searchTranscriptRows(query: string, limit: number): Promise<TranscriptRow[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('transcripts')
    .select('id, title, date, summary')
    .textSearch('title_search', query, { type: 'websearch' })
    .order('date', { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as TranscriptRow[];
}

async function filterRowsForProject(rows: TranscriptRow[], projectId: string): Promise<TranscriptRow[]> {
  if (rows.length === 0) {
    return [];
  }

  const supabase = getSupabase();
  const transcriptIds = rows.map((row) => row.id);

  const { data, error } = await supabase
    .from('transcript_project_links')
    .select('transcript_id')
    .eq('project_id', projectId)
    .in('transcript_id', transcriptIds);

  if (error) {
    throw new Error(`Failed to scope transcripts to project: ${error.message}`);
  }

  const scopedIds = new Set(
    ((data ?? []) as MentionQueryProjectLinkRow[])
      .map((row) => row.transcript_id)
      .filter(Boolean)
  );

  return rows.filter((row) => scopedIds.has(row.id));
}

async function resolveMentionScope(
  userId: string,
  requestedProjectId?: string,
  conversationId?: string
): Promise<{ projectId: string | null; mode: MentionQueryMode }> {
  let resolvedProjectId: string | null = null;

  if (requestedProjectId) {
    await assertProjectAccess(userId, requestedProjectId);
    resolvedProjectId = requestedProjectId;
  } else if (conversationId) {
    const conversation = await assertConversationOwnership(userId, conversationId);
    resolvedProjectId = conversation.project_id;
  }

  if (!resolvedProjectId) {
    return { projectId: null, mode: 'global_only' };
  }

  const supabase = getSupabase();
  const { data: project, error } = await supabase
    .from('projects')
    .select('scope')
    .eq('id', resolvedProjectId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load project scope: ${error.message}`);
  }
  if (!project) {
    return { projectId: null, mode: 'global_only' };
  }

  const scope = (project as MentionProjectScopeRow).scope;
  if (scope === 'personal') {
    return { projectId: resolvedProjectId, mode: 'personal_global_fallback' };
  }

  return { projectId: resolvedProjectId, mode: 'project_global' };
}

function parseMentionBucketLimit(limitRaw: unknown): number {
  if (typeof limitRaw !== 'number') return DEFAULT_MENTION_BUCKET_LIMIT;
  if (!Number.isFinite(limitRaw)) return DEFAULT_MENTION_BUCKET_LIMIT;
  return Math.min(30, Math.max(10, Math.floor(limitRaw)));
}

// List transcripts (for @mention autocomplete)
transcriptsRouter.get('/transcripts', async (c) => {
  const query = c.req.query('q');
  const requestedProjectRaw = c.req.query('project');
  const requestedProjectId = requestedProjectRaw?.trim();
  const user = c.get('user');
  const supabase = getSupabase();

  if (requestedProjectRaw !== undefined && !requestedProjectId) {
    return c.json({ error: 'project query parameter must be a non-empty string' }, 400);
  }

  if (requestedProjectId) {
    try {
      await assertProjectAccess(user.id, requestedProjectId);
    } catch (error) {
      if (error instanceof AccessDeniedError) {
        return c.json({ error: error.message }, 403);
      }
      return c.json({ error: error instanceof Error ? error.message : 'Failed to validate project access' }, 500);
    }
  }

  let request = supabase
    .from('transcripts')
    .select('id, title, date, summary')
    .order('date', { ascending: false })
    .limit(50);

  if (query) {
    request = request.textSearch('title_search', query, { type: 'websearch' });
  }

  const { data, error } = await request;
  if (error) return c.json({ error: error.message }, 500);

  try {
    const scopedRows = requestedProjectId
      ? await filterRowsForProject((data ?? []) as TranscriptRow[], requestedProjectId)
      : (data ?? []) as TranscriptRow[];
    const visibleRows = await filterVisibleRows(user.id, user.email, scopedRows);
    return c.json(await withTranscriptTags(visibleRows));
  } catch (visibilityError) {
    return c.json(
      { error: visibilityError instanceof Error ? visibilityError.message : 'Failed to apply visibility' },
      500
    );
  }
});

// Canonical transcript search endpoint
transcriptsRouter.post('/transcripts/search', async (c) => {
  const user = c.get('user');
  const body = await c.req.json().catch(() => ({}));
  const query = typeof body.query === 'string' ? body.query.trim() : '';
  const requestedProjectId = typeof body.project_id === 'string' ? body.project_id.trim() : '';

  if (!query) {
    return c.json({ error: 'query is required' }, 400);
  }

  if (body.project_id !== undefined && !requestedProjectId) {
    return c.json({ error: 'project_id must be a non-empty string' }, 400);
  }

  if (requestedProjectId) {
    try {
      await assertProjectAccess(user.id, requestedProjectId);
    } catch (error) {
      if (error instanceof AccessDeniedError) {
        return c.json({ error: error.message }, 403);
      }
      return c.json({ error: error instanceof Error ? error.message : 'Failed to validate project access' }, 500);
    }
  }

  try {
    const rows = await searchTranscriptRows(query, 20);
    const scopedRows = requestedProjectId ? await filterRowsForProject(rows, requestedProjectId) : rows;
    const visibleRows = await filterVisibleRows(user.id, user.email, scopedRows);
    return c.json(await withTranscriptTags(visibleRows));
  } catch (error) {
    return c.json({ error: error instanceof Error ? error.message : 'Search failed' }, 500);
  }
});

transcriptsRouter.post('/transcripts/mentions/query', async (c) => {
  const user = c.get('user');
  const startedAt = performance.now();
  const body = await c.req.json().catch(() => ({}));
  const query = typeof body.query === 'string' ? body.query.trim() : '';
  const requestedProjectId = typeof body.project_id === 'string' ? body.project_id.trim() : '';
  const conversationId = typeof body.conversation_id === 'string' ? body.conversation_id.trim() : '';
  const bucketLimit = parseMentionBucketLimit(body.limit);

  if (!query) {
    return c.json({ error: 'query is required' }, 400);
  }

  try {
    const scope = await resolveMentionScope(
      user.id,
      requestedProjectId || undefined,
      conversationId || undefined
    );

    const candidates = await searchTranscriptRows(query, MAX_MENTION_SEARCH_CANDIDATES);
    const visibleRows = await filterVisibleRows(user.id, user.email, candidates);

    let projectRows: TranscriptRow[] = [];
    let globalRows: TranscriptRow[] = [];

    if (scope.mode === 'project_global' && scope.projectId) {
      projectRows = (await filterRowsForProject(visibleRows, scope.projectId)).slice(0, bucketLimit);
      const projectIdSet = new Set(projectRows.map((row) => row.id));
      globalRows = visibleRows.filter((row) => !projectIdSet.has(row.id)).slice(0, bucketLimit);
    } else {
      projectRows = [];
      globalRows = visibleRows.slice(0, bucketLimit);
    }

    const [project, global] = await Promise.all([
      withTranscriptTags(projectRows),
      withTranscriptTags(globalRows),
    ]);

    return c.json({
      project,
      global,
      mode: scope.mode,
      took_ms: Number((performance.now() - startedAt).toFixed(2)),
    });
  } catch (error) {
    if (error instanceof AccessDeniedError) {
      return c.json({ error: error.message }, 403);
    }
    return c.json({ error: error instanceof Error ? error.message : 'Mention query failed' }, 500);
  }
});

// Backward-compatible alias endpoint
transcriptsRouter.get('/documents/search', async (c) => {
  const user = c.get('user');
  const query = c.req.query('q');
  if (!query?.trim()) {
    return c.json({ error: 'Query parameter q is required' }, 400);
  }

  try {
    const rows = await searchTranscriptRows(query.trim(), 20);
    const visibleRows = await filterVisibleRows(user.id, user.email, rows);
    return c.json(await withTranscriptTags(visibleRows));
  } catch (error) {
    return c.json({ error: error instanceof Error ? error.message : 'Search failed' }, 500);
  }
});

// Transcript detail
transcriptsRouter.get('/transcripts/:id', async (c) => {
  const transcriptId = c.req.param('id');
  const user = c.get('user');

  const canView = await canUserViewTranscript(user.id, user.email, transcriptId);
  if (!canView) {
    return c.json({ error: 'Not found' }, 404);
  }

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('transcripts')
    .select('id, title, date, summary, content')
    .eq('id', transcriptId)
    .maybeSingle();

  if (error) {
    return c.json({ error: error.message }, 500);
  }
  if (!data) {
    return c.json({ error: 'Not found' }, 404);
  }

  try {
    const tags = (await getTranscriptTagMap([transcriptId])).get(transcriptId);
    return c.json({
      ...data,
      project_tag: tags?.project_tag ?? null,
      client_tag: tags?.client_tag ?? null,
    });
  } catch (tagError) {
    return c.json(
      { error: tagError instanceof Error ? tagError.message : 'Failed to load transcript tags' },
      500
    );
  }
});

// Mention source payload
transcriptsRouter.get('/transcripts/:id/source', async (c) => {
  const transcriptId = c.req.param('id');
  const user = c.get('user');

  const canView = await canUserViewTranscript(user.id, user.email, transcriptId);
  if (!canView) {
    return c.json({ error: 'Not found' }, 404);
  }

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('transcripts')
    .select('id, title, date, summary')
    .eq('id', transcriptId)
    .maybeSingle();

  if (error) {
    return c.json({ error: error.message }, 500);
  }
  if (!data) {
    return c.json({ error: 'Not found' }, 404);
  }

  try {
    const tags = (await getTranscriptTagMap([transcriptId])).get(transcriptId);
    return c.json({
      ...data,
      project_tag: tags?.project_tag ?? null,
      client_tag: tags?.client_tag ?? null,
    });
  } catch (tagError) {
    return c.json(
      { error: tagError instanceof Error ? tagError.message : 'Failed to load transcript tags' },
      500
    );
  }
});

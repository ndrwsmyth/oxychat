import { Hono } from 'hono';
import type { AppVariables } from '../types.js';
import {
  AccessDeniedError,
  assertProjectAccess,
  assertConversationOwnership,
} from '../lib/acl.js';
import { getSupabase } from '../lib/supabase.js';
import {
  searchAccessibleDocumentsForProject,
  searchDocumentsGlobal,
  type AccessibleDocument,
} from '../lib/document-access.js';

export const documentsRouter = new Hono<{ Variables: AppVariables }>();

type MentionQueryMode = 'project_global' | 'global_only' | 'personal_global_fallback';

const DEFAULT_MENTION_BUCKET_LIMIT = 20;

function parseMentionBucketLimit(limitRaw: unknown): number {
  if (typeof limitRaw !== 'number') return DEFAULT_MENTION_BUCKET_LIMIT;
  if (!Number.isFinite(limitRaw)) return DEFAULT_MENTION_BUCKET_LIMIT;
  return Math.min(30, Math.max(10, Math.floor(limitRaw)));
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

  if (error) throw new Error(`Failed to load project scope: ${error.message}`);
  if (!project) return { projectId: null, mode: 'global_only' };

  const scope = (project as { scope: string }).scope;
  if (scope === 'personal') {
    return { projectId: resolvedProjectId, mode: 'personal_global_fallback' };
  }

  return { projectId: resolvedProjectId, mode: 'project_global' };
}

// POST /documents/mentions/query — scoped document mention search (S6-T06)
documentsRouter.post('/documents/mentions/query', async (c) => {
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

    let project: AccessibleDocument[] = [];
    let global: AccessibleDocument[] = [];

    if (scope.mode === 'project_global' && scope.projectId) {
      const allForProject = await searchAccessibleDocumentsForProject(
        scope.projectId,
        query,
        bucketLimit * 3
      );
      project = allForProject
        .filter((d) => d.visibility_scope === 'project' || d.visibility_scope === 'client')
        .slice(0, bucketLimit);
      const projectIdSet = new Set(project.map((d) => d.id));
      global = allForProject
        .filter((d) => !projectIdSet.has(d.id))
        .slice(0, bucketLimit);
    } else {
      global = await searchDocumentsGlobal(query, bucketLimit);
    }

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
    return c.json({ error: error instanceof Error ? error.message : 'Document mention query failed' }, 500);
  }
});

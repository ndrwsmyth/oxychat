import { Hono } from 'hono';
import type { AppVariables } from '../types.js';
import { AccessDeniedError } from '../lib/acl.js';
import { assertTranscriptRelinkAllowed } from '../lib/transcript-policy.js';
import { withDbClient } from '../lib/db.js';
import { writeAuditEvent } from '../lib/audit.js';
import type { TranscriptLinkSource } from '../types/transcript-link.js';
import {
  LockConflictError,
  acquireTranscriptRelinkLock,
  releaseTranscriptRelinkLock,
} from '../lib/transcript-relink-lock.js';
import {
  adminBadRequest,
  adminConflict,
  adminForbidden,
  adminInternalError,
} from '../lib/admin-error.js';
import { isUuid } from '../lib/validation.js';

interface RelinkResultRow {
  transcript_id: string;
  project_id: string;
  link_source: TranscriptLinkSource;
  updated_at: string;
}

interface PgLikeError {
  code?: string;
  constraint?: string;
}

const EXPECTED_RELINK_CONSTRAINTS = new Set<string>([
  'idx_transcript_project_links_transcript_unique',
  'transcript_project_links_transcript_id_project_id_key',
]);

function isExpectedRelinkConflict(error: unknown): boolean {
  const dbError = error as PgLikeError;
  return (
    dbError?.code === '23505' &&
    typeof dbError.constraint === 'string' &&
    EXPECTED_RELINK_CONSTRAINTS.has(dbError.constraint)
  );
}

export const adminTranscriptsRouter = new Hono<{ Variables: AppVariables }>();

adminTranscriptsRouter.post('/admin/transcripts/:transcriptId/relink', async (c) => {
  const transcriptId = c.req.param('transcriptId');
  if (!isUuid(transcriptId)) {
    return adminBadRequest(c, 'transcriptId must be a valid UUID', { field: 'transcriptId' });
  }

  const body = await c.req.json().catch(() => ({}));
  const projectId = typeof body.project_id === 'string' ? body.project_id : '';
  if (!isUuid(projectId)) {
    return adminBadRequest(c, 'project_id must be a valid UUID', { field: 'project_id' });
  }

  try {
    await assertTranscriptRelinkAllowed(transcriptId);
    let lockAcquired = false;
    const userId = c.get('user').id;

    try {
      await acquireTranscriptRelinkLock({
        transcriptId,
        userId,
      });
      lockAcquired = true;

      const row = await withDbClient(async (client) => {
        const { rows } = await client.query<RelinkResultRow>(
          `
            INSERT INTO transcript_project_links (
              transcript_id,
              project_id,
              link_source,
              updated_at
            )
            VALUES ($1::uuid, $2::uuid, 'admin_manual', now())
            ON CONFLICT (transcript_id)
            DO UPDATE SET
              project_id = EXCLUDED.project_id,
              link_source = 'admin_manual',
              updated_at = now()
            RETURNING transcript_id, project_id, link_source, updated_at
          `,
          [transcriptId, projectId]
        );

        if (!rows[0]) {
          throw new Error('Relink did not return a row');
        }

        return rows[0];
      });

      await writeAuditEvent({
        actorUserId: userId,
        eventType: 'transcript.routed',
        entityType: 'transcript',
        entityId: transcriptId,
        payload: {
          project_id: row.project_id,
          link_source: row.link_source,
        },
      });

      return c.json(row);
    } finally {
      if (lockAcquired) {
        await releaseTranscriptRelinkLock({
          transcriptId,
          userId,
        });
      }
    }
  } catch (error) {
    if (error instanceof AccessDeniedError) {
      return adminForbidden(c, error.message);
    }
    if (error instanceof LockConflictError) {
      return adminConflict(c, error.message);
    }
    if (isExpectedRelinkConflict(error)) {
      return adminConflict(c, 'Transcript relink conflict');
    }
    return adminInternalError(
      c,
      error instanceof Error ? error.message : 'Failed to relink transcript'
    );
  }
});

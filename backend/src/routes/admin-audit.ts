import { Hono } from 'hono';
import type { AppVariables } from '../types.js';
import { withDbClient } from '../lib/db.js';
import { adminBadRequest, adminInternalError } from '../lib/admin-error.js';
import {
  redactAuditEventsForViewer,
  type AuditEventRow,
} from '../lib/admin-audit-redaction.js';
import { UUID_PATTERN } from '../lib/validation.js';

interface AuditCursor {
  created_at: string;
  id: string;
}

interface AuditRowRecord {
  id: string;
  actor_user_id: string | null;
  event_type: string;
  entity_type: string;
  entity_id: string | null;
  request_id: string | null;
  payload: Record<string, unknown> | null;
  created_at: string;
}

const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;

function encodeCursor(cursor: AuditCursor): string {
  return Buffer.from(JSON.stringify(cursor), 'utf8').toString('base64');
}

function decodeCursor(cursor: string): AuditCursor | null {
  try {
    const decoded = Buffer.from(cursor, 'base64').toString('utf8');
    const parsed = JSON.parse(decoded) as Partial<AuditCursor>;
    if (
      typeof parsed.created_at !== 'string' ||
      Number.isNaN(Date.parse(parsed.created_at)) ||
      typeof parsed.id !== 'string' ||
      !UUID_PATTERN.test(parsed.id)
    ) {
      return null;
    }
    return {
      created_at: parsed.created_at,
      id: parsed.id,
    };
  } catch {
    return null;
  }
}

function parseLimit(rawLimit: string | undefined): number | null {
  if (!rawLimit) return DEFAULT_LIMIT;
  const parsed = Number.parseInt(rawLimit, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return Math.min(parsed, MAX_LIMIT);
}

export const adminAuditRouter = new Hono<{ Variables: AppVariables }>();

adminAuditRouter.get('/admin/audit', async (c) => {
  const limit = parseLimit(c.req.query('limit'));
  if (!limit) {
    return adminBadRequest(c, 'limit must be a positive integer');
  }

  const cursorRaw = c.req.query('cursor');
  const cursor = cursorRaw ? decodeCursor(cursorRaw) : null;
  if (cursorRaw && !cursor) {
    return adminBadRequest(c, 'cursor is invalid');
  }

  const includeBenchRaw = c.req.query('include_bench');
  const includeBench = includeBenchRaw === '1' || includeBenchRaw === 'true';

  try {
    const rows = await withDbClient(async (client) => {
      const whereClauses: string[] = [];
      const params: Array<string | number> = [];

      if (!includeBench) {
        whereClauses.push(`event_type NOT LIKE 'bench.%'`);
      }

      if (cursor) {
        params.push(cursor.created_at, cursor.id);
        whereClauses.push(
          `(created_at, id) < ($${params.length - 1}::timestamptz, $${params.length}::uuid)`
        );
      }

      params.push(limit + 1);

      const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

      const sql = `
        SELECT id, actor_user_id, event_type, entity_type, entity_id, request_id, payload, created_at
        FROM audit_events
        ${whereSql}
        ORDER BY created_at DESC, id DESC
        LIMIT $${params.length}::integer
      `;

      const result = await client.query<AuditRowRecord>(sql, params);
      return result.rows;
    });

    const pageRows = rows.slice(0, limit).map<AuditEventRow>((row) => ({
      id: row.id,
      actor_user_id: row.actor_user_id,
      event_type: row.event_type,
      entity_type: row.entity_type,
      entity_id: row.entity_id,
      request_id: row.request_id,
      payload: row.payload ?? {},
      created_at: row.created_at,
    }));

    const nextCursor =
      rows.length > limit && pageRows.length > 0
        ? encodeCursor({
            created_at: pageRows[pageRows.length - 1].created_at,
            id: pageRows[pageRows.length - 1].id,
          })
        : null;

    const items = await redactAuditEventsForViewer(pageRows, c.get('user').email);
    return c.json({
      items,
      next_cursor: nextCursor,
    });
  } catch (error) {
    return adminInternalError(
      c,
      error instanceof Error ? error.message : 'Failed to load audit events'
    );
  }
});

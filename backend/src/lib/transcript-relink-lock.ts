import { withDbClient } from './db.js';

export class LockConflictError extends Error {
  constructor(message = 'Transcript relink is already in progress') {
    super(message);
    this.name = 'LockConflictError';
  }
}

interface AcquireTranscriptRelinkLockInput {
  transcriptId: string;
  userId: string;
  ttlSeconds?: number;
}

interface ReleaseTranscriptRelinkLockInput {
  transcriptId: string;
  userId: string;
}

export async function acquireTranscriptRelinkLock(input: AcquireTranscriptRelinkLockInput): Promise<void> {
  const ttlSeconds = Number.isFinite(input.ttlSeconds) && (input.ttlSeconds ?? 0) > 0
    ? Math.floor(input.ttlSeconds as number)
    : 60;

  const result = await withDbClient((client) =>
    client.query(
      `
        INSERT INTO transcript_relink_locks (
          transcript_id,
          locked_by,
          expires_at,
          created_at,
          updated_at
        )
        VALUES (
          $1::uuid,
          $2::uuid,
          now() + make_interval(secs => $3::integer),
          now(),
          now()
        )
        ON CONFLICT (transcript_id)
        DO UPDATE SET
          locked_by = EXCLUDED.locked_by,
          expires_at = EXCLUDED.expires_at,
          updated_at = now()
        WHERE transcript_relink_locks.expires_at <= now()
        RETURNING transcript_id
      `,
      [input.transcriptId, input.userId, ttlSeconds]
    )
  );

  if ((result.rows?.length ?? 0) === 0) {
    throw new LockConflictError();
  }
}

export async function releaseTranscriptRelinkLock(input: ReleaseTranscriptRelinkLockInput): Promise<void> {
  await withDbClient((client) =>
    client.query(
      `
        DELETE FROM transcript_relink_locks
        WHERE transcript_id = $1::uuid
          AND locked_by = $2::uuid
      `,
      [input.transcriptId, input.userId]
    )
  );
}

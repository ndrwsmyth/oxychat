import type { PoolClient } from 'pg';
import { type NormalizedTranscript } from '../adapters/transcript-sources.js';
import { withDbClient } from './db.js';
import { computeTranscriptClassification } from './transcript-classification.js';
import {
  extractDomainRoot,
  normalizeAttendee,
  normalizeTitle,
} from './transcript-normalization.js';
import type { TranscriptLinkSource } from '../tasks/resolve-project-links.js';

interface ProjectCandidate {
  projectId: string;
  clientId: string;
}

interface ExistingClassification {
  visibility: 'private' | 'non_private';
  classification_reason: string;
  is_weekly_exception: boolean;
}

interface ExistingLink {
  project_id: string;
  link_source: TranscriptLinkSource;
}

export interface IngestEnvelopeInput {
  transcript: NormalizedTranscript;
  requestId?: string | null;
}

export interface IngestEnvelopeResult {
  transcriptId: string;
  isNew: boolean;
  visibility: 'private' | 'non_private';
  classificationReason: string;
  isWeeklyException: boolean;
  projectId: string | null;
  linkSource: TranscriptLinkSource | null;
}

async function resolveProjectByDomain(
  client: PoolClient,
  attendeeDomains: string[]
): Promise<ProjectCandidate | null> {
  if (attendeeDomains.length === 0) return null;

  const { rows } = await client.query<{ project_id: string; client_id: string }>(
    `
      SELECT p.id AS project_id, p.client_id
      FROM project_domains pd
      INNER JOIN projects p ON p.id = pd.project_id
      WHERE pd.normalized_domain = ANY($1::text[])
      ORDER BY p.id ASC
      LIMIT 1
    `,
    [attendeeDomains]
  );

  if (!rows[0]) return null;
  return {
    projectId: rows[0].project_id,
    clientId: rows[0].client_id,
  };
}

async function resolveProjectByTitleAlias(
  client: PoolClient,
  normalizedTitle: string
): Promise<ProjectCandidate | null> {
  const { rows } = await client.query<{ project_id: string; client_id: string }>(
    `
      SELECT p.id AS project_id, p.client_id
      FROM project_aliases pa
      INNER JOIN projects p ON p.id = pa.project_id
      WHERE pa.normalized_alias = $1
      LIMIT 1
    `,
    [normalizedTitle]
  );

  if (!rows[0]) return null;
  return {
    projectId: rows[0].project_id,
    clientId: rows[0].client_id,
  };
}

async function resolveClientInbox(
  client: PoolClient,
  clientId: string
): Promise<ProjectCandidate | null> {
  const { rows } = await client.query<{ project_id: string; client_id: string }>(
    `
      SELECT p.id AS project_id, p.client_id
      FROM projects p
      WHERE p.client_id = $1
        AND p.is_inbox = true
      ORDER BY p.name ASC, p.id ASC
      LIMIT 1
    `,
    [clientId]
  );

  if (!rows[0]) return null;
  return {
    projectId: rows[0].project_id,
    clientId: rows[0].client_id,
  };
}

async function resolveKnownClientFromDomainRoots(
  client: PoolClient,
  domainRoots: string[]
): Promise<string | null> {
  for (const root of domainRoots) {
    const exact = await client.query<{ id: string }>(
      `
        SELECT id
        FROM clients
        WHERE normalized_name = $1
        ORDER BY id ASC
        LIMIT 1
      `,
      [root]
    );
    if (exact.rows[0]?.id) {
      return exact.rows[0].id;
    }

    const prefix = await client.query<{ id: string }>(
      `
        SELECT id
        FROM clients
        WHERE normalized_name LIKE $1
        ORDER BY normalized_name ASC, id ASC
        LIMIT 1
      `,
      [`${root}%`]
    );
    if (prefix.rows[0]?.id) {
      return prefix.rows[0].id;
    }
  }

  return null;
}

async function resolveGlobalTriageInbox(client: PoolClient): Promise<ProjectCandidate | null> {
  const { rows } = await client.query<{ project_id: string; client_id: string }>(
    `
      SELECT p.id AS project_id, p.client_id
      FROM projects p
      WHERE p.scope = 'global'
        AND p.is_inbox = true
      ORDER BY p.name ASC, p.id ASC
      LIMIT 1
    `
  );

  if (!rows[0]) return null;
  return {
    projectId: rows[0].project_id,
    clientId: rows[0].client_id,
  };
}

async function resolveProjectLink(
  client: PoolClient,
  transcriptTitle: string,
  attendeeDomains: string[],
  attendeeDomainRoots: string[]
): Promise<{ candidate: ProjectCandidate | null; source: TranscriptLinkSource | null }> {
  const domainMatch = await resolveProjectByDomain(client, attendeeDomains);
  if (domainMatch) {
    return { candidate: domainMatch, source: 'domain_match' };
  }

  const aliasMatch = await resolveProjectByTitleAlias(client, normalizeTitle(transcriptTitle));
  if (aliasMatch) {
    return { candidate: aliasMatch, source: 'title_alias' };
  }

  const knownClientId = await resolveKnownClientFromDomainRoots(client, attendeeDomainRoots);
  if (knownClientId) {
    const clientInbox = await resolveClientInbox(client, knownClientId);
    if (clientInbox) {
      return { candidate: clientInbox, source: 'client_inbox_fallback' };
    }
  }

  const globalInbox = await resolveGlobalTriageInbox(client);
  if (globalInbox) {
    return { candidate: globalInbox, source: 'global_triage_fallback' };
  }

  return { candidate: null, source: null };
}

async function insertAuditEvent(
  client: PoolClient,
  eventType: string,
  transcriptId: string,
  payload: Record<string, unknown>,
  requestId?: string | null
): Promise<void> {
  await client.query(
    `
      INSERT INTO audit_events (event_type, entity_type, entity_id, request_id, payload)
      VALUES ($1, 'transcript', $2::uuid, $3, $4::jsonb)
    `,
    [eventType, transcriptId, requestId ?? null, JSON.stringify(payload)]
  );
}

export async function ingestTranscriptEnvelope(input: IngestEnvelopeInput): Promise<IngestEnvelopeResult> {
  return withDbClient(async (client) => {
    await client.query('BEGIN');
    try {
      const transcript = input.transcript;
      const transcriptResult = await client.query<{ id: string; inserted: boolean }>(
        `
          INSERT INTO transcripts (source_id, title, content, summary, date, raw_json, updated_at)
          VALUES ($1, $2, $3, $4, $5, $6::jsonb, now())
          ON CONFLICT (source_id)
          DO UPDATE SET
            title = EXCLUDED.title,
            content = EXCLUDED.content,
            summary = EXCLUDED.summary,
            date = EXCLUDED.date,
            raw_json = EXCLUDED.raw_json,
            updated_at = now()
          RETURNING id, (xmax = 0) AS inserted
        `,
        [
          transcript.sourceId,
          transcript.title,
          transcript.content,
          transcript.summary,
          transcript.date.toISOString(),
          JSON.stringify(transcript.rawJson ?? {}),
        ]
      );

      const transcriptId = transcriptResult.rows[0]?.id;
      const isNew = transcriptResult.rows[0]?.inserted ?? false;
      if (!transcriptId) {
        throw new Error('Failed to persist transcript row');
      }

      const normalizedAttendees = transcript.attendees
        .map((attendee) => normalizeAttendee(attendee.email, attendee.name))
        .filter((attendee): attendee is NonNullable<typeof attendee> => attendee !== null);

      if (normalizedAttendees.length > 0) {
        await client.query(
          `
            INSERT INTO transcript_attendees (transcript_id, email, name)
            SELECT
              $1::uuid,
              attendee.email,
              attendee.name
            FROM jsonb_to_recordset($2::jsonb) AS attendee(email text, name text)
            ON CONFLICT (transcript_id, normalized_email)
            DO UPDATE SET
              email = EXCLUDED.email,
              name = COALESCE(EXCLUDED.name, transcript_attendees.name)
          `,
          [
            transcriptId,
            JSON.stringify(
              normalizedAttendees.map((attendee) => ({
                email: attendee.email,
                name: attendee.name,
              }))
            ),
          ]
        );
      }

      const existingClassificationResult = await client.query<ExistingClassification>(
        `
          SELECT visibility, classification_reason, is_weekly_exception
          FROM transcript_classification
          WHERE transcript_id = $1::uuid
          LIMIT 1
        `,
        [transcriptId]
      );
      const existingClassification = existingClassificationResult.rows[0] ?? null;

      const classification = computeTranscriptClassification({
        title: transcript.title,
        attendeeEmails: normalizedAttendees.map((attendee) => attendee.normalizedEmail),
      });

      await client.query(
        `
          INSERT INTO transcript_classification (
            transcript_id,
            visibility,
            classification_reason,
            is_weekly_exception,
            normalized_title,
            attendee_count,
            external_attendee_count,
            classified_at,
            updated_at
          )
          VALUES ($1::uuid, $2, $3, $4, $5, $6, $7, now(), now())
          ON CONFLICT (transcript_id)
          DO UPDATE SET
            visibility = EXCLUDED.visibility,
            classification_reason = EXCLUDED.classification_reason,
            is_weekly_exception = EXCLUDED.is_weekly_exception,
            normalized_title = EXCLUDED.normalized_title,
            attendee_count = EXCLUDED.attendee_count,
            external_attendee_count = EXCLUDED.external_attendee_count,
            classified_at = now(),
            updated_at = now()
        `,
        [
          transcriptId,
          classification.visibility,
          classification.reason,
          classification.isWeeklyException,
          classification.normalizedTitle,
          classification.attendeeCount,
          classification.externalAttendeeCount,
        ]
      );

      const classificationChanged =
        !existingClassification ||
        existingClassification.visibility !== classification.visibility ||
        existingClassification.classification_reason !== classification.reason ||
        existingClassification.is_weekly_exception !== classification.isWeeklyException;

      const existingLinkResult = await client.query<ExistingLink>(
        `
          SELECT project_id, link_source
          FROM transcript_project_links
          WHERE transcript_id = $1::uuid
          LIMIT 1
        `,
        [transcriptId]
      );
      const existingLink = existingLinkResult.rows[0] ?? null;

      let projectId: string | null = null;
      let linkSource: TranscriptLinkSource | null = null;

      if (classification.visibility === 'non_private') {
        const attendeeDomains = [
          ...new Set(
            normalizedAttendees
              .map((attendee) => attendee.domain)
              .filter((domain): domain is string => typeof domain === 'string' && domain.length > 0)
          ),
        ];
        const attendeeDomainRoots = [...new Set(attendeeDomains.map((domain) => extractDomainRoot(domain)))];

        const resolved = await resolveProjectLink(
          client,
          transcript.title,
          attendeeDomains,
          attendeeDomainRoots
        );

        await client.query('DELETE FROM transcript_project_links WHERE transcript_id = $1::uuid', [transcriptId]);

        if (resolved.candidate && resolved.source) {
          await client.query(
            `
              INSERT INTO transcript_project_links (
                transcript_id,
                project_id,
                link_source,
                updated_at
              )
              VALUES ($1::uuid, $2::uuid, $3, now())
            `,
            [transcriptId, resolved.candidate.projectId, resolved.source]
          );

          projectId = resolved.candidate.projectId;
          linkSource = resolved.source;
        }
      } else {
        await client.query('DELETE FROM transcript_project_links WHERE transcript_id = $1::uuid', [transcriptId]);
      }

      const linkChanged =
        (existingLink?.project_id ?? null) !== projectId ||
        (existingLink?.link_source ?? null) !== linkSource;

      if (isNew) {
        await insertAuditEvent(
          client,
          'transcript.ingested',
          transcriptId,
          {
            source_id: transcript.sourceId,
          },
          input.requestId
        );
      }

      if (isNew || classificationChanged) {
        await insertAuditEvent(
          client,
          'transcript.classified',
          transcriptId,
          {
            visibility: classification.visibility,
            reason: classification.reason,
            is_weekly_exception: classification.isWeeklyException,
          },
          input.requestId
        );
      }

      if (isNew || linkChanged) {
        await insertAuditEvent(
          client,
          'transcript.routed',
          transcriptId,
          {
            project_id: projectId,
            link_source: linkSource,
          },
          input.requestId
        );
      }

      await client.query('COMMIT');

      return {
        transcriptId,
        isNew,
        visibility: classification.visibility,
        classificationReason: classification.reason,
        isWeeklyException: classification.isWeeklyException,
        projectId,
        linkSource,
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
  });
}

import { normalizeAttendee } from './transcript-normalization.js';

export interface TranscriptAttendeeRow {
  email: string;
  name: string | null;
}

export function extractAttendeesFromRawJson(rawJson: unknown): TranscriptAttendeeRow[] {
  if (!rawJson || typeof rawJson !== 'object') {
    return [];
  }

  const attendees = (rawJson as { attendees?: unknown }).attendees;
  if (!Array.isArray(attendees)) {
    return [];
  }

  return attendees
    .map((row) => {
      if (!row || typeof row !== 'object') {
        return null;
      }

      const candidate = row as { email?: unknown; name?: unknown };
      if (typeof candidate.email !== 'string' || candidate.email.trim().length === 0) {
        return null;
      }

      const normalized = normalizeAttendee(
        candidate.email,
        typeof candidate.name === 'string' ? candidate.name : null
      );

      if (!normalized) {
        return null;
      }

      return {
        email: normalized.email,
        name: normalized.name,
      } satisfies TranscriptAttendeeRow;
    })
    .filter((row): row is TranscriptAttendeeRow => row !== null);
}

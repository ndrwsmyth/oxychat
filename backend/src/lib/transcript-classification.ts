import {
  getInternalDomains,
  isInternalDomain,
  isWeeklyPlanningTitle,
  normalizeTitle,
} from './transcript-normalization.js';

export type TranscriptVisibility = 'private' | 'non_private';

export interface ClassificationDecision {
  visibility: TranscriptVisibility;
  reason: 'weekly_exception' | 'external_attendee' | 'internal_attendees_only' | 'no_attendees';
  isWeeklyException: boolean;
  normalizedTitle: string;
  attendeeCount: number;
  externalAttendeeCount: number;
}

export interface ClassificationInput {
  title: string;
  attendeeEmails: string[];
  allowedInternalDomains?: string[];
}

export function computeTranscriptClassification(input: ClassificationInput): ClassificationDecision {
  const normalizedTitle = normalizeTitle(input.title);
  const allowedInternalDomains = input.allowedInternalDomains ?? getInternalDomains();

  if (isWeeklyPlanningTitle(input.title)) {
    return {
      visibility: 'non_private',
      reason: 'weekly_exception',
      isWeeklyException: true,
      normalizedTitle,
      attendeeCount: input.attendeeEmails.length,
      externalAttendeeCount: 0,
    };
  }

  const externalAttendeeCount = input.attendeeEmails.reduce((count, email) => {
    const domain = email.split('@')[1]?.trim().toLowerCase();
    if (!domain) {
      return count;
    }
    return isInternalDomain(domain, allowedInternalDomains) ? count : count + 1;
  }, 0);

  if (input.attendeeEmails.length === 0) {
    return {
      visibility: 'private',
      reason: 'no_attendees',
      isWeeklyException: false,
      normalizedTitle,
      attendeeCount: 0,
      externalAttendeeCount: 0,
    };
  }

  if (externalAttendeeCount > 0) {
    return {
      visibility: 'non_private',
      reason: 'external_attendee',
      isWeeklyException: false,
      normalizedTitle,
      attendeeCount: input.attendeeEmails.length,
      externalAttendeeCount,
    };
  }

  return {
    visibility: 'private',
    reason: 'internal_attendees_only',
    isWeeklyException: false,
    normalizedTitle,
    attendeeCount: input.attendeeEmails.length,
    externalAttendeeCount: 0,
  };
}

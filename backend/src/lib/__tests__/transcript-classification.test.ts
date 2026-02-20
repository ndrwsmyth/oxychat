import { describe, expect, it } from 'vitest';
import { computeTranscriptClassification } from '../transcript-classification.js';

describe('computeTranscriptClassification', () => {
  it('marks weekly title as non-private exception', () => {
    const decision = computeTranscriptClassification({
      title: ' Oxy <> Weekly Planning ',
      attendeeEmails: ['member@oxy.so'],
    });

    expect(decision.visibility).toBe('non_private');
    expect(decision.reason).toBe('weekly_exception');
    expect(decision.isWeeklyException).toBe(true);
  });

  it('fails weekly substring match', () => {
    const decision = computeTranscriptClassification({
      title: 'Oxy <> Weekly Planning Notes',
      attendeeEmails: ['member@oxy.so'],
    });

    expect(decision.visibility).toBe('private');
    expect(decision.reason).toBe('internal_attendees_only');
  });

  it('marks external-attendee meetings as non-private', () => {
    const decision = computeTranscriptClassification({
      title: 'Client Sync',
      attendeeEmails: ['member@oxy.so', 'client@acme.com'],
    });

    expect(decision.visibility).toBe('non_private');
    expect(decision.reason).toBe('external_attendee');
    expect(decision.externalAttendeeCount).toBe(1);
  });

  it('fails closed to private when attendees are missing', () => {
    const decision = computeTranscriptClassification({
      title: 'No attendee payload',
      attendeeEmails: [],
    });

    expect(decision.visibility).toBe('private');
    expect(decision.reason).toBe('no_attendees');
  });
});

import { describe, expect, it } from 'vitest';
import { extractAttendeesFromRawJson } from '../transcript-attendees.js';

describe('extractAttendeesFromRawJson', () => {
  it('extracts attendee list and normalizes valid rows', () => {
    const attendees = extractAttendeesFromRawJson({
      attendees: [
        { name: ' Person One ', email: ' PERSON@Example.com ' },
        { name: 'Person Two', email: 'person.two@example.com' },
      ],
    });

    expect(attendees).toEqual([
      { name: 'Person One', email: 'PERSON@Example.com' },
      { name: 'Person Two', email: 'person.two@example.com' },
    ]);
  });

  it('returns empty array for invalid payloads', () => {
    expect(extractAttendeesFromRawJson(null)).toEqual([]);
    expect(extractAttendeesFromRawJson({})).toEqual([]);
    expect(extractAttendeesFromRawJson({ attendees: [{ name: 'No Email' }] })).toEqual([]);
  });
});

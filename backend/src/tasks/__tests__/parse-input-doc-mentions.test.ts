import { describe, expect, it } from 'vitest';
import { parseInputTask } from '../parse-input.js';

async function collectEvents(input: { content: string; mentionIds?: string[] }) {
  const events: unknown[] = [];
  for await (const event of parseInputTask.execute(input, {} as never)) {
    events.push(event);
  }
  return events;
}

describe('parseInputTask document mention separation', () => {
  it('separates doc: prefixed IDs into documentMentionIds', async () => {
    const events = await collectEvents({
      content: 'test',
      mentionIds: ['aaa', 'doc:bbb', 'ccc', 'doc:ddd'],
    });

    const result = events[0] as { mentionIds: string[]; documentMentionIds: string[] };
    expect(result.mentionIds).toEqual(['aaa', 'ccc']);
    expect(result.documentMentionIds).toEqual(['bbb', 'ddd']);
  });

  it('returns empty arrays when no mentions provided', async () => {
    const events = await collectEvents({ content: 'hello' });
    const result = events[0] as { mentionIds: string[]; documentMentionIds: string[] };
    expect(result.mentionIds).toEqual([]);
    expect(result.documentMentionIds).toEqual([]);
  });

  it('handles all-transcript mentions', async () => {
    const events = await collectEvents({
      content: 'test',
      mentionIds: ['t1', 't2'],
    });
    const result = events[0] as { mentionIds: string[]; documentMentionIds: string[] };
    expect(result.mentionIds).toEqual(['t1', 't2']);
    expect(result.documentMentionIds).toEqual([]);
  });

  it('handles all-document mentions', async () => {
    const events = await collectEvents({
      content: 'test',
      mentionIds: ['doc:d1', 'doc:d2'],
    });
    const result = events[0] as { mentionIds: string[]; documentMentionIds: string[] };
    expect(result.mentionIds).toEqual([]);
    expect(result.documentMentionIds).toEqual(['d1', 'd2']);
  });
});

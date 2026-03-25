import { defineTask } from '@ndrwsmyth/sediment';

export interface ParsedInput {
  content: string;
  mentionIds: string[];
  documentMentionIds: string[];
}

const DOC_MENTION_PREFIX = 'doc:';

/**
 * Extracts @mention IDs from a user message.
 * Separates transcript mentions (bare UUIDs) from document mentions (doc:{id}).
 */
export const parseInputTask = defineTask<
  { content: string; mentionIds?: string[] },
  ParsedInput
>('parse_input', async function* (input) {
  const rawIds = input.mentionIds ?? [];
  const transcriptIds: string[] = [];
  const documentIds: string[] = [];

  for (const id of rawIds) {
    if (id.startsWith(DOC_MENTION_PREFIX)) {
      documentIds.push(id.slice(DOC_MENTION_PREFIX.length));
    } else {
      transcriptIds.push(id);
    }
  }

  yield {
    content: input.content,
    mentionIds: transcriptIds,
    documentMentionIds: documentIds,
  };
});

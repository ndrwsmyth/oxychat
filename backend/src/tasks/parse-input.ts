import { defineTask } from '@ndrwsmyth/sediment';

export interface ParsedInput {
  content: string;
  mentionIds: string[];
}

/**
 * Extracts @mention IDs from a user message.
 * Mention format: doc_{id} passed as explicit array from frontend.
 */
export const parseInputTask = defineTask<
  { content: string; mentionIds?: string[] },
  ParsedInput
>('parse_input', async function* (input) {
  yield {
    content: input.content,
    mentionIds: input.mentionIds ?? [],
  };
});

export const AUTO_TRANSCRIPT_LINK_SOURCES = [
  'domain_match',
  'title_alias',
  'client_inbox_fallback',
  'global_triage_fallback',
] as const;

export type AutoTranscriptLinkSource = (typeof AUTO_TRANSCRIPT_LINK_SOURCES)[number];
export type TranscriptLinkSource = AutoTranscriptLinkSource | 'admin_manual';

const AUTO_SOURCE_SET = new Set<string>(AUTO_TRANSCRIPT_LINK_SOURCES);
const ALL_SOURCE_SET = new Set<string>([...AUTO_TRANSCRIPT_LINK_SOURCES, 'admin_manual']);

export function assertTranscriptLinkSource(source: string): TranscriptLinkSource {
  if (!ALL_SOURCE_SET.has(source)) {
    throw new Error(`Invalid transcript link source: ${source}`);
  }
  return source as TranscriptLinkSource;
}

export function assertAutoTranscriptLinkSource(source: string): AutoTranscriptLinkSource {
  if (!AUTO_SOURCE_SET.has(source)) {
    throw new Error(`Invalid auto transcript link source: ${source}`);
  }
  return source as AutoTranscriptLinkSource;
}

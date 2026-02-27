import { CHARS_PER_TOKEN, getContextLimit } from './constants.js';

const SECTION_SEPARATOR = '\n\n';

export interface PromptMentionDocument {
  id: string;
  title: string;
  content: string;
}

export interface PromptTruncationInfo {
  doc_id: string;
  title: string;
  truncated: boolean;
  percent_included: number;
}

export interface PromptSourceInfo {
  doc_id: string;
  title: string;
  type: 'mention' | 'overview';
}

interface BuildPromptContextInput {
  model: string;
  systemBase: string;
  projectOverviewMarkdown?: string;
  userContext?: string;
  mentionDocuments: PromptMentionDocument[];
  maxCharsOverride?: number;
}

export interface BuildPromptContextOutput {
  prompt: string;
  sources: PromptSourceInfo[];
  truncationInfo: PromptTruncationInfo[];
  totalChars: number;
  maxChars: number;
}

function computePercentIncluded(originalChars: number, includedChars: number): number {
  if (originalChars <= 0) return 100;
  return Math.max(0, Math.min(100, Math.round((includedChars / originalChars) * 100)));
}

function appendSimpleBlock(
  segments: string[],
  usedChars: number,
  maxChars: number,
  tag: string,
  rawContent: string | undefined,
  sources: PromptSourceInfo[],
  truncationInfo: PromptTruncationInfo[],
  sourceMeta?: { docId: string; title: string; type: 'mention' | 'overview' }
): number {
  const content = rawContent?.trim();
  if (!content) return usedChars;

  const prefix = `<${tag}>\n`;
  const suffix = `\n</${tag}>`;
  const separatorCost = SECTION_SEPARATOR.length;
  const availableContentChars = maxChars - usedChars - separatorCost - prefix.length - suffix.length;

  if (availableContentChars <= 0) {
    return usedChars;
  }

  const includedContent = content.slice(0, availableContentChars);
  if (!includedContent.trim()) {
    return usedChars;
  }

  const block = `${prefix}${includedContent}${suffix}`;
  segments.push(block);

  if (sourceMeta) {
    sources.push({
      doc_id: sourceMeta.docId,
      title: sourceMeta.title,
      type: sourceMeta.type,
    });
    truncationInfo.push({
      doc_id: sourceMeta.docId,
      title: sourceMeta.title,
      truncated: includedContent.length < content.length,
      percent_included: computePercentIncluded(content.length, includedContent.length),
    });
  }

  return usedChars + separatorCost + block.length;
}

function appendReferencedDocumentsBlock(
  segments: string[],
  usedChars: number,
  maxChars: number,
  documents: PromptMentionDocument[],
  sources: PromptSourceInfo[],
  truncationInfo: PromptTruncationInfo[]
): number {
  if (documents.length === 0) {
    return usedChars;
  }

  const sectionPrefix = '<referenced_documents>\n';
  const sectionSuffix = '\n</referenced_documents>';
  const sectionSeparatorCost = SECTION_SEPARATOR.length;

  const documentBlocks: string[] = [];
  let localChars = 0;

  for (const doc of documents) {
    const safeTitle = doc.title ?? '';
    const rawContent = doc.content ?? '';
    const docPrefix = `<document id="${doc.id}" title="${safeTitle}">\n`;
    const docSuffix = '\n</document>';
    const intraDocSeparator = documentBlocks.length > 0 ? SECTION_SEPARATOR.length : 0;

    const availableContentChars = maxChars
      - usedChars
      - sectionSeparatorCost
      - sectionPrefix.length
      - sectionSuffix.length
      - localChars
      - intraDocSeparator
      - docPrefix.length
      - docSuffix.length;

    if (availableContentChars <= 0) {
      break;
    }

    const includedContent = rawContent.slice(0, availableContentChars);
    if (!includedContent) {
      break;
    }

    const documentBlock = `${docPrefix}${includedContent}${docSuffix}`;
    documentBlocks.push(documentBlock);
    localChars += intraDocSeparator + documentBlock.length;

    sources.push({
      doc_id: doc.id,
      title: safeTitle,
      type: 'mention',
    });
    truncationInfo.push({
      doc_id: doc.id,
      title: safeTitle,
      truncated: includedContent.length < rawContent.length,
      percent_included: computePercentIncluded(rawContent.length, includedContent.length),
    });
  }

  if (documentBlocks.length === 0) {
    return usedChars;
  }

  const sectionBlock = `${sectionPrefix}${documentBlocks.join(SECTION_SEPARATOR)}${sectionSuffix}`;
  segments.push(sectionBlock);
  return usedChars + sectionSeparatorCost + sectionBlock.length;
}

export function buildPromptContext(input: BuildPromptContextInput): BuildPromptContextOutput {
  const maxChars = input.maxCharsOverride ?? getContextLimit(input.model) * CHARS_PER_TOKEN;
  const systemBase = input.systemBase.trim();
  const segments = [systemBase];
  const sources: PromptSourceInfo[] = [];
  const truncationInfo: PromptTruncationInfo[] = [];
  let usedChars = systemBase.length;

  usedChars = appendSimpleBlock(
    segments,
    usedChars,
    maxChars,
    'project_overview',
    input.projectOverviewMarkdown,
    sources,
    truncationInfo,
    { docId: 'overview', title: 'Project Overview', type: 'overview' }
  );
  usedChars = appendSimpleBlock(
    segments,
    usedChars,
    maxChars,
    'current_user_context',
    input.userContext,
    sources,
    truncationInfo
  );
  usedChars = appendReferencedDocumentsBlock(
    segments,
    usedChars,
    maxChars,
    input.mentionDocuments,
    sources,
    truncationInfo
  );

  const prompt = segments.join(SECTION_SEPARATOR);

  return {
    prompt,
    sources,
    truncationInfo,
    totalChars: prompt.length,
    maxChars,
  };
}

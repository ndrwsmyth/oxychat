import { describe, expect, it } from 'vitest';
import { buildPromptContext } from '../prompt-context.js';

describe('buildPromptContext', () => {
  it('assembles blocks in canonical order', () => {
    const result = buildPromptContext({
      model: 'claude-sonnet-4-6',
      systemBase: '<system>base</system>',
      projectOverviewMarkdown: 'Overview body',
      userContext: 'User context',
      mentionDocuments: [
        { id: 'm1', title: 'Doc 1', content: 'First doc content' },
        { id: 'm2', title: 'Doc 2', content: 'Second doc content' },
      ],
      maxCharsOverride: 10_000,
    });

    const overviewIndex = result.prompt.indexOf('<project_overview>');
    const userContextIndex = result.prompt.indexOf('<current_user_context>');
    const docsIndex = result.prompt.indexOf('<referenced_documents>');

    expect(overviewIndex).toBeGreaterThan(-1);
    expect(userContextIndex).toBeGreaterThan(overviewIndex);
    expect(docsIndex).toBeGreaterThan(userContextIndex);
    expect(result.sources.map((source) => source.type)).toEqual(['overview', 'mention', 'mention']);
  });

  it('enforces deterministic truncation against max chars', () => {
    const result = buildPromptContext({
      model: 'claude-sonnet-4-6',
      systemBase: '<system>base</system>',
      mentionDocuments: [
        { id: 'm1', title: 'Doc 1', content: 'a'.repeat(200) },
      ],
      maxCharsOverride: 120,
    });

    expect(result.totalChars).toBeLessThanOrEqual(120);
    expect(result.truncationInfo).toHaveLength(1);
    expect(result.truncationInfo[0]).toEqual(
      expect.objectContaining({
        doc_id: 'm1',
        title: 'Doc 1',
        truncated: true,
      })
    );
    expect(result.truncationInfo[0]?.percent_included).toBeLessThan(100);
  });

  it('records overview truncation metadata when overview is clipped', () => {
    const result = buildPromptContext({
      model: 'claude-sonnet-4-6',
      systemBase: '<system>base</system>',
      projectOverviewMarkdown: 'o'.repeat(400),
      mentionDocuments: [],
      maxCharsOverride: 140,
    });

    expect(result.totalChars).toBeLessThanOrEqual(140);
    expect(result.sources).toEqual([
      {
        doc_id: 'overview',
        title: 'Project Overview',
        type: 'overview',
      },
    ]);
    expect(result.truncationInfo[0]).toEqual(
      expect.objectContaining({
        doc_id: 'overview',
        truncated: true,
      })
    );
  });
});

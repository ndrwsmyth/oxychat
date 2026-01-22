/**
 * Tests for API utility functions
 *
 * Run with: pnpm test
 * (after installing vitest: pnpm add -D vitest)
 */

import { describe, it, expect } from 'vitest';
import { parseMentions } from '../lib/api';

describe('parseMentions', () => {
  it('extracts mentions in @[Title] format', () => {
    const result = parseMentions('@[Oxy Marketing Meeting] summarize');
    expect(result).toEqual(['Oxy Marketing Meeting']);
  });

  it('handles multiple mentions', () => {
    const result = parseMentions('@[Meeting 1] and @[Meeting 2]');
    expect(result).toEqual(['Meeting 1', 'Meeting 2']);
  });

  it('handles mentions with special characters', () => {
    const result = parseMentions('@[Q4 2024 Review - Sales] tell me about it');
    expect(result).toEqual(['Q4 2024 Review - Sales']);
  });

  it('returns empty array for no mentions', () => {
    const result = parseMentions('Just a regular message');
    expect(result).toEqual([]);
  });

  it('returns empty array for empty string', () => {
    const result = parseMentions('');
    expect(result).toEqual([]);
  });

  it('handles mentions at end of message', () => {
    const result = parseMentions('What about @[Important Meeting]');
    expect(result).toEqual(['Important Meeting']);
  });

  it('handles mentions with numbers', () => {
    const result = parseMentions('@[Meeting 123] summary');
    expect(result).toEqual(['Meeting 123']);
  });

  it('trims whitespace from mention titles', () => {
    const result = parseMentions('@[  Spaced Title  ] test');
    expect(result).toEqual(['Spaced Title']);
  });

  it('ignores @mentions without brackets (old format)', () => {
    const result = parseMentions('@OldStyleMention should not match');
    expect(result).toEqual([]);
  });

  it('handles complex real-world example', () => {
    const result = parseMentions(
      'Based on @[Oxy Brand Strategy Session] and @[Q4 Planning Meeting], what were the key decisions?'
    );
    expect(result).toEqual(['Oxy Brand Strategy Session', 'Q4 Planning Meeting']);
  });
});

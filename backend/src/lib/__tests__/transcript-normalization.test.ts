import { describe, expect, it } from 'vitest';
import {
  extractDomainRoot,
  extractEmailDomain,
  getInternalDomains,
  isInternalDomain,
  isWeeklyPlanningTitle,
  normalizeComparableText,
  normalizeEmail,
} from '../transcript-normalization.js';

describe('transcript normalization helpers', () => {
  it('normalizes comparable text using trim + lowercase', () => {
    expect(normalizeComparableText('  Hello World  ')).toBe('hello world');
  });

  it('normalizes email and extracts domain', () => {
    expect(normalizeEmail('  USER@Example.COM ')).toBe('user@example.com');
    expect(extractEmailDomain('  USER@Example.COM ')).toBe('example.com');
  });

  it('extracts domain roots', () => {
    expect(extractDomainRoot('acme.co.uk')).toBe('acme');
  });

  it('reads configured internal domains with fallback', () => {
    expect(getInternalDomains('oxy.so, oxy.co')).toEqual(['oxy.so', 'oxy.co']);
    expect(getInternalDomains('oxy.co')).toEqual(['oxy.so', 'oxy.co']);
    expect(getInternalDomains('')).toEqual(['oxy.so', 'oxy.co']);
    expect(isInternalDomain('OXY.SO', ['oxy.so'])).toBe(true);
  });

  it('matches weekly title only on normalized exact match', () => {
    expect(isWeeklyPlanningTitle(' Oxy <> Weekly Planning ')).toBe(true);
    expect(isWeeklyPlanningTitle('Oxy <> Weekly Planning - Notes')).toBe(false);
  });
});

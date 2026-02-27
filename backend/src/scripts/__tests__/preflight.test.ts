import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  assertAnyEnvVar,
  assertRequiredEnvVars,
  assertSupabaseServiceRoleKey,
  getRequiredDatabaseHostname,
} from '../lib/preflight.js';

const TARGET_KEYS = [
  'SUPABASE_URL',
  'SUPABASE_SERVICE_KEY',
  'SUPABASE_DATABASE_URL',
  'ANTHROPIC_API_KEY',
  'OPENAI_API_KEY',
] as const;
const originalValues = new Map<string, string | undefined>();

beforeEach(() => {
  for (const key of TARGET_KEYS) {
    originalValues.set(key, process.env[key]);
  }
});

afterEach(() => {
  for (const key of TARGET_KEYS) {
    const original = originalValues.get(key);
    if (typeof original === 'string') {
      process.env[key] = original;
    } else {
      delete process.env[key];
    }
  }
});

describe('script preflight helpers', () => {
  function makeJwt(payload: Record<string, unknown>): string {
    const base64url = (value: string) =>
      Buffer.from(value, 'utf8')
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/g, '');
    return `${base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))}.${base64url(
      JSON.stringify(payload)
    )}.signature`;
  }

  it('asserts required env vars', () => {
    process.env.SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_SERVICE_KEY = 'service-key';

    expect(() => {
      assertRequiredEnvVars('test-script', ['SUPABASE_URL', 'SUPABASE_SERVICE_KEY']);
    }).not.toThrow();
  });

  it('throws when required env vars are missing', () => {
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_KEY;

    expect(() => {
      assertRequiredEnvVars('test-script', ['SUPABASE_URL', 'SUPABASE_SERVICE_KEY']);
    }).toThrow('Missing required env vars for test-script: SUPABASE_URL, SUPABASE_SERVICE_KEY');
  });

  it('asserts any env var is present', () => {
    process.env.OPENAI_API_KEY = 'openai-key';
    delete process.env.ANTHROPIC_API_KEY;

    expect(assertAnyEnvVar('chat-latency', ['ANTHROPIC_API_KEY', 'OPENAI_API_KEY']))
      .toBe('OPENAI_API_KEY');
  });

  it('parses hostname from required database URL env var', () => {
    process.env.SUPABASE_DATABASE_URL = 'postgresql://postgres:secret@db.oxy.local:5432/postgres';
    expect(getRequiredDatabaseHostname('gate:s4')).toBe('db.oxy.local');
  });

  it('asserts service role key', () => {
    process.env.SUPABASE_SERVICE_KEY = makeJwt({ role: 'service_role' });
    expect(() => assertSupabaseServiceRoleKey('bench:s4-mentions')).not.toThrow();
  });

  it('accepts sb_secret service key format', () => {
    process.env.SUPABASE_SERVICE_KEY = 'sb_secret_abcdefghijklmnopqrstuvwxyz';
    expect(() => assertSupabaseServiceRoleKey('bench:s4-mentions')).not.toThrow();
  });

  it('throws when service key role is not service_role', () => {
    process.env.SUPABASE_SERVICE_KEY = makeJwt({ role: 'anon' });
    expect(() => assertSupabaseServiceRoleKey('bench:s4-mentions')).toThrow(
      'Invalid SUPABASE_SERVICE_KEY for bench:s4-mentions: expected service_role key, got anon'
    );
  });

  it('throws when key is publishable format', () => {
    process.env.SUPABASE_SERVICE_KEY = 'sb_publishable_abcdefghijklmnopqrstuvwxyz';
    expect(() => assertSupabaseServiceRoleKey('bench:s4-mentions')).toThrow(
      'Invalid SUPABASE_SERVICE_KEY for bench:s4-mentions: expected service_role key, got publishable key'
    );
  });
});

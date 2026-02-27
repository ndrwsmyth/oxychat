export function assertRequiredEnvVars(scriptName: string, keys: readonly string[]): void {
  const missing = keys.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(
      `Missing required env vars for ${scriptName}: ${missing.join(', ')}`
    );
  }
}

export function assertAnyEnvVar(scriptName: string, keys: readonly string[]): string {
  const present = keys.find((key) => Boolean(process.env[key]));
  if (!present) {
    throw new Error(
      `Missing one of required env vars for ${scriptName}: ${keys.join(' or ')}`
    );
  }
  return present;
}

function parseJwtPayload(token: string): Record<string, unknown> | null {
  const parts = token.split('.');
  if (parts.length < 2) return null;

  try {
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=');
    const decoded = Buffer.from(padded, 'base64').toString('utf-8');
    return JSON.parse(decoded) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function assertSupabaseServiceRoleKey(scriptName: string, envKey = 'SUPABASE_SERVICE_KEY'): void {
  const raw = process.env[envKey];
  if (!raw) {
    throw new Error(`Missing required env vars for ${scriptName}: ${envKey}`);
  }

  // Supabase "secret keys" use sb_secret_ prefix and are service-role equivalent.
  if (raw.startsWith('sb_secret_')) {
    return;
  }
  if (raw.startsWith('sb_publishable_')) {
    throw new Error(
      `Invalid ${envKey} for ${scriptName}: expected service_role key, got publishable key`
    );
  }

  const payload = parseJwtPayload(raw);
  const role = typeof payload?.role === 'string' ? payload.role : null;
  if (role !== 'service_role') {
    throw new Error(
      `Invalid ${envKey} for ${scriptName}: expected service_role key, got ${role ?? 'unknown'}`
    );
  }
}

export function getRequiredDatabaseHostname(scriptName: string, envKey = 'SUPABASE_DATABASE_URL'): string {
  const raw = process.env[envKey];
  if (!raw) {
    throw new Error(`Missing required env vars for ${scriptName}: ${envKey}`);
  }
  return new URL(raw).hostname;
}

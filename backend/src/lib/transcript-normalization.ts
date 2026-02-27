export const WEEKLY_PLANNING_CANONICAL_TITLE = 'oxy <> weekly planning';
const INTERNAL_DOMAINS_FALLBACK = ['oxy.so', 'oxy.co'];

export interface NormalizedAttendee {
  email: string;
  normalizedEmail: string;
  name: string | null;
  domain: string | null;
  domainRoot: string | null;
}

export function normalizeComparableText(value: string): string {
  return value.trim().toLowerCase();
}

export function normalizeEmail(email: string): string {
  return normalizeComparableText(email);
}

export function normalizeDomain(domain: string): string {
  return normalizeComparableText(domain).replace(/^@/, '');
}

export function extractEmailDomain(email: string): string | null {
  const normalized = normalizeEmail(email);
  const atIndex = normalized.lastIndexOf('@');
  if (atIndex < 1 || atIndex === normalized.length - 1) {
    return null;
  }
  return normalizeDomain(normalized.slice(atIndex + 1));
}

export function extractDomainRoot(domain: string): string {
  const normalized = normalizeDomain(domain);
  const [root] = normalized.split('.');
  return root ?? normalized;
}

export function normalizeTitle(title: string): string {
  return normalizeComparableText(title);
}

export function isWeeklyPlanningTitle(title: string): boolean {
  return normalizeTitle(title) === WEEKLY_PLANNING_CANONICAL_TITLE;
}

export function getInternalDomains(configValue = process.env.ALLOWED_EMAIL_DOMAINS): string[] {
  const configured = (configValue ?? '')
    .split(',')
    .map((value) => normalizeDomain(value))
    .filter(Boolean);

  if (configured.length === 0) {
    return INTERNAL_DOMAINS_FALLBACK;
  }

  // Keep Oxy defaults even when env config is partial to avoid accidental privacy regressions.
  return [...new Set([...INTERNAL_DOMAINS_FALLBACK, ...configured])];
}

export function isInternalDomain(domain: string, allowedDomains = getInternalDomains()): boolean {
  const normalized = normalizeDomain(domain);
  return allowedDomains.includes(normalized);
}

export function normalizeAttendee(email: string, name?: string | null): NormalizedAttendee | null {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail || !normalizedEmail.includes('@')) {
    return null;
  }

  const domain = extractEmailDomain(normalizedEmail);

  return {
    email: email.trim(),
    normalizedEmail,
    name: typeof name === 'string' && name.trim() ? name.trim() : null,
    domain,
    domainRoot: domain ? extractDomainRoot(domain) : null,
  };
}

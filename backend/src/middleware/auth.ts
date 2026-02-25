import { createClerkClient, verifyToken } from '@clerk/backend';
import type { Context, Next } from 'hono';
import { getSupabase } from '../lib/supabase.js';

export interface AuthUser {
  id: string;           // Supabase user_profiles.id (UUID)
  clerkId: string;      // Clerk user ID (e.g., user_2abc123)
  email: string;
  fullName: string | null;
  avatarUrl: string | null;
  context: string | null;
}

function isAllowedEmailDomain(email: string): boolean {
  const configuredDomains = (process.env.ALLOWED_EMAIL_DOMAINS ?? 'oxy.so,oxy.co')
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean)
    .map((value) => (value.startsWith('@') ? value : `@${value}`));

  return configuredDomains.some((domain) => email.toLowerCase().endsWith(domain));
}

interface UserProfileRow {
  id: string;
  clerk_id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  context: string | null;
}

interface ClerkBootstrapProfile {
  email: string;
  fullName: string | null;
  avatarUrl: string | null;
}

function extractBootstrapProfileFromClaims(claims: Record<string, unknown>): ClerkBootstrapProfile | null {
  const emailCandidates = [
    claims.email,
    claims.email_address,
    claims.emailAddress,
  ];
  const email = emailCandidates.find((value): value is string => typeof value === 'string' && value.trim().length > 0);
  if (!email) {
    return null;
  }

  const firstName = typeof claims.given_name === 'string' ? claims.given_name : '';
  const lastName = typeof claims.family_name === 'string' ? claims.family_name : '';
  const fullName = `${firstName} ${lastName}`.trim() || null;
  const avatarUrl = typeof claims.picture === 'string' ? claims.picture : null;

  return {
    email: email.trim().toLowerCase(),
    fullName,
    avatarUrl,
  };
}

async function fetchClerkUserProfile(clerkUserId: string): Promise<ClerkBootstrapProfile | null> {
  try {
    const clerk = createClerkClient({
      secretKey: process.env.CLERK_SECRET_KEY!,
    });
    const user = await clerk.users.getUser(clerkUserId);
    const primaryEmail =
      user.emailAddresses.find((entry) => entry.id === user.primaryEmailAddressId) ??
      user.emailAddresses[0];
    const email = primaryEmail?.emailAddress?.trim().toLowerCase();
    if (!email) {
      return null;
    }

    const fullName = [user.firstName, user.lastName].filter(Boolean).join(' ') || null;
    return {
      email,
      fullName,
      avatarUrl: user.imageUrl ?? null,
    };
  } catch (error) {
    console.error('[auth] Failed to load user from Clerk:', error);
    return null;
  }
}

async function getOrProvisionUserProfile(
  clerkUserId: string,
  claimsProfile: ClerkBootstrapProfile | null
): Promise<UserProfileRow | null> {
  const supabase = getSupabase();
  const { data: existing, error: existingError } = await supabase
    .from('user_profiles')
    .select('id, clerk_id, email, full_name, avatar_url, context')
    .eq('clerk_id', clerkUserId)
    .maybeSingle();

  if (existingError) {
    throw new Error(`Failed to load user profile: ${existingError.message}`);
  }
  if (existing) {
    return existing as UserProfileRow;
  }

  const clerkUser = claimsProfile ?? (await fetchClerkUserProfile(clerkUserId));
  if (!clerkUser) {
    return null;
  }
  if (!isAllowedEmailDomain(clerkUser.email)) {
    throw new Error('Unauthorized domain');
  }

  const { data: created, error: createError } = await supabase
    .from('user_profiles')
    .upsert(
      {
        clerk_id: clerkUserId,
        email: clerkUser.email,
        full_name: clerkUser.fullName,
        avatar_url: clerkUser.avatarUrl,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'clerk_id' }
    )
    .select('id, clerk_id, email, full_name, avatar_url, context')
    .single();

  if (createError) {
    throw new Error(`Failed to provision user profile: ${createError.message}`);
  }

  return created as UserProfileRow;
}

export async function authMiddleware(c: Context, next: Next) {
  const authHeader = c.req.header('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return c.json({ error: 'Missing authorization token' }, 401);
  }

  const token = authHeader.slice(7);

  try {
    // verifyToken returns claims: { sub, sid, exp, iat, iss, ... }
    const claims = await verifyToken(token, {
      secretKey: process.env.CLERK_SECRET_KEY!,
      // Optional: jwtKey for networkless verification
      // jwtKey: process.env.CLERK_JWT_KEY,
    });

    const clerkUserId = claims.sub; // e.g., "user_2abc123"
    const claimsProfile = extractBootstrapProfileFromClaims(claims as Record<string, unknown>);

    const user = await getOrProvisionUserProfile(clerkUserId, claimsProfile);
    if (!user) {
      return c.json({ error: 'User not found' }, 401);
    }

    // Belt and suspenders: validate allowed domains
    if (!isAllowedEmailDomain(user.email)) {
      return c.json({ error: 'Unauthorized domain' }, 403);
    }

    const authUser: AuthUser = {
      id: user.id,
      clerkId: user.clerk_id,
      email: user.email,
      fullName: user.full_name,
      avatarUrl: user.avatar_url,
      context: user.context,
    };
    c.set('user', authUser);

    await next();
  } catch (err) {
    console.error('[auth] Token verification failed:', err);
    if (err instanceof Error && err.message === 'Unauthorized domain') {
      return c.json({ error: 'Unauthorized domain' }, 403);
    }
    return c.json({ error: 'Invalid token' }, 401);
  }
}

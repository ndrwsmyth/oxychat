import { verifyToken } from '@clerk/backend';
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

    // Lookup in Supabase by clerk_id
    const supabase = getSupabase();
    const { data: user, error } = await supabase
      .from('user_profiles')
      .select('id, clerk_id, email, full_name, avatar_url, context')
      .eq('clerk_id', clerkUserId)
      .single();

    if (error || !user) {
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
    return c.json({ error: 'Invalid token' }, 401);
  }
}

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
    const allowedDomains = ['@oxy.so', '@oxy.co'];
    const isAllowedDomain = allowedDomains.some((domain) => user.email.endsWith(domain));
    if (!isAllowedDomain) {
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

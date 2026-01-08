/**
 * Supabase client configuration for Next.js App Router
 * Uses @supabase/ssr for server-side rendering support
 */

import { createBrowserClient } from '@supabase/ssr'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

/**
 * Create a Supabase client for use in Client Components
 * This client automatically handles auth state and session management
 */
export function createClient() {
  return createBrowserClient(supabaseUrl, supabaseAnonKey)
}

/**
 * Singleton Supabase client for client components
 * Reuses the same instance across the application
 */
export const supabase = createClient()

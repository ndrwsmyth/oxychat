/**
 * Supabase client configuration for Next.js App Router
 * Uses @supabase/ssr for server-side rendering support
 */

import { createBrowserClient } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

/**
 * Check if Supabase is configured
 */
export const isSupabaseConfigured = !!(supabaseUrl && supabaseAnonKey)

/**
 * Create a Supabase client for use in Client Components
 * Returns null if Supabase is not configured (local dev without auth)
 */
export function createClient(): SupabaseClient | null {
  if (!supabaseUrl || !supabaseAnonKey) {
    return null
  }
  return createBrowserClient(supabaseUrl, supabaseAnonKey)
}

/**
 * Singleton Supabase client for client components
 * Null if Supabase is not configured
 */
export const supabase = createClient()

import "server-only"

import { createClient as createSupabaseClient } from "@supabase/supabase-js"

import { getSupabasePublicEnv } from "@/lib/supabase/env"

/**
 * Anonymous Supabase client with no request cookies.
 * Safe to call inside `use cache`.
 */
export function createPublicClient() {
  const env = getSupabasePublicEnv()
  if (!env) {
    throw new Error("MISSING_SUPABASE_ENV")
  }

  return createSupabaseClient(env.url, env.key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })
}

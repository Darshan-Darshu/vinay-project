import { createBrowserClient } from "@supabase/ssr"

import { getSupabasePublicEnv } from "@/lib/supabase/env"

export function createClient() {
  const env = getSupabasePublicEnv()
  if (!env) {
    throw new Error("MISSING_SUPABASE_ENV")
  }

  return createBrowserClient(env.url, env.key)
}

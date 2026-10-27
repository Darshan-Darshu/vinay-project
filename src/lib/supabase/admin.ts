import "server-only"

import { createClient } from "@supabase/supabase-js"

import { getSupabasePublicEnv } from "@/lib/supabase/env"

/**
 * Service-role client for trusted server jobs such as creating a student
 * account after admission. Phase 1 does not call this.
 */
export function createAdminClient() {
  const env = getSupabasePublicEnv()
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!env || !serviceRoleKey) {
    throw new Error("SERVICE_ROLE_NOT_CONFIGURED")
  }

  return createClient(env.url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })
}

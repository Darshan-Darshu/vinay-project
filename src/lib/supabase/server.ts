import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"

import { getSupabasePublicEnv } from "@/lib/supabase/env"

export async function createClient() {
  const env = getSupabasePublicEnv()
  if (!env) {
    throw new Error("MISSING_SUPABASE_ENV")
  }

  const cookieStore = await cookies()

  return createServerClient(env.url, env.key, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options)
          }
        } catch {
          // Server Components cannot write cookies. The proxy refreshes the session.
        }
      },
    },
  })
}

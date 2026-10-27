import { unstable_rethrow } from "next/navigation"
import { NextResponse } from "next/server"

import { getCurrentProfile } from "@/lib/auth/session"
import { fail, ok } from "@/lib/api/response"
import { getSupabasePublicEnv } from "@/lib/supabase/env"

export async function GET() {
  if (!getSupabasePublicEnv()) {
    return fail("SERVICE_UNAVAILABLE", "Supabase is not configured.", 503)
  }

  try {
    const profile = await getCurrentProfile()
    if (!profile || !profile.isActive) {
      return fail(
        "UNAUTHORIZED",
        "You do not have permission to access this resource.",
        401,
      )
    }
    return NextResponse.json(ok(profile))
  } catch (error) {
    unstable_rethrow(error)
    return fail("INTERNAL", "We couldn't complete that request. Please try again.", 500)
  }
}

"use server"

import { redirect } from "next/navigation"

import { getCurrentProfile } from "@/lib/auth/session"
import { QueryError } from "@/lib/db/errors"
import { safeNextPath } from "@/lib/permissions/roles"
import { getSupabasePublicEnv } from "@/lib/supabase/env"
import { createClient } from "@/lib/supabase/server"
import { signInSchema } from "@/lib/validations/forms"

export type SignInState = {
  error: string | null
}

export async function signIn(
  _previous: SignInState,
  formData: FormData,
): Promise<SignInState> {
  if (!getSupabasePublicEnv()) {
    return { error: "Supabase is not configured yet." }
  }

  const parsed = signInSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    next: formData.get("next")?.toString(),
  })

  if (!parsed.success) {
    return { error: "Enter a valid email and password." }
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  })

  if (error) {
    return { error: "Email or password is incorrect." }
  }

  let profile: Awaited<ReturnType<typeof getCurrentProfile>>
  try {
    profile = await getCurrentProfile()
  } catch (error) {
    if (error instanceof QueryError) {
      await supabase.auth.signOut()
      return {
        error: "We couldn't load your profile. Please try again.",
      }
    }
    throw error
  }

  if (!profile) {
    await supabase.auth.signOut()
    return {
      error: "This account is not set up for the college yet. Ask the office to finish your profile.",
    }
  }

  if (!profile.isActive) {
    await supabase.auth.signOut()
    return { error: "This account is inactive." }
  }

  redirect(safeNextPath(profile.role, parsed.data.next ?? null))
}

export async function signOut() {
  if (getSupabasePublicEnv()) {
    const supabase = await createClient()
    await supabase.auth.signOut()
  }
  redirect("/login")
}

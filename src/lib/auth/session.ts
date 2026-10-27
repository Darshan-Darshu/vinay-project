import "server-only"

import { connection } from "next/server"
import { redirect } from "next/navigation"

import { QueryError, isRecord } from "@/lib/db/errors"
import {
  homeForRole,
  isAppRole,
  type AppRole,
  type Profile,
} from "@/lib/permissions/roles"
import { createClient } from "@/lib/supabase/server"

export async function getCurrentProfile(): Promise<Profile | null> {
  await connection()
  const supabase = await createClient()
  const { data: userResult, error: userError } = await supabase.auth.getUser()

  if (userError) {
    if (isTransientAuthError(userError)) throw new QueryError()
    return null
  }

  if (!userResult.user) {
    return null
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("id, role, full_name, email, phone, avatar_url, is_active")
    .eq("id", userResult.user.id)
    .is("deleted_at", null)
    .maybeSingle()

  if (error) {
    throw new QueryError()
  }

  if (!data || !isProfileRow(data)) {
    return null
  }

  return {
    id: data.id,
    role: data.role,
    fullName: data.full_name,
    email: data.email,
    phone: data.phone,
    avatarUrl: data.avatar_url,
    isActive: data.is_active,
  }
}

export async function requireUser(): Promise<Profile> {
  const profile = await getCurrentProfile()
  if (!profile) {
    redirect("/login")
  }
  if (!profile.isActive) {
    redirect("/login?error=inactive")
  }
  return profile
}

export async function requireRole(role: AppRole): Promise<Profile> {
  const profile = await requireUser()
  if (profile.role !== role) {
    redirect(homeForRole(profile.role))
  }
  return profile
}

type ProfileRow = {
  id: string
  role: AppRole
  full_name: string
  email: string
  phone: string | null
  avatar_url: string | null
  is_active: boolean
}

function isTransientAuthError(error: unknown) {
  if (!error || typeof error !== "object" || !("status" in error)) return false
  const status = Number(error.status) || 0
  return status === 429 || status >= 500
}

function isProfileRow(value: unknown): value is ProfileRow {
  if (!isRecord(value)) {
    return false
  }
  return (
    typeof value.id === "string" &&
    isAppRole(value.role) &&
    typeof value.full_name === "string" &&
    typeof value.email === "string" &&
    (value.phone === null || typeof value.phone === "string") &&
    (value.avatar_url === null || typeof value.avatar_url === "string") &&
    typeof value.is_active === "boolean"
  )
}

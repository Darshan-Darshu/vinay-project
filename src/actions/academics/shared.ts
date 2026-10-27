import "server-only"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

import { checkForm, fail, field, saveFailed, writeError } from "@/actions/admin/records/shared"
import type { FormState } from "@/actions/form-state"
import { requireUser } from "@/lib/auth/session"
import { readTeacherAssignment } from "@/lib/auth/teaching"
import { isRecord, QueryError } from "@/lib/db/errors"
import { homeForRole } from "@/lib/permissions/roles"
import { createClient } from "@/lib/supabase/server"

export { checkForm, fail, field, saveFailed }

const knownErrors = [
  "Add at least one question before publishing.",
  "The open time has to be before the close time.",
  "This paper is already published.",
  "You do not have permission to publish this paper.",
  "You do not have permission to edit this question.",
  "Published questions cannot be changed.",
  "Published papers cannot be changed.",
  "Each question needs one correct option.",
  "True or false questions need two options.",
  "Multiple choice questions need two to six options.",
  "This paper is not open.",
  "This paper is for another course.",
  "You have already taken this paper.",
  "Your enrollment is not on file yet.",
  "The paper has closed. This attempt has expired.",
  "This attempt is already submitted.",
  "That question could not be found.",
  "That paper could not be found.",
  "That attempt could not be found.",
  "Enter at most 40 skills.",
  "Each skill must be 40 characters or fewer.",
  "Check the form and try again.",
]

export function actionError(error: { code?: string; message?: string } | null) {
  const message = error?.message ?? ""
  const known = knownErrors.find((item) => message.includes(item))
  if (known) return known
  return writeError(error) ?? saveFailed
}

export async function staffContext() {
  const profile = await requireUser()
  if (profile.role !== "admin" && profile.role !== "teacher") {
    redirect(homeForRole(profile.role))
  }
  const supabase = await createClient()
  return { profile, supabase }
}

export async function studentContext() {
  const profile = await requireUser()
  if (profile.role !== "student") redirect(homeForRole(profile.role))
  const supabase = await createClient()
  return { profile, supabase }
}

export function refreshAcademic(paths: string[] = []) {
  const targets = new Set([
    "/admin/questions",
    "/admin/papers",
    "/admin/exam-papers",
    "/admin/materials",
    "/teacher/questions",
    "/teacher/papers",
    "/teacher/exam-papers",
    "/teacher/materials",
    "/student/tests",
    "/student/materials",
    "/student/profile",
    ...paths,
  ])
  for (const path of targets) revalidatePath(path)
}

export function ok(message: string): FormState {
  return { error: null, success: message }
}

export function relatedName(value: unknown, key: string) {
  const row = Array.isArray(value) ? value[0] : value
  if (!isRecord(row)) return ""
  const name = row[key]
  return typeof name === "string" ? name : ""
}

export async function taughtSubjectIds() {
  const { profile, supabase } = await staffContext()
  if (profile.role === "admin") {
    const subjects = await supabase.from("subjects").select("id").is("deleted_at", null).eq("is_active", true)
    if (subjects.error) throw new QueryError()
    return new Set(
      (subjects.data ?? []).flatMap((row) => (isRecord(row) && typeof row.id === "string" ? [row.id] : [])),
    )
  }

  const assignment = await readTeacherAssignment(profile.id)
  return assignment?.subjectIds ?? new Set<string>()
}

export type SubjectChoice = {
  id: string
  name: string
  courseName: string
}

export async function subjectChoices(): Promise<SubjectChoice[]> {
  const { profile, supabase } = await staffContext()
  const subjects = await supabase
    .from("subjects")
    .select("id, name, course_id, courses(name)")
    .is("deleted_at", null)
    .eq("is_active", true)
    .order("name")
  if (subjects.error) throw new QueryError()
  const allowed = profile.role === "admin" ? null : await taughtSubjectIds()
  return (subjects.data ?? []).flatMap((row) => {
    if (!isRecord(row) || typeof row.id !== "string" || typeof row.name !== "string") return []
    if (allowed && !allowed.has(row.id)) return []
    return [{ id: row.id, name: row.name, courseName: relatedName(row.courses, "name") }]
  })
}

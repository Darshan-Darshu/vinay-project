import "server-only"

import { revalidatePath, updateTag } from "next/cache"

import type { FormState } from "@/actions/form-state"
import { requireRole } from "@/lib/auth/session"
import { createClient } from "@/lib/supabase/server"

export const checkForm = "Check the form and try again."
export const saveFailed = "We couldn't save this record. Please try again."
export const loginFailed = "The office login could not be created."

const uniqueMessages: [string, string][] = [
  ["departments_name_key", "That department name is already in use."],
  ["departments_code_key", "That department code is already in use."],
  ["courses_code_key", "That course code is already in use."],
  ["subjects_course_id_code_key", "That subject code is already used on this course."],
  ["academic_years_name_key", "That academic year name is already in use."],
  ["academic_years_one_current_idx", "Another year is already marked current."],
  ["semesters_course_id_academic_year_id_number_key", "That semester already exists for this course and year."],
  ["teachers_employee_code_key", "That employee code is already in use."],
  ["students_roll_number_key", "That roll number is already in use."],
  ["profiles_email_key", "That email is already in use."],
]

export function ok(message: string): FormState {
  return { error: null, success: message }
}

export function fail(message: string): FormState {
  return { error: message, success: null }
}

export function field(formData: FormData, name: string) {
  const value = formData.get(name)
  return typeof value === "string" ? value : ""
}

export function fieldList(formData: FormData, name: string) {
  return formData.getAll(name).filter((value): value is string => typeof value === "string" && value.length > 0)
}

export function flagged(formData: FormData, name: string) {
  return field(formData, name) === "true"
}

export function writeError(
  error: { code?: string; message?: string } | null,
  fallback = saveFailed,
) {
  if (!error) return null
  if (error.code === "23505") {
    const message = error.message ?? ""
    for (const [name, text] of uniqueMessages) {
      if (message.includes(name)) return text
    }
    if (message.includes("roll_number")) return "That roll number is already in use."
    if (message.includes("employee_code")) return "That employee code is already in use."
    if (message.includes("email")) return "That email is already in use."
    return "That value is already in use."
  }
  if (error.code === "23514") return checkForm
  if (error.code === "23503") return "Choose a record that still exists."
  return fallback
}

export async function adminContext() {
  const profile = await requireRole("admin")
  const supabase = await createClient()
  return { profile, supabase }
}

export async function logActivity(
  supabase: Awaited<ReturnType<typeof createClient>>,
  actorId: string,
  action: string,
  entityType: string,
  entityId: string | null,
  summary: string,
) {
  await supabase.from("activity_logs").insert({
    actor_id: actorId,
    action,
    entity_type: entityType,
    entity_id: entityId,
    summary,
  })
}

export function refreshRecords(paths: string[], tags: string[] = []) {
  for (const tag of tags) updateTag(tag)
  const unique = new Set(["/admin", ...paths])
  for (const path of unique) revalidatePath(path)
}

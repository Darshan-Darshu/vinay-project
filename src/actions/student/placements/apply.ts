"use server"

import { refreshRecords } from "@/actions/admin/records/shared"
import type { FormState } from "@/actions/form-state"
import { requireRole } from "@/lib/auth/session"
import { isRecord } from "@/lib/db/errors"
import { createClient } from "@/lib/supabase/server"

const initialPaths = ["/student/placement", "/admin/placements", "/student", "/admin"]

export async function applyToDrive(_previous: FormState, formData: FormData): Promise<FormState> {
  const driveId = formData.get("driveId")
  if (typeof driveId !== "string" || driveId.length === 0) {
    return { error: "That company could not be found.", success: null }
  }

  const profile = await requireRole("student")
  const supabase = await createClient()
  const student = await supabase
    .from("students")
    .select("id")
    .eq("profile_id", profile.id)
    .is("deleted_at", null)
    .maybeSingle()
  if (student.error || !isRecord(student.data) || typeof student.data.id !== "string") {
    return { error: "Your enrollment is not on file yet.", success: null }
  }

  const inserted = await supabase.from("placement_applications").insert({
    drive_id: driveId,
    student_id: student.data.id,
    status: "applied",
  })
  if (inserted.error) {
    if (inserted.error.code === "23505") {
      return { error: "You have already applied to this company.", success: null }
    }
    return { error: "This company is not open for your course.", success: null }
  }

  refreshRecords(initialPaths)
  return { error: null, success: "Application sent." }
}

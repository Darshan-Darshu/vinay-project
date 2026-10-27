import "server-only"

import { QueryError, isRecord } from "@/lib/db/errors"
import { createAdminClient } from "@/lib/supabase/admin"

export type TeacherAssignment = {
  id: string
  designation: string
  employeeCode: string | null
  subjectIds: Set<string>
}

// The signed-in teacher cannot read public.teachers or public.teacher_subjects
// under the current row policies, so those lists come back empty. This read
// stays limited to the profile already resolved from the session.
export async function readTeacherAssignment(profileId: string): Promise<TeacherAssignment | null> {
  const admin = createAdminClient()
  const teacher = await admin
    .from("teachers")
    .select("id, designation, employee_code")
    .eq("profile_id", profileId)
    .is("deleted_at", null)
    .maybeSingle()
  if (teacher.error) throw new QueryError()
  if (!isTeacherRow(teacher.data)) return null

  const links = await admin.from("teacher_subjects").select("subject_id").eq("teacher_id", teacher.data.id)
  if (links.error || !Array.isArray(links.data)) throw new QueryError()

  return {
    id: teacher.data.id,
    designation: teacher.data.designation,
    employeeCode: teacher.data.employee_code,
    subjectIds: new Set(
      links.data.flatMap((row) => (isRecord(row) && typeof row.subject_id === "string" ? [row.subject_id] : [])),
    ),
  }
}

function isTeacherRow(value: unknown): value is {
  id: string
  designation: string
  employee_code: string | null
} {
  if (!isRecord(value)) return false
  return (
    typeof value.id === "string" &&
    typeof value.designation === "string" &&
    (typeof value.employee_code === "string" || value.employee_code === null)
  )
}

"use server"

import { getCurrentProfile } from "@/lib/auth/session"
import { isRecord } from "@/lib/db/errors"
import { createClient } from "@/lib/supabase/server"

export type AdmissionFormOptions = {
  departments: { id: string; name: string }[]
  courses: { id: string; name: string; departmentId: string }[]
  semesters: { id: string; name: string; courseId: string }[]
}

export async function loadAdmissionFormOptions(): Promise<AdmissionFormOptions | null> {
  const profile = await getCurrentProfile()
  if (!profile?.isActive || profile.role !== "admin") return null
  const supabase = await createClient()
  const [departments, courses, semesters, years] = await Promise.all([
    supabase.from("departments").select("id, name").is("deleted_at", null).eq("is_active", true).order("name"),
    supabase.from("courses").select("id, name, department_id").is("deleted_at", null).eq("is_active", true).order("name"),
    supabase.from("semesters").select("id, course_id, academic_year_id, number").is("deleted_at", null).eq("is_active", true).order("number"),
    supabase.from("academic_years").select("id, name").is("deleted_at", null),
  ])
  if (departments.error || courses.error || semesters.error || years.error) return null
  const yearNames = new Map<string, string>()
  for (const row of years.data ?? []) {
    if (isRecord(row) && typeof row.id === "string" && typeof row.name === "string") yearNames.set(row.id, row.name)
  }
  return {
    departments: (departments.data ?? []).flatMap((row) => {
      if (!isRecord(row) || typeof row.id !== "string" || typeof row.name !== "string") return []
      return [{ id: row.id, name: row.name }]
    }),
    courses: (courses.data ?? []).flatMap((row) => {
      if (!isRecord(row) || typeof row.id !== "string" || typeof row.name !== "string" || typeof row.department_id !== "string") return []
      return [{ id: row.id, name: row.name, departmentId: row.department_id }]
    }),
    semesters: (semesters.data ?? []).flatMap((row) => {
      if (!isRecord(row) || typeof row.id !== "string" || typeof row.course_id !== "string" || typeof row.number !== "number") return []
      const year = typeof row.academic_year_id === "string" ? yearNames.get(row.academic_year_id) : ""
      return [{ id: row.id, name: year ? `Semester ${row.number} · ${year}` : `Semester ${row.number}`, courseId: row.course_id }]
    }),
  }
}

"use server"

import { actionError, fail, field, ok, refreshAcademic, studentContext } from "@/actions/academics/shared"
import type { FormState } from "@/actions/form-state"
import { formatSkills } from "@/lib/academics/skills"
import { isRecord, QueryError } from "@/lib/db/errors"
import { requireUser } from "@/lib/auth/session"
import { createClient } from "@/lib/supabase/server"
import { resumeSchema } from "@/lib/validations/academics"

const pdfLimit = 5 * 1024 * 1024

export type ResumeView = {
  fileName: string
  skills: string
  href: string
}

export type ResumeState =
  | { kind: "hidden" }
  | { kind: "unenrolled" }
  | { kind: "ready"; resume: ResumeView }

export async function loadResume(): Promise<ResumeState> {
  const profile = await requireUser()
  if (profile.role !== "student") return { kind: "hidden" }
  const supabase = await createClient()
  const student = await supabase
    .from("students")
    .select("id")
    .eq("profile_id", profile.id)
    .is("deleted_at", null)
    .maybeSingle()
  if (student.error) throw new QueryError()
  const studentId = isRecord(student.data) && typeof student.data.id === "string" ? student.data.id : null
  if (!studentId) return { kind: "unenrolled" }
  const resume = await supabase
    .from("student_resumes")
    .select("file_name, skills, storage_path")
    .eq("student_id", studentId)
    .maybeSingle()
  if (resume.error) throw new QueryError()
  if (!isRecord(resume.data) || typeof resume.data.file_name !== "string" || typeof resume.data.storage_path !== "string") {
    return { kind: "ready", resume: { fileName: "", skills: "", href: "" } }
  }
  const signed = await supabase.storage.from("resumes").createSignedUrl(resume.data.storage_path, 600)
  const skills = Array.isArray(resume.data.skills)
    ? formatSkills(resume.data.skills.filter((skill): skill is string => typeof skill === "string"))
    : ""
  return {
    kind: "ready",
    resume: {
      fileName: resume.data.file_name,
      skills,
      href: signed.data?.signedUrl ?? "",
    },
  }
}

export async function saveResume(_previous: FormState, formData: FormData): Promise<FormState> {
  const parsed = resumeSchema.safeParse({ skills: field(formData, "skills") })
  if (!parsed.success) return fail("Enter at most 40 skills, each 40 characters or fewer.")
  const { profile, supabase } = await studentContext()
  const student = await supabase
    .from("students")
    .select("id")
    .eq("profile_id", profile.id)
    .is("deleted_at", null)
    .maybeSingle()
  if (student.error || !isRecord(student.data) || typeof student.data.id !== "string") {
    return fail("Your enrollment is not on file yet.")
  }
  const studentId = student.data.id
  const existing = await supabase
    .from("student_resumes")
    .select("id, storage_path, file_name")
    .eq("student_id", studentId)
    .maybeSingle()
  if (existing.error) return fail(actionError(existing.error))

  const file = formData.get("resume")
  const hasFile = file instanceof File && file.size > 0
  if (hasFile && (file.type !== "application/pdf" || file.size > pdfLimit)) {
    return fail("Upload a PDF resume that is 5 MB or smaller.")
  }
  if (!hasFile && !isRecord(existing.data)) return fail("Upload a PDF resume.")

  let storagePath = isRecord(existing.data) && typeof existing.data.storage_path === "string" ? existing.data.storage_path : ""
  let fileName = isRecord(existing.data) && typeof existing.data.file_name === "string" ? existing.data.file_name : ""
  if (hasFile) {
    storagePath = `${studentId}/resume.pdf`
    fileName = file.name
    const uploaded = await supabase.storage.from("resumes").upload(storagePath, file, {
      contentType: "application/pdf",
      upsert: true,
    })
    if (uploaded.error) return fail("We couldn't upload that PDF. Please try again.")
  }

  const row = {
    student_id: studentId,
    storage_path: storagePath,
    file_name: fileName,
    skills: parsed.data.skills,
  }
  const saved = isRecord(existing.data)
    ? await supabase.from("student_resumes").update(row).eq("student_id", studentId)
    : await supabase.from("student_resumes").insert(row)
  if (saved.error) return fail(actionError(saved.error))
  refreshAcademic()
  return ok("Resume saved.")
}

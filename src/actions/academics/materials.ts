"use server"

import { actionError, fail, field, ok, refreshAcademic, relatedName, staffContext, studentContext, subjectChoices } from "@/actions/academics/shared"
import type { FormState } from "@/actions/form-state"
import { isRecord, QueryError } from "@/lib/db/errors"
import { createClient } from "@/lib/supabase/server"
import { materialSchema } from "@/lib/validations/academics"

const pdfLimit = 10 * 1024 * 1024

export type MaterialView = {
  id: string
  title: string
  subjectName: string
  kind: "pdf" | "link"
  href: string
  fileName: string
  approvedForRag: boolean
}

export async function loadStaffMaterials() {
  const { supabase } = await staffContext()
  const [subjects, materials] = await Promise.all([subjectChoices(), readMaterials(supabase)])
  return { subjects, materials }
}

export async function loadStudentMaterials() {
  const { profile, supabase } = await studentContext()
  const student = await supabase
    .from("students")
    .select("course_id")
    .eq("profile_id", profile.id)
    .is("deleted_at", null)
    .maybeSingle()
  if (student.error) throw new QueryError()
  const courseId = isRecord(student.data) && typeof student.data.course_id === "string" ? student.data.course_id : null
  if (!courseId) return { enrolled: false as const, materials: [] as MaterialView[] }
  return { enrolled: true as const, materials: await readMaterials(supabase) }
}

export async function saveMaterial(_previous: FormState, formData: FormData): Promise<FormState> {
  const parsed = materialSchema.safeParse({
    subjectId: field(formData, "subjectId"),
    title: field(formData, "title"),
    kind: field(formData, "kind"),
    externalUrl: field(formData, "externalUrl"),
    approvedForRag: field(formData, "approvedForRag") === "true",
  })
  if (!parsed.success) return fail("Check the material and try again.")
  const { profile, supabase } = await staffContext()

  if (parsed.data.kind === "link") {
    const inserted = await supabase.from("learning_materials").insert({
      subject_id: parsed.data.subjectId,
      title: parsed.data.title,
      kind: "link",
      external_url: parsed.data.externalUrl,
      approved_for_rag: false,
      uploaded_by: profile.id,
    })
    if (inserted.error) return fail(actionError(inserted.error))
    refreshAcademic()
    return ok("Material saved.")
  }

  const file = formData.get("file")
  if (!(file instanceof File) || file.size === 0) return fail("Choose a PDF to upload.")
  if (file.type !== "application/pdf" || file.size > pdfLimit) {
    return fail("Upload a PDF that is 10 MB or smaller.")
  }
  const path = `${parsed.data.subjectId}/${crypto.randomUUID()}.pdf`
  const uploaded = await supabase.storage.from("materials").upload(path, file, {
    contentType: "application/pdf",
    upsert: false,
  })
  if (uploaded.error) return fail("We couldn't upload that PDF. Please try again.")
  const inserted = await supabase.from("learning_materials").insert({
    subject_id: parsed.data.subjectId,
    title: parsed.data.title,
    kind: "pdf",
    storage_path: path,
    file_name: file.name,
    approved_for_rag: false,
    uploaded_by: profile.id,
  }).select("id").maybeSingle()
  if (inserted.error || !isRecord(inserted.data) || typeof inserted.data.id !== "string") {
    await supabase.storage.from("materials").remove([path])
    return fail(actionError(inserted.error))
  }
  if (parsed.data.approvedForRag) {
    const { prepareStoredPdf } = await import("@/actions/ai/passages")
    const prepared = await prepareStoredPdf(inserted.data.id)
    if (!prepared) return fail("We couldn't generate a response right now. Please try again.")
  }
  refreshAcademic()
  return ok("Material saved.")
}

export async function deleteMaterial(_previous: FormState, formData: FormData): Promise<FormState> {
  const id = field(formData, "id")
  if (!id) return fail("That material could not be found.")
  const { supabase } = await staffContext()
  const existing = await supabase.from("learning_materials").select("storage_path").eq("id", id).maybeSingle()
  if (existing.error || !isRecord(existing.data)) return fail("That material could not be found.")
  const removed = await supabase.from("learning_materials").update({ deleted_at: new Date().toISOString() }).eq("id", id)
  if (removed.error) return fail(actionError(removed.error))
  if (typeof existing.data.storage_path === "string") {
    await supabase.storage.from("materials").remove([existing.data.storage_path])
  }
  refreshAcademic()
  return ok("Material removed.")
}

async function readMaterials(supabase: Awaited<ReturnType<typeof createClient>>) {
  const result = await supabase
    .from("learning_materials")
    .select("id, title, kind, storage_path, external_url, file_name, approved_for_rag, subjects(name)")
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
  if (result.error) throw new QueryError()
  const materials = await Promise.all((result.data ?? []).map((row) => toMaterial(supabase, row)))
  return materials.flat()
}

async function toMaterial(
  supabase: Awaited<ReturnType<typeof createClient>>,
  value: unknown,
): Promise<MaterialView[]> {
  if (
    !isRecord(value) ||
    typeof value.id !== "string" ||
    typeof value.title !== "string" ||
    (value.kind !== "pdf" && value.kind !== "link")
  ) {
    return []
  }
  let href = ""
  if (value.kind === "link" && typeof value.external_url === "string") href = value.external_url
  if (value.kind === "pdf" && typeof value.storage_path === "string") {
    const signed = await supabase.storage.from("materials").createSignedUrl(value.storage_path, 600)
    href = signed.data?.signedUrl ?? ""
  }
  return [
    {
      id: value.id,
      title: value.title,
      subjectName: relatedName(value.subjects, "name") || "Subject",
      kind: value.kind,
      href,
      fileName: typeof value.file_name === "string" ? value.file_name : "",
      approvedForRag: value.approved_for_rag === true,
    },
  ]
}

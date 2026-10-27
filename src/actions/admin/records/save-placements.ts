"use server"

import type { FormState } from "@/actions/form-state"
import {
  adminContext,
  checkForm,
  fail,
  field,
  logActivity,
  ok,
  refreshRecords,
  saveFailed,
  writeError,
} from "@/actions/admin/records/shared"
import { placementApplicationStatusSchema, placementDriveSchema } from "@/lib/validations/records"

const placementPaths = ["/admin/placements", "/student/placement", "/student"]

export async function savePlacementDrive(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = placementDriveSchema.safeParse({
    id: field(formData, "id"),
    companyName: field(formData, "companyName"),
    roleTitle: field(formData, "roleTitle"),
    description: field(formData, "description"),
    packageText: field(formData, "packageText"),
    location: field(formData, "location"),
    jobType: field(formData, "jobType"),
    eligibility: field(formData, "eligibility"),
    requiredSkills: field(formData, "requiredSkills"),
    departmentId: field(formData, "departmentId"),
    courseId: field(formData, "courseId"),
    applyBy: field(formData, "applyBy"),
    visitAt: field(formData, "visitAt"),
    venue: field(formData, "venue"),
    status: field(formData, "status"),
  })
  if (!parsed.success) return fail(checkForm)

  const { profile, supabase } = await adminContext()
  const placed = await courseMatchesDepartment(supabase, parsed.data.departmentId, parsed.data.courseId)
  if (placed) return fail(placed)

  const row = {
    company_name: parsed.data.companyName,
    role_title: parsed.data.roleTitle,
    description: parsed.data.description,
    package_text: parsed.data.packageText,
    location: parsed.data.location,
    job_type: parsed.data.jobType,
    eligibility: parsed.data.eligibility,
    required_skills: parsed.data.requiredSkills,
    department_id: parsed.data.departmentId,
    course_id: parsed.data.courseId,
    apply_by: parsed.data.applyBy,
    visit_at: parsed.data.visitAt,
    venue: parsed.data.venue,
    status: parsed.data.status,
  }
  const id = parsed.data.id
  const result = id
    ? await supabase.from("placement_drives").update(row).eq("id", id).is("deleted_at", null).select("id").maybeSingle()
    : await supabase.from("placement_drives").insert(row).select("id").maybeSingle()

  if (result.error || !result.data) return fail(writeError(result.error) ?? saveFailed)
  await logActivity(
    supabase,
    profile.id,
    id ? "placement.update" : "placement.create",
    "placement_drive",
    result.data.id,
    id
      ? `Updated ${row.company_name} placement`
      : `Posted ${row.company_name} for ${row.role_title}`,
  )
  refreshRecords(["/admin", ...placementPaths])
  return ok("Company saved.")
}

export async function setPlacementApplicationStatus(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = placementApplicationStatusSchema.safeParse({
    id: field(formData, "id"),
    status: field(formData, "status"),
  })
  if (!parsed.success) return fail(checkForm)

  const { profile, supabase } = await adminContext()
  const existing = await supabase
    .from("placement_applications")
    .select("id, placement_drives(company_name), students(roll_number)")
    .eq("id", parsed.data.id)
    .maybeSingle()
  if (existing.error || !existing.data) return fail("That application could not be found.")

  const updated = await supabase
    .from("placement_applications")
    .update({ status: parsed.data.status })
    .eq("id", parsed.data.id)
    .select("id")
    .maybeSingle()
  if (updated.error || !updated.data) return fail(writeError(updated.error) ?? saveFailed)

  const company = relatedName(existing.data.placement_drives, "company_name") || "the company"
  const roll = relatedName(existing.data.students, "roll_number")
  await logActivity(
    supabase,
    profile.id,
    "placement.application",
    "placement_application",
    parsed.data.id,
    `Updated ${roll || "a student"} for ${company}`,
  )
  refreshRecords(placementPaths)
  return ok("Application updated.")
}

async function courseMatchesDepartment(
  supabase: Awaited<ReturnType<typeof adminContext>>["supabase"],
  departmentId: string | null,
  courseId: string | null,
) {
  if (!courseId) return null
  const course = await supabase
    .from("courses")
    .select("id, department_id")
    .eq("id", courseId)
    .is("deleted_at", null)
    .maybeSingle()
  if (course.error || !course.data) return "Choose a course that still exists."
  if (departmentId && course.data.department_id !== departmentId) {
    return "That course is not in the selected department."
  }
  if (departmentId) {
    const department = await supabase
      .from("departments")
      .select("id")
      .eq("id", departmentId)
      .is("deleted_at", null)
      .maybeSingle()
    if (department.error || !department.data) return "Choose a department that still exists."
  }
  return null
}

function relatedName(value: unknown, key: string) {
  const row = Array.isArray(value) ? value[0] : value
  if (!row || typeof row !== "object") return ""
  const fieldValue = (row as Record<string, unknown>)[key]
  return typeof fieldValue === "string" ? fieldValue : ""
}

"use server"

import { cacheTags } from "@/actions/cache-tags"
import type { FormState } from "@/actions/form-state"
import {
  adminContext,
  checkForm,
  fail,
  field,
  flagged,
  logActivity,
  ok,
  refreshRecords,
  saveFailed,
  writeError,
} from "@/actions/admin/records/shared"
import {
  academicYearSchema,
  courseSchema,
  departmentSchema,
  semesterSchema,
  subjectSchema,
} from "@/lib/validations/records"
import { indexCollegeRecord } from "@/lib/ai/pinecone-college"

const catalogPaths = ["/", "/guest", "/guest/departments", "/guest/courses"]

export async function saveDepartment(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = departmentSchema.safeParse({
    id: field(formData, "id"),
    name: field(formData, "name"),
    code: field(formData, "code"),
    description: field(formData, "description"),
    isActive: flagged(formData, "isActive"),
  })
  if (!parsed.success) return fail(checkForm)

  const { profile, supabase } = await adminContext()
  const row = {
    name: parsed.data.name,
    code: parsed.data.code,
    description: parsed.data.description,
    is_active: parsed.data.isActive,
  }
  const id = parsed.data.id
  const result = id
    ? await supabase.from("departments").update(row).eq("id", id).is("deleted_at", null).select("id").maybeSingle()
    : await supabase.from("departments").insert(row).select("id").maybeSingle()

  if (result.error || !result.data) return fail(writeError(result.error) ?? saveFailed)
  await logActivity(
    supabase,
    profile.id,
    id ? "department.update" : "department.create",
    "department",
    result.data.id,
    id ? `Updated department ${row.name}` : `Created department ${row.name}`,
  )
  refreshRecords(["/admin/departments", ...catalogPaths], [cacheTags.departments])
  await indexCollegeRecord({
    source: "department",
    recordId: result.data.id,
    title: row.name,
    text: row.description,
    published: row.is_active,
  })
  return ok("Department saved.")
}

export async function saveCourse(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = courseSchema.safeParse({
    id: field(formData, "id"),
    departmentId: field(formData, "departmentId"),
    name: field(formData, "name"),
    code: field(formData, "code"),
    durationSemesters: field(formData, "durationSemesters"),
    description: field(formData, "description"),
    isActive: flagged(formData, "isActive"),
  })
  if (!parsed.success) return fail(checkForm)

  const { profile, supabase } = await adminContext()
  const department = await supabase
    .from("departments")
    .select("id")
    .eq("id", parsed.data.departmentId)
    .is("deleted_at", null)
    .maybeSingle()
  if (department.error || !department.data) return fail("Choose a department that still exists.")

  const row = {
    department_id: parsed.data.departmentId,
    name: parsed.data.name,
    code: parsed.data.code,
    duration_semesters: parsed.data.durationSemesters,
    description: parsed.data.description,
    is_active: parsed.data.isActive,
  }
  const id = parsed.data.id
  const result = id
    ? await supabase.from("courses").update(row).eq("id", id).is("deleted_at", null).select("id").maybeSingle()
    : await supabase.from("courses").insert(row).select("id").maybeSingle()

  if (result.error || !result.data) return fail(writeError(result.error) ?? saveFailed)
  await logActivity(
    supabase,
    profile.id,
    id ? "course.update" : "course.create",
    "course",
    result.data.id,
    id ? `Updated course ${row.name}` : `Created course ${row.name}`,
  )
  refreshRecords(["/admin/courses", ...catalogPaths], [cacheTags.courses, cacheTags.departments])
  await indexCollegeRecord({
    source: "course",
    recordId: result.data.id,
    title: row.name,
    text: row.description,
    published: row.is_active,
  })
  return ok("Course saved.")
}

export async function saveSubject(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = subjectSchema.safeParse({
    id: field(formData, "id"),
    departmentId: field(formData, "departmentId"),
    courseId: field(formData, "courseId"),
    semesterNumber: field(formData, "semesterNumber"),
    name: field(formData, "name"),
    code: field(formData, "code"),
    credits: field(formData, "credits"),
    isActive: flagged(formData, "isActive"),
  })
  if (!parsed.success) return fail(checkForm)

  const { profile, supabase } = await adminContext()
  const course = await supabase
    .from("courses")
    .select("id, department_id, duration_semesters")
    .eq("id", parsed.data.courseId)
    .is("deleted_at", null)
    .maybeSingle()
  if (course.error || !course.data) return fail("Choose a course that still exists.")
  if (course.data.department_id !== parsed.data.departmentId) {
    return fail("Choose a course from that department.")
  }
  if (parsed.data.semesterNumber > course.data.duration_semesters) {
    return fail("That semester is outside this course.")
  }

  const row = {
    department_id: parsed.data.departmentId,
    course_id: parsed.data.courseId,
    semester_number: parsed.data.semesterNumber,
    name: parsed.data.name,
    code: parsed.data.code,
    credits: parsed.data.credits,
    is_active: parsed.data.isActive,
  }
  const id = parsed.data.id
  const result = id
    ? await supabase.from("subjects").update(row).eq("id", id).is("deleted_at", null).select("id").maybeSingle()
    : await supabase.from("subjects").insert(row).select("id").maybeSingle()

  if (result.error || !result.data) return fail(writeError(result.error) ?? saveFailed)
  await logActivity(
    supabase,
    profile.id,
    id ? "subject.update" : "subject.create",
    "subject",
    result.data.id,
    id ? `Updated subject ${row.name}` : `Created subject ${row.name}`,
  )
  refreshRecords(["/admin/subjects", "/teacher/subjects", "/student/subjects"], [cacheTags.subjects])
  return ok("Subject saved.")
}

export async function saveAcademicYear(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = academicYearSchema.safeParse({
    id: field(formData, "id"),
    name: field(formData, "name"),
    startsOn: field(formData, "startsOn"),
    endsOn: field(formData, "endsOn"),
    isCurrent: flagged(formData, "isCurrent"),
  })
  if (!parsed.success) return fail(checkForm)

  const { profile, supabase } = await adminContext()
  if (parsed.data.isCurrent) {
    const clear = supabase.from("academic_years").update({ is_current: false }).eq("is_current", true)
    const cleared = parsed.data.id ? await clear.neq("id", parsed.data.id) : await clear
    if (cleared.error) return fail(writeError(cleared.error) ?? saveFailed)
  }

  const row = {
    name: parsed.data.name,
    starts_on: parsed.data.startsOn,
    ends_on: parsed.data.endsOn,
    is_current: parsed.data.isCurrent,
  }
  const id = parsed.data.id
  const result = id
    ? await supabase.from("academic_years").update(row).eq("id", id).is("deleted_at", null).select("id").maybeSingle()
    : await supabase.from("academic_years").insert(row).select("id").maybeSingle()

  if (result.error || !result.data) return fail(writeError(result.error) ?? saveFailed)
  await logActivity(
    supabase,
    profile.id,
    id ? "academic_year.update" : "academic_year.create",
    "academic_year",
    result.data.id,
    id ? `Updated academic year ${row.name}` : `Created academic year ${row.name}`,
  )
  refreshRecords(["/admin/academic-years"], [cacheTags.academicYears])
  return ok("Academic year saved.")
}

export async function saveSemester(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = semesterSchema.safeParse({
    id: field(formData, "id"),
    courseId: field(formData, "courseId"),
    academicYearId: field(formData, "academicYearId"),
    number: field(formData, "number"),
    isActive: flagged(formData, "isActive"),
  })
  if (!parsed.success) return fail(checkForm)

  const { profile, supabase } = await adminContext()
  const course = await supabase
    .from("courses")
    .select("id, duration_semesters")
    .eq("id", parsed.data.courseId)
    .is("deleted_at", null)
    .maybeSingle()
  if (course.error || !course.data) return fail("Choose a course that still exists.")
  if (parsed.data.number > course.data.duration_semesters) {
    return fail("That semester is outside this course.")
  }
  const year = await supabase
    .from("academic_years")
    .select("id")
    .eq("id", parsed.data.academicYearId)
    .is("deleted_at", null)
    .maybeSingle()
  if (year.error || !year.data) return fail("Choose an academic year that still exists.")

  const row = {
    course_id: parsed.data.courseId,
    academic_year_id: parsed.data.academicYearId,
    number: parsed.data.number,
    is_active: parsed.data.isActive,
  }
  const id = parsed.data.id
  const result = id
    ? await supabase.from("semesters").update(row).eq("id", id).is("deleted_at", null).select("id").maybeSingle()
    : await supabase.from("semesters").insert(row).select("id").maybeSingle()

  if (result.error || !result.data) return fail(writeError(result.error) ?? saveFailed)
  await logActivity(
    supabase,
    profile.id,
    id ? "semester.update" : "semester.create",
    "semester",
    result.data.id,
    id ? `Updated semester ${row.number}` : `Created semester ${row.number}`,
  )
  refreshRecords(["/admin/semesters", "/admin/admissions"])
  return ok("Semester saved.")
}

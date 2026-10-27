"use server"

import type { FormState } from "@/actions/form-state"
import {
  adminContext,
  checkForm,
  fail,
  field,
  fieldList,
  flagged,
  logActivity,
  loginFailed,
  ok,
  refreshRecords,
  saveFailed,
  writeError,
} from "@/actions/admin/records/shared"
import { createAdminClient } from "@/lib/supabase/admin"
import {
  admissionNotesSchema,
  admissionSchema,
  admissionStatusSchema,
  enrollSchema,
  studentUpdateSchema,
  teacherCreateSchema,
  teacherUpdateSchema,
} from "@/lib/validations/records"

const admissionMoves: Record<string, string[]> = {
  applied: ["under_review"],
  under_review: ["approved", "rejected"],
  approved: ["rejected"],
  rejected: ["under_review"],
  completed: [],
}

export async function saveTeacher(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const id = field(formData, "id")
  if (id) return updateTeacher(formData)
  return createTeacher(formData)
}

async function createTeacher(formData: FormData): Promise<FormState> {
  const parsed = teacherCreateSchema.safeParse({
    fullName: field(formData, "fullName"),
    email: field(formData, "email"),
    phone: field(formData, "phone"),
    password: field(formData, "password"),
    departmentId: field(formData, "departmentId"),
    employeeCode: field(formData, "employeeCode"),
    designation: field(formData, "designation"),
    isActive: flagged(formData, "isActive"),
    subjectIds: fieldList(formData, "subjectIds"),
  })
  if (!parsed.success) return fail(checkForm)

  const { profile, supabase } = await adminContext()
  if (parsed.data.departmentId) {
    const department = await departmentExists(supabase, parsed.data.departmentId)
    if (!department) return fail("Choose a department that still exists.")
  }

  const created = await createLogin({
    email: parsed.data.email,
    password: parsed.data.password,
    fullName: parsed.data.fullName,
    role: "teacher",
  })
  if ("error" in created) return fail(created.error ?? loginFailed)
  const userId = created.userId
  if (!userId) return fail(loginFailed)

  const phone = parsed.data.phone || null
  await supabase.from("profiles").update({ phone, is_active: parsed.data.isActive }).eq("id", userId)

  const teacher = await supabase
    .from("teachers")
    .insert({
      profile_id: userId,
      department_id: parsed.data.departmentId,
      employee_code: parsed.data.employeeCode,
      designation: parsed.data.designation,
      is_active: parsed.data.isActive,
    })
    .select("id")
    .maybeSingle()

  if (teacher.error || !teacher.data) {
    await created.admin.auth.admin.deleteUser(userId)
    return fail(writeError(teacher.error) ?? loginFailed)
  }

  const assigned = await assignSubjects(supabase, teacher.data.id, parsed.data.subjectIds)
  if (assigned) return fail(assigned)

  await logActivity(
    supabase,
    profile.id,
    "teacher.create",
    "teacher",
    teacher.data.id,
    `Created teacher ${parsed.data.fullName}`,
  )
  refreshRecords(["/admin/teachers", "/teacher", "/teacher/subjects", "/teacher/students"])
  return ok("Teacher saved.")
}

async function updateTeacher(formData: FormData): Promise<FormState> {
  const parsed = teacherUpdateSchema.safeParse({
    id: field(formData, "id"),
    fullName: field(formData, "fullName"),
    phone: field(formData, "phone"),
    departmentId: field(formData, "departmentId"),
    employeeCode: field(formData, "employeeCode"),
    designation: field(formData, "designation"),
    isActive: flagged(formData, "isActive"),
    subjectIds: fieldList(formData, "subjectIds"),
  })
  if (!parsed.success) return fail(checkForm)

  const { profile, supabase } = await adminContext()
  const existing = await supabase
    .from("teachers")
    .select("id, profile_id")
    .eq("id", parsed.data.id)
    .is("deleted_at", null)
    .maybeSingle()
  if (existing.error || !existing.data) return fail("That teacher could not be found.")
  if (parsed.data.departmentId) {
    const department = await departmentExists(supabase, parsed.data.departmentId)
    if (!department) return fail("Choose a department that still exists.")
  }

  const teacher = await supabase
    .from("teachers")
    .update({
      department_id: parsed.data.departmentId,
      employee_code: parsed.data.employeeCode,
      designation: parsed.data.designation,
      is_active: parsed.data.isActive,
    })
    .eq("id", parsed.data.id)
    .select("id")
    .maybeSingle()
  if (teacher.error || !teacher.data) return fail(writeError(teacher.error) ?? saveFailed)

  const person = await supabase
    .from("profiles")
    .update({
      full_name: parsed.data.fullName,
      phone: parsed.data.phone || null,
      is_active: parsed.data.isActive,
    })
    .eq("id", existing.data.profile_id)
  if (person.error) return fail(saveFailed)

  const assigned = await assignSubjects(supabase, parsed.data.id, parsed.data.subjectIds)
  if (assigned) return fail(assigned)

  await logActivity(
    supabase,
    profile.id,
    "teacher.update",
    "teacher",
    parsed.data.id,
    `Updated teacher ${parsed.data.fullName}`,
  )
  refreshRecords(["/admin/teachers", "/teacher", "/teacher/subjects", "/teacher/students"])
  return ok("Teacher saved.")
}

async function assignSubjects(
  supabase: Awaited<ReturnType<typeof adminContext>>["supabase"],
  teacherId: string,
  subjectIds: string[],
) {
  const unique = [...new Set(subjectIds)]
  if (unique.length > 0) {
    const found = await supabase.from("subjects").select("id").in("id", unique).is("deleted_at", null)
    if (found.error || !Array.isArray(found.data) || found.data.length !== unique.length) {
      return "Choose subjects that still exist."
    }
  }
  const removed = await supabase.from("teacher_subjects").delete().eq("teacher_id", teacherId)
  if (removed.error) return saveFailed
  if (unique.length === 0) return null
  const inserted = await supabase
    .from("teacher_subjects")
    .insert(unique.map((subjectId) => ({ teacher_id: teacherId, subject_id: subjectId })))
  if (inserted.error) return writeError(inserted.error) ?? saveFailed
  return null
}

export async function saveStudent(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = studentUpdateSchema.safeParse({
    id: field(formData, "id"),
    rollNumber: field(formData, "rollNumber"),
    departmentId: field(formData, "departmentId"),
    courseId: field(formData, "courseId"),
    semesterId: field(formData, "semesterId"),
    isActive: flagged(formData, "isActive"),
  })
  if (!parsed.success) return fail(checkForm)

  const { profile, supabase } = await adminContext()
  const existing = await supabase
    .from("students")
    .select("id, profile_id")
    .eq("id", parsed.data.id)
    .is("deleted_at", null)
    .maybeSingle()
  if (existing.error || !existing.data) return fail("That student could not be found.")

  const placed = await placementMatches(supabase, parsed.data.departmentId, parsed.data.courseId, parsed.data.semesterId)
  if (placed) return fail(placed)

  const student = await supabase
    .from("students")
    .update({
      roll_number: parsed.data.rollNumber,
      department_id: parsed.data.departmentId,
      course_id: parsed.data.courseId,
      semester_id: parsed.data.semesterId,
      is_active: parsed.data.isActive,
    })
    .eq("id", parsed.data.id)
    .select("id")
    .maybeSingle()
  if (student.error || !student.data) return fail(writeError(student.error) ?? saveFailed)

  const person = await supabase
    .from("profiles")
    .update({ is_active: parsed.data.isActive })
    .eq("id", existing.data.profile_id)
  if (person.error) return fail(saveFailed)

  await logActivity(
    supabase,
    profile.id,
    "student.update",
    "student",
    parsed.data.id,
    `Updated student ${parsed.data.rollNumber}`,
  )
  refreshRecords(["/admin/students"])
  return ok("Student saved.")
}

export async function saveAdmission(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const id = field(formData, "id")
  const { profile, supabase } = await adminContext()

  if (id) {
    const existing = await supabase
      .from("admissions")
      .select("id, status, full_name")
      .eq("id", id)
      .is("deleted_at", null)
      .maybeSingle()
    if (existing.error || !existing.data) return fail("That application could not be found.")
    if (existing.data.status === "completed") {
      const notes = admissionNotesSchema.safeParse({ id, notes: field(formData, "notes") })
      if (!notes.success) return fail(checkForm)
      const updated = await supabase
        .from("admissions")
        .update({ notes: notes.data.notes })
        .eq("id", id)
        .select("id")
        .maybeSingle()
      if (updated.error || !updated.data) return fail(saveFailed)
      await logActivity(supabase, profile.id, "admission.update", "admission", id, `Updated notes for ${existing.data.full_name}`)
      refreshRecords(["/admin/admissions"])
      return ok("Application saved.")
    }
  }

  const parsed = admissionSchema.safeParse({
    id,
    fullName: field(formData, "fullName"),
    email: field(formData, "email"),
    phone: field(formData, "phone"),
    departmentId: field(formData, "departmentId"),
    courseId: field(formData, "courseId"),
    semesterId: field(formData, "semesterId"),
    notes: field(formData, "notes"),
  })
  if (!parsed.success) return fail(checkForm)

  const placed = await placementMatches(
    supabase,
    parsed.data.departmentId,
    parsed.data.courseId,
    parsed.data.semesterId,
  )
  if (placed) return fail(placed)

  const row = {
    full_name: parsed.data.fullName,
    email: parsed.data.email,
    phone: parsed.data.phone || null,
    department_id: parsed.data.departmentId,
    course_id: parsed.data.courseId,
    semester_id: parsed.data.semesterId,
    notes: parsed.data.notes,
  }
  const result = parsed.data.id
    ? await supabase.from("admissions").update(row).eq("id", parsed.data.id).is("deleted_at", null).select("id").maybeSingle()
    : await supabase.from("admissions").insert({ ...row, status: "applied" }).select("id").maybeSingle()

  if (result.error || !result.data) return fail(writeError(result.error) ?? saveFailed)
  await logActivity(
    supabase,
    profile.id,
    parsed.data.id ? "admission.update" : "admission.create",
    "admission",
    result.data.id,
    parsed.data.id ? `Updated application for ${row.full_name}` : `Created application for ${row.full_name}`,
  )
  refreshRecords(["/admin/admissions"])
  return ok("Application saved.")
}

export async function setAdmissionStatus(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = admissionStatusSchema.safeParse({
    id: field(formData, "id"),
    status: field(formData, "status"),
  })
  if (!parsed.success) return fail(checkForm)

  const { profile, supabase } = await adminContext()
  const existing = await supabase
    .from("admissions")
    .select("id, status, full_name")
    .eq("id", parsed.data.id)
    .is("deleted_at", null)
    .maybeSingle()
  if (existing.error || !existing.data) return fail("That application could not be found.")
  const allowed = admissionMoves[existing.data.status] ?? []
  if (!allowed.includes(parsed.data.status)) {
    return fail("That status change is not available.")
  }

  const updated = await supabase
    .from("admissions")
    .update({ status: parsed.data.status })
    .eq("id", parsed.data.id)
    .eq("status", existing.data.status)
    .select("id")
    .maybeSingle()
  if (updated.error || !updated.data) return fail(saveFailed)

  await logActivity(
    supabase,
    profile.id,
    "admission.status",
    "admission",
    parsed.data.id,
    `Set ${existing.data.full_name} to ${parsed.data.status.replaceAll("_", " ")}`,
  )
  refreshRecords(["/admin/admissions"])
  return ok("Status updated.")
}

export async function enrollAdmission(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = enrollSchema.safeParse({
    id: field(formData, "id"),
    rollNumber: field(formData, "rollNumber"),
    password: field(formData, "password"),
  })
  if (!parsed.success) return fail(checkForm)

  const { profile, supabase } = await adminContext()
  const existing = await supabase
    .from("admissions")
    .select("id, status, full_name, email, phone, department_id, course_id, semester_id")
    .eq("id", parsed.data.id)
    .is("deleted_at", null)
    .maybeSingle()
  if (existing.error || !existing.data) return fail("That application could not be found.")
  if (existing.data.status !== "approved") {
    return fail("Approve the application before enrolling the student.")
  }
  if (!existing.data.department_id || !existing.data.course_id) {
    return fail("Add a department and course before enrolling.")
  }

  const created = await createLogin({
    email: existing.data.email,
    password: parsed.data.password,
    fullName: existing.data.full_name,
    role: "student",
  })
  if ("error" in created) return fail(created.error ?? loginFailed)
  const userId = created.userId
  if (!userId) return fail(loginFailed)

  if (existing.data.phone) {
    await supabase.from("profiles").update({ phone: existing.data.phone }).eq("id", userId)
  }

  const student = await supabase
    .from("students")
    .insert({
      profile_id: userId,
      department_id: existing.data.department_id,
      course_id: existing.data.course_id,
      semester_id: existing.data.semester_id,
      admission_id: existing.data.id,
      roll_number: parsed.data.rollNumber,
      is_active: true,
    })
    .select("id")
    .maybeSingle()

  if (student.error || !student.data) {
    await created.admin.auth.admin.deleteUser(userId)
    return fail(writeError(student.error) ?? loginFailed)
  }

  const admission = await supabase
    .from("admissions")
    .update({ status: "completed", student_id: student.data.id })
    .eq("id", existing.data.id)
    .eq("status", "approved")
    .select("id")
    .maybeSingle()

  if (admission.error || !admission.data) {
    await supabase.from("students").delete().eq("id", student.data.id)
    await created.admin.auth.admin.deleteUser(userId)
    return fail("The office login could not be created. The application was not changed.")
  }

  await logActivity(
    supabase,
    profile.id,
    "admission.enroll",
    "admission",
    existing.data.id,
    `Enrolled ${existing.data.full_name} as ${parsed.data.rollNumber}`,
  )
  refreshRecords(["/admin/admissions", "/admin/students"])
  return ok("Student enrolled.")
}

async function createLogin(input: {
  email: string
  password: string
  fullName: string
  role: "teacher" | "student"
}) {
  let admin: ReturnType<typeof createAdminClient>
  try {
    admin = createAdminClient()
  } catch {
    return { error: loginFailed }
  }

  const { data, error } = await admin.auth.admin.createUser({
    email: input.email,
    password: input.password,
    email_confirm: true,
    app_metadata: { role: input.role },
    user_metadata: { full_name: input.fullName },
  })
  const userId = data.user?.id
  if (error || !userId) {
    const message = (error?.message ?? "").toLowerCase()
    const taken = error?.code === "email_exists" || message.includes("already")
    return { error: taken ? "That email is already in use." : loginFailed }
  }
  return { userId, admin }
}

type Db = Awaited<ReturnType<typeof adminContext>>["supabase"]

async function departmentExists(supabase: Db, id: string) {
  const { data, error } = await supabase
    .from("departments")
    .select("id")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle()
  return !error && Boolean(data)
}

async function placementMatches(
  supabase: Db,
  departmentId: string | null,
  courseId: string | null,
  semesterId: string | null,
) {
  if (!departmentId || !courseId) return "Choose a department and a course."
  const course = await supabase
    .from("courses")
    .select("id, department_id")
    .eq("id", courseId)
    .is("deleted_at", null)
    .maybeSingle()
  if (course.error || !course.data || course.data.department_id !== departmentId) {
    return "Choose a course from that department."
  }
  if (!semesterId) return null
  const semester = await supabase
    .from("semesters")
    .select("id, course_id")
    .eq("id", semesterId)
    .is("deleted_at", null)
    .maybeSingle()
  if (semester.error || !semester.data || semester.data.course_id !== courseId) {
    return "Choose a semester for that course."
  }
  return null
}

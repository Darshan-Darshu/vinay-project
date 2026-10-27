"use server"

import { unstable_rethrow } from "next/navigation"
import { z } from "zod"

import { adminContext } from "@/actions/admin/records/shared"
import { toDateInput, toDateTimeLocal } from "@/lib/format"
import type {
  EditorLoad,
  EditorOptions,
  EditorRecord,
  NamedOption,
} from "@/actions/admin/records/types"
import { isEditorKind, type EditorKind } from "@/actions/records/types"
import { isRecord } from "@/lib/db/errors"

export async function loadEditor(kind: string, id: string | null): Promise<EditorLoad> {
  try {
    if (!isEditorKind(kind)) {
      return { error: "That record could not be opened.", record: null, options: null }
    }
    const { supabase } = await adminContext()
    const options = await loadOptions(supabase)
    if (!options) {
      return { error: "That record could not be opened.", record: null, options: null }
    }
    if (!id) {
      if (kind === "student") {
        return {
          error: "Students are added by enrolling an application.",
          record: null,
          options: null,
        }
      }
      return { error: null, record: null, options }
    }
    if (!z.uuid().safeParse(id).success) {
      return { error: "That record could not be found.", record: null, options: null }
    }
    const record = await loadRecord(supabase, kind, id)
    if (!record) {
      return { error: "That record could not be found.", record: null, options: null }
    }
    return { error: null, record, options }
  } catch (error) {
    unstable_rethrow(error)
    return { error: "That record could not be opened.", record: null, options: null }
  }
}

type Db = Awaited<ReturnType<typeof adminContext>>["supabase"]

async function loadOptions(supabase: Db): Promise<EditorOptions | null> {
  const [departments, courses, years, semesters, subjects] = await Promise.all([
    supabase
      .from("departments")
      .select("id, name, is_active")
      .is("deleted_at", null)
      .order("name"),
    supabase
      .from("courses")
      .select("id, name, department_id, duration_semesters, is_active")
      .is("deleted_at", null)
      .order("name"),
    supabase
      .from("academic_years")
      .select("id, name, is_current")
      .is("deleted_at", null)
      .order("starts_on", { ascending: false }),
    supabase
      .from("semesters")
      .select("id, course_id, academic_year_id, number, is_active, academic_years(name)")
      .is("deleted_at", null)
      .order("number"),
    supabase
      .from("subjects")
      .select("id, name, code, is_active, courses(name)")
      .is("deleted_at", null)
      .order("name"),
  ])

  if (
    departments.error ||
    courses.error ||
    years.error ||
    semesters.error ||
    subjects.error ||
    !Array.isArray(departments.data) ||
    !Array.isArray(courses.data) ||
    !Array.isArray(years.data) ||
    !Array.isArray(semesters.data) ||
    !Array.isArray(subjects.data)
  ) {
    return null
  }

  const departmentOptions: NamedOption[] = []
  for (const row of departments.data) {
    if (!isRecord(row) || typeof row.id !== "string" || typeof row.name !== "string") continue
    departmentOptions.push({
      id: row.id,
      name: row.name,
      inactive: row.is_active === false,
    })
  }

  const courseOptions: EditorOptions["courses"] = []
  for (const row of courses.data) {
    if (
      !isRecord(row) ||
      typeof row.id !== "string" ||
      typeof row.name !== "string" ||
      typeof row.department_id !== "string" ||
      typeof row.duration_semesters !== "number"
    ) {
      continue
    }
    courseOptions.push({
      id: row.id,
      name: row.name,
      departmentId: row.department_id,
      durationSemesters: row.duration_semesters,
      inactive: row.is_active === false,
    })
  }

  const yearOptions: NamedOption[] = []
  for (const row of years.data) {
    if (!isRecord(row) || typeof row.id !== "string" || typeof row.name !== "string") continue
    yearOptions.push({ id: row.id, name: row.name })
  }

  const yearNames = new Map(yearOptions.map((year) => [year.id, year.name]))
  const semesterOptions: EditorOptions["semesters"] = []
  for (const row of semesters.data) {
    if (
      !isRecord(row) ||
      typeof row.id !== "string" ||
      typeof row.course_id !== "string" ||
      typeof row.academic_year_id !== "string" ||
      typeof row.number !== "number"
    ) {
      continue
    }
    const yearName = yearNames.get(row.academic_year_id) ?? "Year"
    semesterOptions.push({
      id: row.id,
      courseId: row.course_id,
      academicYearId: row.academic_year_id,
      number: row.number,
      label: `Semester ${row.number} · ${yearName}`,
      inactive: row.is_active === false,
    })
  }

  const subjectOptions: EditorOptions["subjects"] = []
  for (const row of subjects.data) {
    if (!isRecord(row) || typeof row.id !== "string" || typeof row.name !== "string") continue
    const code = typeof row.code === "string" ? row.code : ""
    subjectOptions.push({
      id: row.id,
      name: code ? `${row.name} (${code})` : row.name,
      courseName: relatedName(row.courses),
      inactive: row.is_active === false,
    })
  }

  return {
    departments: departmentOptions,
    courses: courseOptions,
    years: yearOptions,
    semesters: semesterOptions,
    subjects: subjectOptions,
  }
}

function relatedName(value: unknown): string {
  if (Array.isArray(value)) return relatedName(value[0])
  if (!isRecord(value) || typeof value.name !== "string") return ""
  return value.name
}

async function loadRecord(supabase: Db, kind: EditorKind, id: string): Promise<EditorRecord | null> {
  switch (kind) {
    case "department":
      return loadDepartment(supabase, id)
    case "course":
      return loadCourse(supabase, id)
    case "subject":
      return loadSubject(supabase, id)
    case "academic-year":
      return loadYear(supabase, id)
    case "semester":
      return loadSemester(supabase, id)
    case "teacher":
      return loadTeacher(supabase, id)
    case "student":
      return loadStudent(supabase, id)
    case "admission":
      return loadAdmission(supabase, id)
    case "announcement":
      return loadAnnouncement(supabase, id)
    case "event":
      return loadEvent(supabase, id, false)
    case "sports":
      return loadEvent(supabase, id, true)
    case "placement":
      return loadPlacement(supabase, id)
  }
}

async function loadDepartment(supabase: Db, id: string): Promise<EditorRecord | null> {
  const { data, error } = await supabase
    .from("departments")
    .select("id, name, code, description, is_active")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle()
  if (error || !isRecord(data) || typeof data.name !== "string" || typeof data.code !== "string") {
    return null
  }
  return {
    kind: "department",
    values: {
      id,
      name: data.name,
      code: data.code,
      description: typeof data.description === "string" ? data.description : "",
      isActive: data.is_active !== false,
    },
  }
}

async function loadCourse(supabase: Db, id: string): Promise<EditorRecord | null> {
  const { data, error } = await supabase
    .from("courses")
    .select("id, department_id, name, code, duration_semesters, description, is_active")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle()
  if (
    error ||
    !isRecord(data) ||
    typeof data.department_id !== "string" ||
    typeof data.name !== "string" ||
    typeof data.code !== "string" ||
    typeof data.duration_semesters !== "number"
  ) {
    return null
  }
  return {
    kind: "course",
    values: {
      id,
      departmentId: data.department_id,
      name: data.name,
      code: data.code,
      durationSemesters: data.duration_semesters,
      description: typeof data.description === "string" ? data.description : "",
      isActive: data.is_active !== false,
    },
  }
}

async function loadSubject(supabase: Db, id: string): Promise<EditorRecord | null> {
  const { data, error } = await supabase
    .from("subjects")
    .select("id, department_id, course_id, semester_number, name, code, credits, is_active")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle()
  if (
    error ||
    !isRecord(data) ||
    typeof data.department_id !== "string" ||
    typeof data.course_id !== "string" ||
    typeof data.semester_number !== "number" ||
    typeof data.name !== "string" ||
    typeof data.code !== "string" ||
    typeof data.credits !== "number"
  ) {
    return null
  }
  return {
    kind: "subject",
    values: {
      id,
      departmentId: data.department_id,
      courseId: data.course_id,
      semesterNumber: data.semester_number,
      name: data.name,
      code: data.code,
      credits: data.credits,
      isActive: data.is_active !== false,
    },
  }
}

async function loadYear(supabase: Db, id: string): Promise<EditorRecord | null> {
  const { data, error } = await supabase
    .from("academic_years")
    .select("id, name, starts_on, ends_on, is_current")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle()
  if (
    error ||
    !isRecord(data) ||
    typeof data.name !== "string" ||
    typeof data.starts_on !== "string" ||
    typeof data.ends_on !== "string"
  ) {
    return null
  }
  return {
    kind: "academic-year",
    values: {
      id,
      name: data.name,
      startsOn: toDateInput(data.starts_on),
      endsOn: toDateInput(data.ends_on),
      isCurrent: data.is_current === true,
    },
  }
}

async function loadSemester(supabase: Db, id: string): Promise<EditorRecord | null> {
  const { data, error } = await supabase
    .from("semesters")
    .select("id, course_id, academic_year_id, number, is_active")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle()
  if (
    error ||
    !isRecord(data) ||
    typeof data.course_id !== "string" ||
    typeof data.academic_year_id !== "string" ||
    typeof data.number !== "number"
  ) {
    return null
  }
  return {
    kind: "semester",
    values: {
      id,
      courseId: data.course_id,
      academicYearId: data.academic_year_id,
      number: data.number,
      isActive: data.is_active !== false,
    },
  }
}

async function loadTeacher(supabase: Db, id: string): Promise<EditorRecord | null> {
  const { data, error } = await supabase
    .from("teachers")
    .select("id, department_id, employee_code, designation, is_active, profiles(full_name, email, phone)")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle()
  if (error || !isRecord(data) || typeof data.designation !== "string") return null
  const profile = embed(data.profiles)
  if (!profile || typeof profile.full_name !== "string" || typeof profile.email !== "string") return null
  const links = await supabase.from("teacher_subjects").select("subject_id").eq("teacher_id", id)
  if (links.error || !Array.isArray(links.data)) return null
  const subjectIds = links.data.flatMap((row) =>
    isRecord(row) && typeof row.subject_id === "string" ? [row.subject_id] : [],
  )
  return {
    kind: "teacher",
    values: {
      id,
      fullName: profile.full_name,
      email: profile.email,
      phone: typeof profile.phone === "string" ? profile.phone : "",
      departmentId: typeof data.department_id === "string" ? data.department_id : "",
      employeeCode: typeof data.employee_code === "string" ? data.employee_code : "",
      designation: data.designation,
      isActive: data.is_active !== false,
      subjectIds,
    },
  }
}

async function loadStudent(supabase: Db, id: string): Promise<EditorRecord | null> {
  const { data, error } = await supabase
    .from("students")
    .select(
      "id, roll_number, department_id, course_id, semester_id, is_active, profiles(full_name, email)",
    )
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle()
  if (error || !isRecord(data)) return null
  const profile = embed(data.profiles)
  if (!profile || typeof profile.full_name !== "string" || typeof profile.email !== "string") return null
  return {
    kind: "student",
    values: {
      id,
      fullName: profile.full_name,
      email: profile.email,
      rollNumber: typeof data.roll_number === "string" ? data.roll_number : "",
      departmentId: typeof data.department_id === "string" ? data.department_id : "",
      courseId: typeof data.course_id === "string" ? data.course_id : "",
      semesterId: typeof data.semester_id === "string" ? data.semester_id : "",
      isActive: data.is_active !== false,
    },
  }
}

async function loadAdmission(supabase: Db, id: string): Promise<EditorRecord | null> {
  const { data, error } = await supabase
    .from("admissions")
    .select("id, full_name, email, phone, department_id, course_id, semester_id, notes, status")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle()
  if (
    error ||
    !isRecord(data) ||
    typeof data.full_name !== "string" ||
    typeof data.email !== "string" ||
    typeof data.status !== "string"
  ) {
    return null
  }
  return {
    kind: "admission",
    values: {
      id,
      fullName: data.full_name,
      email: data.email,
      phone: typeof data.phone === "string" ? data.phone : "",
      departmentId: typeof data.department_id === "string" ? data.department_id : "",
      courseId: typeof data.course_id === "string" ? data.course_id : "",
      semesterId: typeof data.semester_id === "string" ? data.semester_id : "",
      notes: typeof data.notes === "string" ? data.notes : "",
      status: data.status,
    },
  }
}

async function loadAnnouncement(supabase: Db, id: string): Promise<EditorRecord | null> {
  const { data, error } = await supabase
    .from("announcements")
    .select("id, title, body, audience, department_id, priority, publish_at, expires_at, status")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle()
  if (
    error ||
    !isRecord(data) ||
    typeof data.title !== "string" ||
    typeof data.audience !== "string" ||
    typeof data.priority !== "string" ||
    typeof data.publish_at !== "string" ||
    typeof data.status !== "string"
  ) {
    return null
  }
  return {
    kind: "announcement",
    values: {
      id,
      title: data.title,
      body: typeof data.body === "string" ? data.body : "",
      audience: data.audience,
      departmentId: typeof data.department_id === "string" ? data.department_id : "",
      priority: data.priority,
      publishAt: toDateTimeLocal(data.publish_at),
      expiresAt: toDateTimeLocal(typeof data.expires_at === "string" ? data.expires_at : null),
      status: data.status,
    },
  }
}

async function loadEvent(
  supabase: Db,
  id: string,
  sports: boolean,
): Promise<EditorRecord | null> {
  const { data, error } = await supabase
    .from("events")
    .select("id, title, description, event_type, starts_at, ends_at, venue, status, is_public")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle()
  if (
    error ||
    !isRecord(data) ||
    typeof data.title !== "string" ||
    typeof data.event_type !== "string" ||
    typeof data.starts_at !== "string" ||
    typeof data.status !== "string"
  ) {
    return null
  }
  if (sports && data.event_type !== "sports") return null
  if (!sports && (data.event_type === "sports" || data.event_type === "placement")) return null
  return {
    kind: sports ? "sports" : "event",
    values: {
      id,
      title: data.title,
      description: typeof data.description === "string" ? data.description : "",
      eventType: data.event_type,
      startsAt: toDateTimeLocal(data.starts_at),
      endsAt: toDateTimeLocal(typeof data.ends_at === "string" ? data.ends_at : null),
      venue: typeof data.venue === "string" ? data.venue : "",
      status: data.status,
      isPublic: data.is_public === true,
    },
  }
}

async function loadPlacement(supabase: Db, id: string): Promise<EditorRecord | null> {
  const { data, error } = await supabase
    .from("placement_drives")
    .select(
      "id, company_name, role_title, description, package_text, location, job_type, eligibility, required_skills, department_id, course_id, apply_by, visit_at, venue, status",
    )
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle()
  if (
    error ||
    !isRecord(data) ||
    typeof data.company_name !== "string" ||
    typeof data.role_title !== "string" ||
    typeof data.job_type !== "string" ||
    typeof data.apply_by !== "string" ||
    typeof data.status !== "string"
  ) {
    return null
  }

  const applications = await supabase
    .from("placement_applications")
    .select("id, status, applied_at, students(roll_number, profiles(full_name), courses(name), departments(name))")
    .eq("drive_id", id)
    .order("applied_at", { ascending: true })
  if (applications.error || !Array.isArray(applications.data)) return null

  const applicants = applications.data.flatMap((row) => {
    if (!isRecord(row) || typeof row.id !== "string" || typeof row.status !== "string") return []
    const student = embed(row.students)
    const profile = embed(student?.profiles)
    return [
      {
        id: row.id,
        studentName: typeof profile?.full_name === "string" ? profile.full_name : "Student",
        rollNumber: typeof student?.roll_number === "string" ? student.roll_number : "",
        courseName: relatedName(student?.courses),
        departmentName: relatedName(student?.departments),
        status: row.status,
      },
    ]
  })

  return {
    kind: "placement",
    values: {
      id,
      companyName: data.company_name,
      roleTitle: data.role_title,
      description: typeof data.description === "string" ? data.description : "",
      packageText: typeof data.package_text === "string" ? data.package_text : "",
      location: typeof data.location === "string" ? data.location : "",
      jobType: data.job_type,
      eligibility: typeof data.eligibility === "string" ? data.eligibility : "",
      requiredSkills: Array.isArray(data.required_skills)
        ? data.required_skills.filter((skill): skill is string => typeof skill === "string").join(", ")
        : "",
      departmentId: typeof data.department_id === "string" ? data.department_id : "",
      courseId: typeof data.course_id === "string" ? data.course_id : "",
      applyBy: toDateTimeLocal(data.apply_by),
      visitAt: toDateTimeLocal(typeof data.visit_at === "string" ? data.visit_at : null),
      venue: typeof data.venue === "string" ? data.venue : "",
      status: data.status,
      applicants,
    },
  }
}

function embed(value: unknown) {
  if (Array.isArray(value)) return isRecord(value[0]) ? value[0] : null
  return isRecord(value) ? value : null
}

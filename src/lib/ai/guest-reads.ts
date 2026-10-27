import "server-only"

import { createPublicClient } from "@/lib/supabase/public"
import { isRecord, QueryError } from "@/lib/db/errors"
import { filterCourses, filterSubjects, type PublicCourse, type PublicSubject } from "@/lib/ai/guest-college"

export async function readAdmissionsBrief() {
  const settings = await loadSettings()
  if (!settings) return json(null)
  return json({
    name: settings.name,
    admissionsInfo: settings.admissionsInfo,
    address: settings.address,
    phone: settings.phone,
    email: settings.email,
  })
}

export async function readCollegeProfile() {
  const settings = await loadSettings()
  if (!settings) return json(null)
  return json({
    name: settings.name,
    about: settings.about,
    address: settings.address,
    phone: settings.phone,
    email: settings.email,
  })
}

export async function readGuestDepartments(name?: string) {
  const departments = await loadDepartments()
  const query = name?.trim().toLowerCase() ?? ""
  const matched = query
    ? departments.filter((department) => department.name.toLowerCase().includes(query) || department.code.toLowerCase() === query)
    : departments
  return json(matched.map(({ name, code, description }) => ({ name, code, description })))
}

export async function readGuestCourses(filter: { department?: string; code?: string; name?: string }) {
  const courses = await loadCourses()
  return json(filterCourses(courses, filter).map(publicCourse))
}

export async function readGuestCourse(filter: { code?: string; name?: string }) {
  const courses = filterCourses(await loadCourses(), filter)
  return json(courses[0] ? publicCourse(courses[0]) : null)
}

export async function readGuestSubjects(courseCode: string) {
  return json(filterSubjects(await loadSubjects(), courseCode).map(({ name, code, credits, semesterNumber }) => ({
    name,
    code,
    credits,
    semesterNumber,
  })))
}

export async function readGuestYears() {
  const supabase = createPublicClient()
  const { data, error } = await supabase
    .from("academic_years")
    .select("name, starts_on, ends_on, is_current")
    .is("deleted_at", null)
    .order("starts_on")
  if (error) throw new QueryError()
  return json((data ?? []).flatMap((row) => {
    if (!isRecord(row) || typeof row.name !== "string" || typeof row.starts_on !== "string" || typeof row.ends_on !== "string") return []
    return [{ name: row.name, startsOn: row.starts_on, endsOn: row.ends_on, isCurrent: row.is_current === true }]
  }))
}

export async function readGuestSemesters(courseCode: string) {
  const supabase = createPublicClient()
  const { data, error } = await supabase
    .from("semesters")
    .select("number, courses(code), academic_years(name)")
    .eq("is_active", true)
    .is("deleted_at", null)
    .order("number")
  if (error) throw new QueryError()
  const code = courseCode.trim().toLowerCase()
  return json((data ?? []).flatMap((row) => {
    if (!isRecord(row) || typeof row.number !== "number") return []
    const course = related(row.courses, "code")
    if (course.toLowerCase() !== code) return []
    return [{ number: row.number, courseCode: course, yearName: related(row.academic_years, "name") }]
  }))
}

export async function readGuestEvents() {
  const supabase = createPublicClient()
  const { data, error } = await supabase
    .from("events")
    .select("title, description, event_type, starts_at, venue")
    .eq("status", "published")
    .eq("is_public", true)
    .is("deleted_at", null)
    .gte("starts_at", new Date().toISOString())
    .order("starts_at")
    .limit(20)
  if (error) throw new QueryError()
  return json((data ?? []).flatMap(eventRow))
}

export async function readGuestAnnouncements() {
  const now = new Date().toISOString()
  const supabase = createPublicClient()
  const { data, error } = await supabase
    .from("announcements")
    .select("title, body, publish_at, expires_at")
    .eq("status", "published")
    .eq("audience", "everyone")
    .is("deleted_at", null)
    .lte("publish_at", now)
    .or(`expires_at.is.null,expires_at.gt.${now}`)
    .order("publish_at", { ascending: false })
    .limit(20)
  if (error) throw new QueryError()
  return json((data ?? []).flatMap((row) => {
    if (!isRecord(row) || typeof row.title !== "string" || typeof row.body !== "string" || typeof row.publish_at !== "string") return []
    return [{ title: row.title, body: row.body, publishAt: row.publish_at }]
  }))
}

export async function loadApplicationCatalog() {
  const [departments, courses] = await Promise.all([loadDepartments(), loadCourses()])
  return {
    departments: departments.map(({ id, name }) => ({ id, name })),
    courses: courses.map((course) => ({ id: course.id, name: course.name, departmentId: course.departmentId })),
  }
}

export async function loadPublicCorpus() {
  const [settings, departments, courses, events, announcements] = await Promise.all([
    loadSettings(),
    loadDepartments(),
    loadCourses(),
    loadIndexEvents(),
    loadIndexAnnouncements(),
  ])
  return {
    settings,
    departments: departments.map(({ id, name, description }) => ({ id, name, description })),
    courses: courses.map(({ id, name, description }) => ({ id, name, description })),
    events,
    announcements,
  }
}

async function loadSettings() {
  const supabase = createPublicClient()
  const { data, error } = await supabase
    .from("college_settings")
    .select("name, about, address, phone, email, admissions_info")
    .eq("id", true)
    .maybeSingle()
  if (error) throw new QueryError()
  if (!isRecord(data) || typeof data.name !== "string" || typeof data.about !== "string" || typeof data.address !== "string") return null
  if (typeof data.phone !== "string" || typeof data.email !== "string" || typeof data.admissions_info !== "string") return null
  return {
    name: data.name,
    about: data.about,
    address: data.address,
    phone: data.phone,
    email: data.email,
    admissionsInfo: data.admissions_info,
  }
}

async function loadDepartments() {
  const supabase = createPublicClient()
  const { data, error } = await supabase
    .from("departments")
    .select("id, name, code, description")
    .eq("is_active", true)
    .is("deleted_at", null)
    .order("name")
  if (error) throw new QueryError()
  return (data ?? []).flatMap((row) => {
    if (!isRecord(row) || typeof row.id !== "string" || typeof row.name !== "string" || typeof row.code !== "string") return []
    if (typeof row.description !== "string") return []
    return [{ id: row.id, name: row.name, code: row.code, description: row.description }]
  })
}

async function loadCourses(): Promise<(PublicCourse & { id: string; departmentId: string })[]> {
  const supabase = createPublicClient()
  const { data, error } = await supabase
    .from("courses")
    .select("id, name, code, description, duration_semesters, department_id, departments(name, code)")
    .eq("is_active", true)
    .is("deleted_at", null)
    .order("name")
  if (error) throw new QueryError()
  return (data ?? []).flatMap((row) => {
    if (!isRecord(row) || typeof row.id !== "string" || typeof row.name !== "string" || typeof row.code !== "string") return []
    if (typeof row.description !== "string" || typeof row.duration_semesters !== "number" || typeof row.department_id !== "string") return []
    return [{
      id: row.id,
      name: row.name,
      code: row.code,
      description: row.description,
      durationSemesters: row.duration_semesters,
      departmentName: related(row.departments, "name"),
      departmentCode: related(row.departments, "code"),
      departmentId: row.department_id,
    }]
  })
}

async function loadSubjects(): Promise<PublicSubject[]> {
  const supabase = createPublicClient()
  const { data, error } = await supabase
    .from("subjects")
    .select("name, code, credits, semester_number, courses(code)")
    .eq("is_active", true)
    .is("deleted_at", null)
    .order("code")
  if (error) throw new QueryError()
  return (data ?? []).flatMap((row) => {
    if (!isRecord(row) || typeof row.name !== "string" || typeof row.code !== "string") return []
    if (typeof row.credits !== "number" || typeof row.semester_number !== "number") return []
    return [{
      name: row.name,
      code: row.code,
      credits: row.credits,
      semesterNumber: row.semester_number,
      courseCode: related(row.courses, "code"),
    }]
  })
}

async function loadIndexEvents() {
  const supabase = createPublicClient()
  const { data, error } = await supabase
    .from("events")
    .select("id, title, description")
    .eq("status", "published")
    .eq("is_public", true)
    .is("deleted_at", null)
  if (error) throw new QueryError()
  return (data ?? []).flatMap((row) => {
    if (!isRecord(row) || typeof row.id !== "string" || typeof row.title !== "string" || typeof row.description !== "string") return []
    return [{ id: row.id, title: row.title, description: row.description }]
  })
}

async function loadIndexAnnouncements() {
  const now = new Date().toISOString()
  const supabase = createPublicClient()
  const { data, error } = await supabase
    .from("announcements")
    .select("id, title, body")
    .eq("status", "published")
    .eq("audience", "everyone")
    .is("deleted_at", null)
    .lte("publish_at", now)
    .or(`expires_at.is.null,expires_at.gt.${now}`)
  if (error) throw new QueryError()
  return (data ?? []).flatMap((row) => {
    if (!isRecord(row) || typeof row.id !== "string" || typeof row.title !== "string" || typeof row.body !== "string") return []
    return [{ id: row.id, title: row.title, body: row.body }]
  })
}

function publicCourse(course: PublicCourse) {
  return {
    name: course.name,
    code: course.code,
    description: course.description,
    durationSemesters: course.durationSemesters,
    departmentName: course.departmentName,
    departmentCode: course.departmentCode,
  }
}

function eventRow(row: unknown) {
  if (!isRecord(row) || typeof row.title !== "string" || typeof row.description !== "string") return []
  if (typeof row.event_type !== "string" || typeof row.starts_at !== "string" || typeof row.venue !== "string") return []
  return [{ title: row.title, description: row.description, eventType: row.event_type, startsAt: row.starts_at, venue: row.venue }]
}

function related(value: unknown, key: string) {
  const row = Array.isArray(value) ? value[0] : value
  if (!isRecord(row) || typeof row[key] !== "string") return ""
  return row[key]
}

function json(value: unknown) {
  return JSON.stringify(value)
}

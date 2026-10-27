import "server-only"

import { cacheLife, cacheTag } from "next/cache"

import { cacheTags } from "@/actions/cache-tags"
import { isCollegeProfileReady } from "@/actions/admin/dashboard/operations"
import { QueryError, isRecord } from "@/lib/db/errors"
import { createPublicClient } from "@/lib/supabase/public"

export type CollegeSettings = {
  name: string
  about: string
  address: string
  phone: string
  email: string
  admissionsInfo: string
}

export type DepartmentItem = {
  id: string
  name: string
  code: string
  description: string
}

export type CourseItem = {
  id: string
  name: string
  code: string
  description: string
  departmentName: string
}

export type PublicEvent = {
  id: string
  title: string
  description: string
  eventType: string
  startsAt: string
  venue: string
}

export type PublicAnnouncement = {
  id: string
  title: string
  body: string
  publishAt: string
}

export type CatalogSnapshot = {
  departments: number
  courses: number
  subjects: number
  currentYear: string | null
  profileReady: boolean
}

export async function getCollegeSettings(): Promise<CollegeSettings | null> {
  "use cache"
  cacheLife("minutes")
  cacheTag(cacheTags.collegeSettings)

  const supabase = createPublicClient()
  const { data, error } = await supabase
    .from("college_settings")
    .select("name, about, address, phone, email, admissions_info")
    .eq("id", true)
    .maybeSingle()

  if (error) {
    throw new QueryError()
  }
  if (!data || !isCollegeSettingsRow(data)) {
    return null
  }

  return {
    name: data.name,
    about: data.about,
    address: data.address,
    phone: data.phone,
    email: data.email,
    admissionsInfo: data.admissions_info,
  }
}

export async function getCatalogSnapshot(): Promise<CatalogSnapshot> {
  "use cache"
  cacheLife("minutes")
  cacheTag(
    cacheTags.collegeSettings,
    cacheTags.departments,
    cacheTags.courses,
    cacheTags.subjects,
    cacheTags.academicYears,
  )

  const supabase = createPublicClient()
  const [departments, courses, subjects, settings, years] = await Promise.all([
    supabase
      .from("departments")
      .select("id", { count: "exact", head: true })
      .eq("is_active", true)
      .is("deleted_at", null),
    supabase
      .from("courses")
      .select("id", { count: "exact", head: true })
      .eq("is_active", true)
      .is("deleted_at", null),
    supabase
      .from("subjects")
      .select("id", { count: "exact", head: true })
      .eq("is_active", true)
      .is("deleted_at", null),
    supabase
      .from("college_settings")
      .select("name, about, address, phone, email, admissions_info")
      .eq("id", true)
      .maybeSingle(),
    supabase.from("academic_years").select("name, is_current").is("deleted_at", null),
  ])

  if (
    departments.error ||
    courses.error ||
    subjects.error ||
    settings.error ||
    years.error ||
    departments.count === null ||
    courses.count === null ||
    subjects.count === null ||
    !isCollegeSettingsRow(settings.data) ||
    !Array.isArray(years.data) ||
    !years.data.every(isYearNameRow)
  ) {
    throw new QueryError()
  }

  const current = years.data.find((year) => year.is_current)

  return {
    departments: departments.count,
    courses: courses.count,
    subjects: subjects.count,
    currentYear: current?.name ?? null,
    profileReady: isCollegeProfileReady({
      name: settings.data.name,
      about: settings.data.about,
      address: settings.data.address,
      phone: settings.data.phone,
      email: settings.data.email,
      admissionsInfo: settings.data.admissions_info,
    }),
  }
}

export async function listDepartments(): Promise<DepartmentItem[]> {
  "use cache"
  cacheLife("minutes")
  cacheTag(cacheTags.departments)

  const supabase = createPublicClient()
  const { data, error } = await supabase
    .from("departments")
    .select("id, name, code, description")
    .eq("is_active", true)
    .is("deleted_at", null)
    .order("name")

  if (error || !Array.isArray(data) || !data.every(isDepartmentRow)) {
    throw new QueryError()
  }

  return data.map((row) => ({
    id: row.id,
    name: row.name,
    code: row.code,
    description: row.description,
  }))
}

export async function listCourses(): Promise<CourseItem[]> {
  "use cache"
  cacheLife("minutes")
  cacheTag(cacheTags.courses, cacheTags.departments)

  const supabase = createPublicClient()
  const [{ data: courses, error: courseError }, { data: departments, error: departmentError }] =
    await Promise.all([
      supabase
        .from("courses")
        .select("id, name, code, description, department_id")
        .eq("is_active", true)
        .is("deleted_at", null)
        .order("name"),
      supabase
        .from("departments")
        .select("id, name")
        .eq("is_active", true)
        .is("deleted_at", null),
    ])

  if (
    courseError ||
    departmentError ||
    !Array.isArray(courses) ||
    !Array.isArray(departments) ||
    !courses.every(isCourseRow) ||
    !departments.every(isDepartmentNameRow)
  ) {
    throw new QueryError()
  }

  const names = new Map(departments.map((row) => [row.id, row.name]))

  return courses.map((row) => ({
    id: row.id,
    name: row.name,
    code: row.code,
    description: row.description,
    departmentName: names.get(row.department_id) ?? "Department",
  }))
}

export async function listPublicEvents(): Promise<PublicEvent[]> {
  "use cache"
  cacheLife("minutes")
  cacheTag(cacheTags.publicEvents)

  const supabase = createPublicClient()
  const { data, error } = await supabase
    .from("events")
    .select("id, title, description, event_type, starts_at, venue")
    .eq("status", "published")
    .eq("is_public", true)
    .is("deleted_at", null)
    .gte("starts_at", new Date().toISOString())
    .order("starts_at", { ascending: true })
    .limit(20)

  if (error || !Array.isArray(data) || !data.every(isEventRow)) {
    throw new QueryError()
  }

  return data.map((row) => ({
    id: row.id,
    title: row.title,
    description: row.description,
    eventType: row.event_type,
    startsAt: row.starts_at,
    venue: row.venue,
  }))
}

export async function listPublicAnnouncements(): Promise<PublicAnnouncement[]> {
  "use cache"
  cacheLife("minutes")
  cacheTag(cacheTags.announcements)

  const supabase = createPublicClient()
  const { data, error } = await supabase
    .from("announcements")
    .select("id, title, body, publish_at")
    .eq("status", "published")
    .eq("audience", "everyone")
    .is("deleted_at", null)
    .order("publish_at", { ascending: false })
    .limit(5)

  if (error || !Array.isArray(data) || !data.every(isAnnouncementRow)) {
    throw new QueryError()
  }

  return data.map((row) => ({
    id: row.id,
    title: row.title,
    body: row.body,
    publishAt: row.publish_at,
  }))
}

function isCollegeSettingsRow(value: unknown): value is {
  name: string
  about: string
  address: string
  phone: string
  email: string
  admissions_info: string
} {
  if (!isRecord(value)) return false
  return (
    typeof value.name === "string" &&
    typeof value.about === "string" &&
    typeof value.address === "string" &&
    typeof value.phone === "string" &&
    typeof value.email === "string" &&
    typeof value.admissions_info === "string"
  )
}

function isYearNameRow(value: unknown): value is { name: string; is_current: boolean } {
  if (!isRecord(value)) return false
  return typeof value.name === "string" && typeof value.is_current === "boolean"
}

function isDepartmentRow(value: unknown): value is {
  id: string
  name: string
  code: string
  description: string
} {
  if (!isRecord(value)) return false
  return (
    typeof value.id === "string" &&
    typeof value.name === "string" &&
    typeof value.code === "string" &&
    typeof value.description === "string"
  )
}

function isDepartmentNameRow(value: unknown): value is { id: string; name: string } {
  if (!isRecord(value)) return false
  return typeof value.id === "string" && typeof value.name === "string"
}

function isCourseRow(value: unknown): value is {
  id: string
  name: string
  code: string
  description: string
  department_id: string
} {
  if (!isRecord(value)) return false
  return (
    typeof value.id === "string" &&
    typeof value.name === "string" &&
    typeof value.code === "string" &&
    typeof value.description === "string" &&
    typeof value.department_id === "string"
  )
}

function isEventRow(value: unknown): value is {
  id: string
  title: string
  description: string
  event_type: string
  starts_at: string
  venue: string
} {
  if (!isRecord(value)) return false
  return (
    typeof value.id === "string" &&
    typeof value.title === "string" &&
    typeof value.description === "string" &&
    typeof value.event_type === "string" &&
    typeof value.starts_at === "string" &&
    typeof value.venue === "string"
  )
}

function isAnnouncementRow(value: unknown): value is {
  id: string
  title: string
  body: string
  publish_at: string
} {
  if (!isRecord(value)) return false
  return (
    typeof value.id === "string" &&
    typeof value.title === "string" &&
    typeof value.body === "string" &&
    typeof value.publish_at === "string"
  )
}

import "server-only"

import { cache } from "react"

import {
  activityMatch,
  campusDb,
  matchesQuery,
  relatedText,
  readRows,
  statusLabel,
  toneFor,
} from "@/actions/records/shared"
import type { RecordCard } from "@/actions/records/types"
import { getCurrentProfile } from "@/lib/auth/session"
import { readTeacherAssignment } from "@/lib/auth/teaching"
import { QueryError, isRecord } from "@/lib/db/errors"
import { formatDate } from "@/lib/format"

const readDepartments = cache(async () => {
  const supabase = await campusDb()
  const { data, error } = await supabase
    .from("departments")
    .select("id, name, code, description, is_active")
    .is("deleted_at", null)
    .order("name")

  return readRows(data, error, isDepartmentRow)
})

export const listDepartmentCards = cache(async (query: string, facet: string) => {
  const rows = await readDepartments()
  return rows
    .filter((row) => activityMatch(row.is_active, facet))
    .map(toDepartmentCard)
    .filter((card) => matchesQuery(card, query))
})

const readCourses = cache(async () => {
  const supabase = await campusDb()
  const { data, error } = await supabase
    .from("courses")
    .select("id, name, code, description, duration_semesters, is_active, departments(name)")
    .is("deleted_at", null)
    .order("name")

  return readRows(data, error, isCourseRow)
})

export const listCourseCards = cache(async (query: string, facet: string) => {
  const rows = await readCourses()
  return rows
    .filter((row) => activityMatch(row.is_active, facet))
    .map(toCourseCard)
    .filter((card) => matchesQuery(card, query))
})

const readSubjects = cache(async () => {
  const supabase = await campusDb()
  const { data, error } = await supabase
    .from("subjects")
    .select(
      "id, course_id, name, code, credits, semester_number, is_active, departments(name), courses(name)",
    )
    .is("deleted_at", null)
    .order("semester_number")
    .order("name")

  return readRows(data, error, isSubjectRow)
})

export const listSubjectCards = cache(async (query: string, facet: string) => {
  const rows = await readSubjects()
  return rows
    .filter((row) => activityMatch(row.is_active, facet))
    .map(toSubjectCard)
    .filter((card) => matchesQuery(card, query))
})

export const listAssignedSubjectCards = cache(async (query: string, facet: string) => {
  const allowed = await assignedSubjectIds()
  const rows = await readSubjects()
  return rows
    .filter((row) => allowed.has(row.id))
    .filter((row) => activityMatch(row.is_active, facet))
    .map(toSubjectCard)
    .filter((card) => matchesQuery(card, query))
})

export const listCourseSubjectCards = cache(async (query: string, facet: string) => {
  const courseId = await currentCourseId()
  if (!courseId) return []
  const rows = await readSubjects()
  return rows
    .filter((row) => row.course_id === courseId && row.is_active)
    .filter((row) => activityMatch(row.is_active, facet))
    .map(toSubjectCard)
    .filter((card) => matchesQuery(card, query))
})

async function assignedSubjectIds() {
  const profile = await getCurrentProfile()
  if (!profile) return new Set<string>()
  const assignment = await readTeacherAssignment(profile.id)
  return assignment?.subjectIds ?? new Set<string>()
}

async function currentCourseId() {
  const profile = await getCurrentProfile()
  if (!profile) return null
  const supabase = await campusDb()
  const student = await supabase
    .from("students")
    .select("course_id")
    .eq("profile_id", profile.id)
    .is("deleted_at", null)
    .maybeSingle()
  if (student.error) throw new QueryError()
  if (!isRecord(student.data)) return null
  return typeof student.data.course_id === "string" ? student.data.course_id : null
}

const readYears = cache(async () => {
  const supabase = await campusDb()
  const { data, error } = await supabase
    .from("academic_years")
    .select("id, name, starts_on, ends_on, is_current")
    .is("deleted_at", null)
    .order("starts_on", { ascending: false })

  return readRows(data, error, isYearRow)
})

const readSemesters = cache(async () => {
  const supabase = await campusDb()
  const { data, error } = await supabase
    .from("semesters")
    .select("id, number, is_active, courses(name), academic_years(name)")
    .is("deleted_at", null)
    .order("number")

  return readRows(data, error, isSemesterRow)
})

export const listSemesterCards = cache(async (query: string, facet: string) => {
  const rows = await readSemesters()
  return rows
    .filter((row) => activityMatch(row.is_active, facet))
    .map(toSemesterCard)
    .filter((card) => matchesQuery(card, query))
})

export const listYearCards = cache(async (query: string, facet: string) => {
  const rows = await readYears()
  return rows
    .filter((row) => {
      if (facet === "current") return row.is_current
      if (facet === "other") return !row.is_current
      return true
    })
    .map(toYearCard)
    .filter((card) => matchesQuery(card, query))
})

function toDepartmentCard(row: DepartmentRow): RecordCard {
  const status = row.is_active ? "active" : "inactive"
  return {
    id: row.id,
    title: row.name,
    subtitle: row.code,
    detail: row.description,
    meta: "",
    badge: statusLabel(status),
    tone: toneFor(status),
  }
}

function toCourseCard(row: CourseRow): RecordCard {
  const status = row.is_active ? "active" : "inactive"
  return {
    id: row.id,
    title: row.name,
    subtitle: relatedText(row.departments, "name"),
    detail: row.description,
    meta: `${row.code} · ${row.duration_semesters} semesters`,
    badge: statusLabel(status),
    tone: toneFor(status),
  }
}

function toSubjectCard(row: SubjectRow): RecordCard {
  const status = row.is_active ? "active" : "inactive"
  const credits = row.credits === 1 ? "1 credit" : `${row.credits} credits`
  return {
    id: row.id,
    title: row.name,
    subtitle: [row.code, relatedText(row.courses, "name")].filter(Boolean).join(" · "),
    detail: relatedText(row.departments, "name"),
    meta: `Semester ${row.semester_number} · ${credits}`,
    badge: statusLabel(status),
    tone: toneFor(status),
  }
}

function toSemesterCard(row: SemesterRow): RecordCard {
  const status = row.is_active ? "active" : "inactive"
  return {
    id: row.id,
    title: `Semester ${row.number}`,
    subtitle: relatedText(row.courses, "name"),
    detail: relatedText(row.academic_years, "name"),
    meta: "",
    badge: statusLabel(status),
    tone: toneFor(status),
  }
}

function toYearCard(row: YearRow): RecordCard {
  const status = row.is_current ? "current" : "neutral"
  return {
    id: row.id,
    title: row.name,
    subtitle: `${formatDate(row.starts_on)} – ${formatDate(row.ends_on)}`,
    detail: row.is_current ? "This is the year the office is working in." : "",
    meta: "",
    badge: row.is_current ? "Current" : "Closed",
    tone: status === "current" ? "good" : "neutral",
  }
}

type DepartmentRow = {
  id: string
  name: string
  code: string
  description: string
  is_active: boolean
}

type CourseRow = {
  id: string
  name: string
  code: string
  description: string
  duration_semesters: number
  is_active: boolean
  departments: unknown
}

type SubjectRow = {
  id: string
  course_id: string
  name: string
  code: string
  credits: number
  semester_number: number
  is_active: boolean
  departments: unknown
  courses: unknown
}

type SemesterRow = {
  id: string
  number: number
  is_active: boolean
  courses: unknown
  academic_years: unknown
}

type YearRow = {
  id: string
  name: string
  starts_on: string
  ends_on: string
  is_current: boolean
}

function isDepartmentRow(value: unknown): value is DepartmentRow {
  if (!isRecord(value)) return false
  return (
    typeof value.id === "string" &&
    typeof value.name === "string" &&
    typeof value.code === "string" &&
    typeof value.description === "string" &&
    typeof value.is_active === "boolean"
  )
}

function isCourseRow(value: unknown): value is CourseRow {
  if (!isRecord(value)) return false
  return (
    typeof value.id === "string" &&
    typeof value.name === "string" &&
    typeof value.code === "string" &&
    typeof value.description === "string" &&
    typeof value.duration_semesters === "number" &&
    typeof value.is_active === "boolean"
  )
}

function isSubjectRow(value: unknown): value is SubjectRow {
  if (!isRecord(value)) return false
  return (
    typeof value.id === "string" &&
    typeof value.course_id === "string" &&
    typeof value.name === "string" &&
    typeof value.code === "string" &&
    typeof value.credits === "number" &&
    typeof value.semester_number === "number" &&
    typeof value.is_active === "boolean"
  )
}

function isSemesterRow(value: unknown): value is SemesterRow {
  if (!isRecord(value)) return false
  return typeof value.id === "string" && typeof value.number === "number" && typeof value.is_active === "boolean"
}

function isYearRow(value: unknown): value is YearRow {
  if (!isRecord(value)) return false
  return (
    typeof value.id === "string" &&
    typeof value.name === "string" &&
    typeof value.starts_on === "string" &&
    typeof value.ends_on === "string" &&
    typeof value.is_current === "boolean"
  )
}

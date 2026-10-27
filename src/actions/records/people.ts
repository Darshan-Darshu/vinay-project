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
import { isRecord } from "@/lib/db/errors"
import { formatDateTime } from "@/lib/format"

const readAdmissions = cache(async () => {
  const supabase = await campusDb()
  const { data, error } = await supabase
    .from("admissions")
    .select(
      "id, full_name, email, phone, status, notes, created_at, departments(name), courses(name), semesters(number)",
    )
    .is("deleted_at", null)
    .order("created_at", { ascending: false })

  return readRows(data, error, isAdmissionRow)
})

export const listAdmissionCards = cache(async (query: string, facet: string) => {
  const rows = await readAdmissions()
  return rows
    .filter((row) => facet === "" || row.status === facet)
    .map(toAdmissionCard)
    .filter((card) => matchesQuery(card, query))
})

const readStudents = cache(async () => {
  const supabase = await campusDb()
  const { data, error } = await supabase
    .from("students")
    .select(
      "id, roll_number, is_active, profiles(full_name, email), departments(name), courses(name)",
    )
    .is("deleted_at", null)
    .order("roll_number", { ascending: true })

  return readRows(data, error, isStudentRow)
})

export const listStudentCards = cache(async (query: string, facet: string) => {
  const rows = await readStudents()
  return rows
    .filter((row) => activityMatch(row.is_active, facet))
    .map(toStudentCard)
    .filter((card) => matchesQuery(card, query))
})

const readTeachers = cache(async () => {
  const supabase = await campusDb()
  const { data, error } = await supabase
    .from("teachers")
    .select(
      "id, employee_code, designation, is_active, profiles(full_name, email), departments(name)",
    )
    .is("deleted_at", null)
    .order("employee_code", { ascending: true })

  return readRows(data, error, isTeacherRow)
})

export const listTeacherCards = cache(async (query: string, facet: string) => {
  const rows = await readTeachers()
  return rows
    .filter((row) => activityMatch(row.is_active, facet))
    .map(toTeacherCard)
    .filter((card) => matchesQuery(card, query))
})

function toAdmissionCard(row: AdmissionRow): RecordCard {
  const department = relatedText(row.departments, "name")
  const course = relatedText(row.courses, "name")
  const semester = relatedText(row.semesters, "number")
  const place = [course, department].filter(Boolean).join(" · ")
  return {
    id: row.id,
    title: row.full_name,
    subtitle: row.email,
    detail: row.notes,
    meta: [row.phone, semester ? `Semester ${semester}` : "", place, formatDateTime(row.created_at)]
      .filter(Boolean)
      .join(" · "),
    badge: statusLabel(row.status),
    tone: toneFor(row.status),
  }
}

function toStudentCard(row: StudentRow): RecordCard {
  const status = row.is_active ? "active" : "inactive"
  return {
    id: row.id,
    title: relatedText(row.profiles, "full_name") || "Student",
    subtitle: relatedText(row.profiles, "email"),
    detail: relatedText(row.courses, "name"),
    meta: [row.roll_number, relatedText(row.departments, "name")].filter(Boolean).join(" · "),
    badge: statusLabel(status),
    tone: toneFor(status),
  }
}

function toTeacherCard(row: TeacherRow): RecordCard {
  const status = row.is_active ? "active" : "inactive"
  return {
    id: row.id,
    title: relatedText(row.profiles, "full_name") || "Teacher",
    subtitle: row.designation,
    detail: relatedText(row.profiles, "email"),
    meta: [row.employee_code, relatedText(row.departments, "name")].filter(Boolean).join(" · "),
    badge: statusLabel(status),
    tone: toneFor(status),
  }
}

type AdmissionRow = {
  id: string
  full_name: string
  email: string
  phone: string | null
  status: string
  notes: string
  created_at: string
  departments: unknown
  courses: unknown
  semesters: unknown
}

type StudentRow = {
  id: string
  roll_number: string | null
  is_active: boolean
  profiles: unknown
  departments: unknown
  courses: unknown
}

type TeacherRow = {
  id: string
  employee_code: string | null
  designation: string
  is_active: boolean
  profiles: unknown
  departments: unknown
}

function isAdmissionRow(value: unknown): value is AdmissionRow {
  if (!isRecord(value)) return false
  return (
    typeof value.id === "string" &&
    typeof value.full_name === "string" &&
    typeof value.email === "string" &&
    (value.phone === null || typeof value.phone === "string") &&
    typeof value.status === "string" &&
    typeof value.notes === "string" &&
    typeof value.created_at === "string"
  )
}

function isStudentRow(value: unknown): value is StudentRow {
  if (!isRecord(value)) return false
  return (
    typeof value.id === "string" &&
    (value.roll_number === null || typeof value.roll_number === "string") &&
    typeof value.is_active === "boolean"
  )
}

function isTeacherRow(value: unknown): value is TeacherRow {
  if (!isRecord(value)) return false
  return (
    typeof value.id === "string" &&
    (value.employee_code === null || typeof value.employee_code === "string") &&
    typeof value.designation === "string" &&
    typeof value.is_active === "boolean"
  )
}

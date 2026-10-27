import "server-only"

import { connection } from "next/server"

import type { PublicEvent } from "@/actions/college/catalog/getQueries"
import { readTeacherAssignment } from "@/lib/auth/teaching"
import { QueryError, isRecord } from "@/lib/db/errors"
import type { AppRole } from "@/lib/permissions/roles"
import { createClient } from "@/lib/supabase/server"

export type RoleFocus = {
  title: string
  value: string
  detail: string
}

export type RoleDesk = {
  headline: string
  summary: string
  actionHref: string
  actionLabel: string
  focus: RoleFocus[]
  termLabel: string
  events: PublicEvent[]
}

export async function getRoleDesk(input: {
  profileId: string
  role: Extract<AppRole, "teacher" | "student">
}): Promise<RoleDesk> {
  await connection()
  const supabase = await createClient()
  const now = new Date().toISOString()
  const [years, eventsResult, notices] = await Promise.all([
    supabase.from("academic_years").select("name, is_current, starts_on, ends_on").is("deleted_at", null),
    supabase
      .from("events")
      .select("id, title, description, event_type, starts_at, venue")
      .eq("status", "published")
      .neq("event_type", "placement")
      .is("deleted_at", null)
      .gte("starts_at", now)
      .order("starts_at", { ascending: true })
      .limit(8),
    supabase
      .from("announcements")
      .select("id", { count: "exact", head: true })
      .eq("status", "published")
      .is("deleted_at", null),
  ])

  if (
    years.error ||
    eventsResult.error ||
    notices.error ||
    notices.count === null ||
    !Array.isArray(years.data) ||
    !years.data.every(isYearRow) ||
    !Array.isArray(eventsResult.data) ||
    !eventsResult.data.every(isEventRow)
  ) {
    throw new QueryError()
  }

  const current = years.data.find((year) => year.is_current) ?? null
  const termLabel = current
    ? `${current.name} · ${current.starts_on} to ${current.ends_on}`
    : "No academic year is marked current"
  const events = eventsResult.data.map((row) => ({
    id: row.id,
    title: row.title,
    description: row.description,
    eventType: labelEvent(row.event_type),
    startsAt: row.starts_at,
    venue: row.venue,
  }))

  if (input.role === "student") {
    const student = await supabase
      .from("students")
      .select("roll_number, course_id, courses(name)")
      .eq("profile_id", input.profileId)
      .is("deleted_at", null)
      .maybeSingle()
    if (student.error) throw new QueryError()
    const row = isStudentRow(student.data) ? student.data : null
    const courseName = relatedName(row?.courses)
    const courseId = row?.course_id ?? null
    const subjects = courseId
      ? await supabase
          .from("subjects")
          .select("id", { count: "exact", head: true })
          .eq("course_id", courseId)
          .eq("is_active", true)
          .is("deleted_at", null)
      : { count: 0, error: null }
    const applications = await supabase
      .from("placement_applications")
      .select("id", { count: "exact", head: true })
    if (subjects.error || applications.error || subjects.count === null || applications.count === null) {
      throw new QueryError()
    }

    return {
      headline: courseName ? `Enrolled in ${courseName}` : "Waiting for enrollment",
      summary: courseName
        ? "Your course, subjects, placement applications, and upcoming events."
        : "The office has not linked this account to a course yet.",
      actionHref: "/student/subjects",
      actionLabel: "My subjects",
      termLabel,
      events,
      focus: [
        {
          title: "Course",
          value: courseName || "Not enrolled",
          detail: row?.roll_number ? `Roll ${row.roll_number}` : "Roll number is assigned with enrollment",
        },
        {
          title: "Subjects",
          value: String(subjects.count),
          detail: courseName ? `Subjects in ${courseName}` : "Subjects appear after enrollment",
        },
        {
          title: "Placement applications",
          value: String(applications.count),
          detail: "Companies you have applied to",
        },
        {
          title: "Notices",
          value: String(notices.count),
          detail: "Notices published for you",
        },
      ],
    }
  }

  const assignment = await readTeacherAssignment(input.profileId)
  const students = await supabase
    .from("students")
    .select("id", { count: "exact", head: true })
    .eq("is_active", true)
    .is("deleted_at", null)
  if (students.error || students.count === null) throw new QueryError()

  return {
    headline: assignment?.designation ? assignment.designation : "Teacher account",
    summary: assignment
      ? "Subjects assigned to you, students in those courses, and upcoming events."
      : "The office has not linked this account to a department yet.",
    actionHref: "/teacher/subjects",
    actionLabel: "My subjects",
    termLabel,
    events,
    focus: [
      {
        title: "Staff record",
        value: assignment ? "On file" : "Not linked",
        detail: assignment?.employeeCode ? `Code ${assignment.employeeCode}` : "Employee code appears after linking",
      },
      {
        title: "Assigned subjects",
        value: String(assignment?.subjectIds.size ?? 0),
        detail: "Subjects the office has assigned to you",
      },
      {
        title: "Students",
        value: String(students.count),
        detail: "Active students in your assigned courses",
      },
      {
        title: "Notices",
        value: String(notices.count),
        detail: "Notices published for you",
      },
    ],
  }
}

function labelEvent(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function relatedName(value: unknown) {
  const row = Array.isArray(value) ? value[0] : value
  if (!isRecord(row) || typeof row.name !== "string") return ""
  return row.name
}

function isYearRow(value: unknown): value is {
  name: string
  is_current: boolean
  starts_on: string
  ends_on: string
} {
  if (!isRecord(value)) return false
  return (
    typeof value.name === "string" &&
    typeof value.is_current === "boolean" &&
    typeof value.starts_on === "string" &&
    typeof value.ends_on === "string"
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

function isStudentRow(value: unknown): value is {
  roll_number: string | null
  course_id: string | null
  courses: unknown
} {
  if (!isRecord(value)) return false
  return (
    (typeof value.roll_number === "string" || value.roll_number === null) &&
    (typeof value.course_id === "string" || value.course_id === null)
  )
}

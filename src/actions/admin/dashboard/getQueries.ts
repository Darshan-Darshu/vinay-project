import "server-only"

import { cacheLife, cacheTag } from "next/cache"
import { connection } from "next/server"

import { cacheTags } from "@/actions/cache-tags"
import {
  buildOfficeTasks,
  buildReadiness,
  readinessPercent,
  type AdmissionPipeline,
  type OfficeTask,
  type ReadinessCheck,
} from "@/actions/admin/dashboard/operations"
import {
  getCatalogSnapshot,
  listCourses,
  listPublicEvents,
  type CourseItem,
  type PublicEvent,
} from "@/actions/college/catalog/getQueries"
import { QueryError, isRecord } from "@/lib/db/errors"
import { createClient } from "@/lib/supabase/server"

export type AdminCatalog = {
  departments: number
  activeCourses: number
  subjects: number
  currentYear: string | null
  courses: CourseItem[]
  events: PublicEvent[]
  checks: ReadinessCheck[]
  readiness: number
}

export type AdminOffice = {
  students: number
  teachers: number
  departments: number
  newAdmissions: number
  openDrives: number
  pendingApplications: number
  activeCourses: number
  readiness: number
  checks: ReadinessCheck[]
  tasks: OfficeTask[]
  pipeline: AdmissionPipeline
  recentActivity: {
    id: string
    summary: string
    createdAt: string
  }[]
}

export async function getAdminCatalog(): Promise<AdminCatalog> {
  "use cache"
  cacheLife("minutes")
  cacheTag(
    cacheTags.courses,
    cacheTags.departments,
    cacheTags.subjects,
    cacheTags.academicYears,
    cacheTags.collegeSettings,
    cacheTags.publicEvents,
  )

  const [snapshot, courses, events] = await Promise.all([
    getCatalogSnapshot(),
    listCourses(),
    listPublicEvents(),
  ])
  const checks = buildReadiness({
    profileReady: snapshot.profileReady,
    departments: snapshot.departments,
    courses: snapshot.courses,
    subjects: snapshot.subjects,
    hasCurrentYear: Boolean(snapshot.currentYear),
  })

  return {
    departments: snapshot.departments,
    activeCourses: snapshot.courses,
    subjects: snapshot.subjects,
    currentYear: snapshot.currentYear,
    courses,
    events,
    checks,
    readiness: readinessPercent(checks),
  }
}

export async function getAdminOffice(): Promise<AdminOffice> {
  await connection()
  const supabase = await createClient()
  const [snapshot, students, teachers, applied, underReview, approved, rejected, completed, draftEvents, openDrives, pendingApplications, activity] =
    await Promise.all([
      getCatalogSnapshot(),
      supabase.from("students").select("id", { count: "exact", head: true }).is("deleted_at", null),
      supabase.from("teachers").select("id", { count: "exact", head: true }).is("deleted_at", null),
      countAdmissions(supabase, "applied"),
      countAdmissions(supabase, "under_review"),
      countAdmissions(supabase, "approved"),
      countAdmissions(supabase, "rejected"),
      countAdmissions(supabase, "completed"),
      supabase
        .from("events")
        .select("id", { count: "exact", head: true })
        .eq("status", "draft")
        .is("deleted_at", null),
      supabase
        .from("placement_drives")
        .select("id", { count: "exact", head: true })
        .eq("status", "open")
        .is("deleted_at", null),
      supabase
        .from("placement_applications")
        .select("id", { count: "exact", head: true })
        .eq("status", "applied"),
      supabase
        .from("activity_logs")
        .select("id, summary, created_at")
        .order("created_at", { ascending: false })
        .limit(8),
    ])

  if (
    students.error ||
    teachers.error ||
    applied.error ||
    underReview.error ||
    approved.error ||
    rejected.error ||
    completed.error ||
    draftEvents.error ||
    openDrives.error ||
    pendingApplications.error ||
    activity.error ||
    students.count === null ||
    teachers.count === null ||
    applied.count === null ||
    underReview.count === null ||
    approved.count === null ||
    rejected.count === null ||
    completed.count === null ||
    draftEvents.count === null ||
    openDrives.count === null ||
    pendingApplications.count === null ||
    !Array.isArray(activity.data) ||
    !activity.data.every(isActivityRow)
  ) {
    throw new QueryError()
  }

  const pipeline: AdmissionPipeline = {
    applied: applied.count,
    underReview: underReview.count,
    approved: approved.count,
    rejected: rejected.count,
    completed: completed.count,
  }
  const checks = buildReadiness({
    profileReady: snapshot.profileReady,
    departments: snapshot.departments,
    courses: snapshot.courses,
    subjects: snapshot.subjects,
    hasCurrentYear: Boolean(snapshot.currentYear),
  })

  return {
    students: students.count,
    teachers: teachers.count,
    departments: snapshot.departments,
    newAdmissions: pipeline.applied + pipeline.underReview,
    openDrives: openDrives.count,
    pendingApplications: pendingApplications.count,
    activeCourses: snapshot.courses,
    readiness: readinessPercent(checks),
    checks,
    tasks: buildOfficeTasks({
      profileReady: snapshot.profileReady,
      departments: snapshot.departments,
      courses: snapshot.courses,
      subjects: snapshot.subjects,
      hasCurrentYear: Boolean(snapshot.currentYear),
      pipeline,
      draftEvents: draftEvents.count,
      pendingApplications: pendingApplications.count,
    }),
    pipeline,
    recentActivity: activity.data.map((row) => ({
      id: row.id,
      summary: row.summary,
      createdAt: row.created_at,
    })),
  }
}

function countAdmissions(
  supabase: Awaited<ReturnType<typeof createClient>>,
  status: string,
) {
  return supabase
    .from("admissions")
    .select("id", { count: "exact", head: true })
    .eq("status", status)
    .is("deleted_at", null)
}

function isActivityRow(value: unknown): value is {
  id: string
  summary: string
  created_at: string
} {
  if (!isRecord(value)) return false
  return (
    typeof value.id === "string" &&
    typeof value.summary === "string" &&
    typeof value.created_at === "string"
  )
}

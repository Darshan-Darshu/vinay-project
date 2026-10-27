import "server-only"

import { cache } from "react"

import { campusDb, matchesQuery, relatedText, readRows, statusLabel, toneFor } from "@/actions/records/shared"
import type { RecordCard } from "@/actions/records/types"
import { getCurrentProfile } from "@/lib/auth/session"
import { QueryError, isRecord } from "@/lib/db/errors"
import { formatDateTime } from "@/lib/format"

const driveSelect =
  "id, company_name, role_title, description, package_text, location, job_type, eligibility, apply_by, visit_at, venue, status, departments(name), courses(name)"

export const listPlacementDriveCards = cache(async (query: string, facet: string) => {
  const rows = await readDrives()
  return rows
    .filter((row) => facet === "" || row.status === facet)
    .map((row) => toDriveCard(row, null, "office"))
    .filter((card) => matchesQuery(card, query))
})

export const listStudentPlacementCards = cache(async (query: string, facet: string) => {
  const profile = await getCurrentProfile()
  const supabase = await campusDb()
  const applications = profile
    ? await supabase.from("placement_applications").select("drive_id, status")
    : { data: [], error: null }
  if (applications.error || !Array.isArray(applications.data)) throw new QueryError()
  const byDrive = new Map<string, string>()
  for (const row of applications.data) {
    if (isRecord(row) && typeof row.drive_id === "string" && typeof row.status === "string") {
      byDrive.set(row.drive_id, row.status)
    }
  }
  const rows = await readDrives()
  return rows
    .filter((row) => facet === "" || row.status === facet)
    .map((row) => toDriveCard(row, byDrive.get(row.id) ?? null, "student"))
    .filter((card) => matchesQuery(card, query))
})

const readDrives = cache(async () => {
  const supabase = await campusDb()
  const { data, error } = await supabase
    .from("placement_drives")
    .select(driveSelect)
    .is("deleted_at", null)
    .order("apply_by", { ascending: true })
  return readRows(data, error, isDriveRow)
})

function toDriveCard(row: DriveRow, applicationStatus: string | null, audience: "office" | "student"): RecordCard {
  const open = row.status === "open" && new Date(row.apply_by).getTime() >= Date.now()
  const studentState = applicationStatus ?? (row.status === "open" && !open ? "closed" : row.status)
  const badge = audience === "office" ? row.status : studentState
  const who = [relatedText(row.courses, "name"), relatedText(row.departments, "name")].filter(Boolean)
  const eligibility = row.eligibility || (who.length > 0 ? who.join(" · ") : "Every active student")
  return {
    id: row.id,
    title: row.company_name,
    subtitle: [row.role_title, row.package_text, statusLabel(row.job_type)].filter(Boolean).join(" · "),
    detail: row.description || eligibility,
    meta: [
      row.location,
      `Apply by ${formatDateTime(row.apply_by)}`,
      row.visit_at ? `Visit ${formatDateTime(row.visit_at)}` : "",
      row.venue,
      eligibility,
    ]
      .filter(Boolean)
      .join(" · "),
    badge: statusLabel(badge),
    tone: toneFor(badge),
    applyDriveId: audience === "student" && !applicationStatus && open ? row.id : undefined,
  }
}

type DriveRow = {
  id: string
  company_name: string
  role_title: string
  description: string
  package_text: string
  location: string
  job_type: string
  eligibility: string
  apply_by: string
  visit_at: string | null
  venue: string
  status: string
  departments: unknown
  courses: unknown
}

function isDriveRow(value: unknown): value is DriveRow {
  if (!isRecord(value)) return false
  return (
    typeof value.id === "string" &&
    typeof value.company_name === "string" &&
    typeof value.role_title === "string" &&
    typeof value.description === "string" &&
    typeof value.package_text === "string" &&
    typeof value.location === "string" &&
    typeof value.job_type === "string" &&
    typeof value.eligibility === "string" &&
    typeof value.apply_by === "string" &&
    (value.visit_at === null || typeof value.visit_at === "string") &&
    typeof value.venue === "string" &&
    typeof value.status === "string"
  )
}

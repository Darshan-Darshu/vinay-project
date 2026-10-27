import "server-only"

import { cache } from "react"

import {
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

const readEvents = cache(async () => {
  const supabase = await campusDb()
  const { data, error } = await supabase
    .from("events")
    .select("id, title, description, event_type, starts_at, ends_at, venue, status, is_public")
    .is("deleted_at", null)
    .order("starts_at", { ascending: true })

  return readRows(data, error, isEventRow)
})

function eventCards(eventType: string | null) {
  return cache(async (query: string, facet: string) => {
    const rows = await readEvents()
    return rows
      .filter((row) => eventType === null || row.event_type === eventType)
      .filter((row) => facet === "" || row.status === facet)
      .map(toEventCard)
      .filter((card) => matchesQuery(card, query))
  })
}

export const listStudentEventCards = cache(async (query: string, facet: string) => {
  const rows = await readEvents()
  return rows
    .filter((row) => row.event_type !== "placement")
    .filter((row) => facet === "" || row.status === facet)
    .map(toEventCard)
    .filter((card) => matchesQuery(card, query))
})
export const listSportsCards = eventCards("sports")

export const listCampusEventCards = cache(async (query: string, facet: string) => {
  const rows = await readEvents()
  return rows
    .filter((row) => row.event_type !== "sports" && row.event_type !== "placement")
    .filter((row) => facet === "" || row.status === facet)
    .map(toEventCard)
    .filter((card) => matchesQuery(card, query))
})

const readAnnouncements = cache(async () => {
  const supabase = await campusDb()
  const { data, error } = await supabase
    .from("announcements")
    .select("id, title, body, audience, priority, publish_at, status, departments(name)")
    .is("deleted_at", null)
    .order("publish_at", { ascending: false })

  return readRows(data, error, isAnnouncementRow)
})

export const listAnnouncementCards = cache(async (query: string, facet: string) => {
  const rows = await readAnnouncements()
  return rows
    .filter((row) => facet === "" || row.status === facet || row.audience === facet)
    .map(toAnnouncementCard)
    .filter((card) => matchesQuery(card, query))
})

function toEventCard(row: EventRow): RecordCard {
  const when = row.ends_at
    ? `${formatDateTime(row.starts_at)} – ${formatDateTime(row.ends_at)}`
    : formatDateTime(row.starts_at)
  return {
    id: row.id,
    title: row.title,
    subtitle: [statusLabel(row.event_type), row.venue].filter(Boolean).join(" · "),
    detail: row.description,
    meta: [when, row.is_public ? "Public" : "Campus only"].filter(Boolean).join(" · "),
    badge: statusLabel(row.status),
    tone: toneFor(row.status),
  }
}

function toAnnouncementCard(row: AnnouncementRow): RecordCard {
  const department = relatedText(row.departments, "name")
  return {
    id: row.id,
    title: row.title,
    subtitle: [statusLabel(row.audience), department].filter(Boolean).join(" · "),
    detail: row.body,
    meta: [statusLabel(row.priority), formatDateTime(row.publish_at)].join(" · "),
    badge: statusLabel(row.status),
    tone: toneFor(row.priority === "high" ? "high" : row.status),
  }
}

type EventRow = {
  id: string
  title: string
  description: string
  event_type: string
  starts_at: string
  ends_at: string | null
  venue: string
  status: string
  is_public: boolean
}

type AnnouncementRow = {
  id: string
  title: string
  body: string
  audience: string
  priority: string
  publish_at: string
  status: string
  departments: unknown
}

function isEventRow(value: unknown): value is EventRow {
  if (!isRecord(value)) return false
  return (
    typeof value.id === "string" &&
    typeof value.title === "string" &&
    typeof value.description === "string" &&
    typeof value.event_type === "string" &&
    typeof value.starts_at === "string" &&
    (value.ends_at === null || typeof value.ends_at === "string") &&
    typeof value.venue === "string" &&
    typeof value.status === "string" &&
    typeof value.is_public === "boolean"
  )
}

function isAnnouncementRow(value: unknown): value is AnnouncementRow {
  if (!isRecord(value)) return false
  return (
    typeof value.id === "string" &&
    typeof value.title === "string" &&
    typeof value.body === "string" &&
    typeof value.audience === "string" &&
    typeof value.priority === "string" &&
    typeof value.publish_at === "string" &&
    typeof value.status === "string"
  )
}

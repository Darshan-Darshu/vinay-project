import "server-only"

import { searchPassages } from "@/actions/ai/passages"
import { getEmbedding } from "@/lib/ai/embed"
import { capList, capPassages, resolveTitle, titleFilter } from "@/lib/ai/student-read-shape"
import { isRecord, QueryError } from "@/lib/db/errors"
import { createClient } from "@/lib/supabase/server"

export const recordsUnavailable = { error: "unavailable" as const }

type Client = Awaited<ReturnType<typeof createClient>>

export async function searchStudentNotes(query: string) {
  try {
    const passages = await searchPassages(query, "student")
    return { passages }
  } catch (error) {
    console.error(error)
    return recordsUnavailable
  }
}

export async function listStudentMaterials(query?: string) {
  return readList(async (supabase) => {
    const filter = titleFilter(query)
    const request = supabase
      .from("learning_materials")
      .select("id, title, kind, approved_for_rag, subjects(name)", { count: "exact" })
      .is("deleted_at", null)
      .order("title")
      .limit(40)
    const { data, error, count } = filter ? await request.ilike("title", `%${filter}%`) : await request
    if (error) throw new QueryError()
    const rows = (data ?? []).flatMap(materialRow)
    return capList(rows, count ?? rows.length)
  })
}

export async function getStudentMaterial(input: { id?: string; title?: string }) {
  return readChoice(input, async (supabase, choice) => {
    const request = supabase
      .from("learning_materials")
      .select("id, title, kind, approved_for_rag, external_url, subjects(name)")
      .is("deleted_at", null)
      .limit(20)
    const { data, error } = choice.kind === "id"
      ? await request.eq("id", choice.value)
      : await request.ilike("title", `%${choice.value}%`)
    if (error) throw new QueryError()
    return (data ?? []).flatMap(materialDetailRow)
  }, async (supabase, row) => {
    if (row.kind === "link") return { id: row.id, title: row.title, subject: row.subject, kind: "link" as const, url: row.url }
    if (!row.searchable) return { id: row.id, title: row.title, subject: row.subject, kind: row.kind, passagesReady: false as const }
    const embedding = getEmbedding()
    if (!embedding) return recordsUnavailable
    const stored = await supabase
      .from("material_passages")
      .select("ordinal, content", { count: "exact" })
      .eq("material_id", row.id)
      .eq("provider", embedding.provider)
      .order("ordinal")
      .limit(8)
    if (stored.error) throw new QueryError()
    const passages = (stored.data ?? []).flatMap(passageRow)
    return {
      id: row.id,
      title: row.title,
      subject: row.subject,
      kind: "pdf" as const,
      ...capPassages(passages, stored.count ?? passages.length),
    }
  })
}

export async function listStudentEvents(query?: string) {
  return readList(async (supabase) => {
    const filter = titleFilter(query)
    const request = supabase
      .from("events")
      .select("id, title, event_type, starts_at, ends_at, venue, is_public", { count: "exact" })
      .eq("status", "published")
      .is("deleted_at", null)
      .order("starts_at", { ascending: true })
      .limit(40)
    const { data, error, count } = filter ? await request.ilike("title", `%${filter}%`) : await request
    if (error) throw new QueryError()
    const rows = (data ?? []).flatMap(eventRow)
    return capList(rows, count ?? rows.length)
  })
}

export async function getStudentEvent(input: { id?: string; title?: string }) {
  return readChoice(input, async (supabase, choice) => {
    const request = supabase
      .from("events")
      .select("id, title, description, event_type, starts_at, ends_at, venue, is_public")
      .eq("status", "published")
      .is("deleted_at", null)
      .limit(20)
    const { data, error } = choice.kind === "id"
      ? await request.eq("id", choice.value)
      : await request.ilike("title", `%${choice.value}%`)
    if (error) throw new QueryError()
    return (data ?? []).flatMap(eventDetailRow)
  }, async (_supabase, row) => row)
}

export async function listStudentAnnouncements(query?: string) {
  return readList(async (supabase) => {
    const filter = titleFilter(query)
    const request = supabase
      .from("announcements")
      .select("id, title, audience, priority, publish_at, departments(name)", { count: "exact" })
      .eq("status", "published")
      .is("deleted_at", null)
      .order("publish_at", { ascending: false })
      .limit(40)
    const { data, error, count } = filter ? await request.ilike("title", `%${filter}%`) : await request
    if (error) throw new QueryError()
    const rows = (data ?? []).flatMap(announcementRow)
    return capList(rows, count ?? rows.length)
  })
}

export async function getStudentAnnouncement(input: { id?: string; title?: string }) {
  return readChoice(input, async (supabase, choice) => {
    const request = supabase
      .from("announcements")
      .select("id, title, body, audience, priority, publish_at, departments(name)")
      .eq("status", "published")
      .is("deleted_at", null)
      .limit(20)
    const { data, error } = choice.kind === "id"
      ? await request.eq("id", choice.value)
      : await request.ilike("title", `%${choice.value}%`)
    if (error) throw new QueryError()
    return (data ?? []).flatMap(announcementDetailRow)
  }, async (_supabase, row) => row)
}

async function readList<T>(load: (supabase: Client) => Promise<T>) {
  try {
    return await load(await createClient())
  } catch (error) {
    console.error(error)
    return recordsUnavailable
  }
}

async function readChoice<T extends { id: string; title: string }>(
  input: { id?: string; title?: string },
  load: (supabase: Client, choice: { kind: "id" | "title"; value: string }) => Promise<T[]>,
  detail: (supabase: Client, row: T) => Promise<unknown>,
) {
  const id = input.id?.trim() ?? ""
  const title = titleFilter(input.title)
  const choice = id ? { kind: "id" as const, value: id } : title ? { kind: "title" as const, value: title } : null
  if (!choice) return { matches: [] as T[] }
  try {
    const supabase = await createClient()
    const rows = await load(supabase, choice)
    if (choice.kind === "id") {
      const row = rows.find((item) => item.id === id)
      return row ? detail(supabase, row) : { matches: [] as T[] }
    }
    const resolved = resolveTitle(rows, choice.value)
    if (resolved.status === "one") return detail(supabase, resolved.row)
    if (resolved.status === "many") return { matches: resolved.rows, total: resolved.total }
    return { matches: [] as T[] }
  } catch (error) {
    console.error(error)
    return recordsUnavailable
  }
}

function materialRow(value: unknown) {
  const row = materialBase(value)
  return row ? [{ id: row.id, title: row.title, kind: row.kind, subject: row.subject, searchable: row.searchable }] : []
}

function materialDetailRow(value: unknown) {
  const row = materialBase(value)
  if (!row || !isRecord(value)) return []
  return [{ ...row, url: typeof value.external_url === "string" ? value.external_url : "" }]
}

function materialBase(value: unknown) {
  if (!isRecord(value) || typeof value.id !== "string" || typeof value.title !== "string" || typeof value.kind !== "string") return null
  if (typeof value.approved_for_rag !== "boolean") return null
  return {
    id: value.id,
    title: value.title,
    kind: value.kind,
    subject: relatedName(value.subjects),
    searchable: value.kind === "pdf" && value.approved_for_rag,
  }
}

function passageRow(value: unknown) {
  if (!isRecord(value) || typeof value.ordinal !== "number" || typeof value.content !== "string") return []
  return [{ ordinal: value.ordinal, content: value.content }]
}

function eventRow(value: unknown) {
  const row = eventBase(value)
  return row ? [row] : []
}

function eventDetailRow(value: unknown) {
  const row = eventBase(value)
  if (!row || !isRecord(value) || typeof value.description !== "string") return []
  return [{ ...row, description: value.description }]
}

function eventBase(value: unknown) {
  if (!isRecord(value) || typeof value.id !== "string" || typeof value.title !== "string") return null
  if (typeof value.event_type !== "string" || typeof value.starts_at !== "string" || typeof value.venue !== "string") return null
  if (typeof value.is_public !== "boolean") return null
  return {
    id: value.id,
    title: value.title,
    eventType: value.event_type,
    startsAt: value.starts_at,
    endsAt: typeof value.ends_at === "string" ? value.ends_at : null,
    venue: value.venue,
    visibility: value.is_public ? "public" : "campus",
  }
}

function announcementRow(value: unknown) {
  const row = announcementBase(value)
  return row ? [row] : []
}

function announcementDetailRow(value: unknown) {
  const row = announcementBase(value)
  if (!row || !isRecord(value) || typeof value.body !== "string") return []
  return [{ ...row, body: value.body }]
}

function announcementBase(value: unknown) {
  if (!isRecord(value) || typeof value.id !== "string" || typeof value.title !== "string") return null
  if (typeof value.audience !== "string" || typeof value.priority !== "string" || typeof value.publish_at !== "string") return null
  return {
    id: value.id,
    title: value.title,
    audience: value.audience,
    priority: value.priority,
    publishAt: value.publish_at,
    department: relatedName(value.departments),
  }
}

function relatedName(value: unknown) {
  const row = Array.isArray(value) ? value[0] : value
  if (!isRecord(row) || typeof row.name !== "string") return ""
  return row.name
}

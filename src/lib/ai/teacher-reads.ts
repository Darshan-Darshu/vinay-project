import "server-only"

import { isRecord, QueryError } from "@/lib/db/errors"
import { createClient } from "@/lib/supabase/server"
import {
  capList,
  marksFromRows,
  recordsUnavailable,
  resolveFields,
  scoresForRoll,
  studentFromRow,
  subjectFromLink,
  textFilter,
} from "@/lib/ai/teacher-read-shape"

type Client = Awaited<ReturnType<typeof createClient>>

export async function listTeacherSubjects(query?: string) {
  return guard(async (supabase) => {
    const { data, error } = await supabase
      .from("teacher_subjects")
      .select("subjects(id, name, code, credits, semester_number, is_active, courses(name))")
    if (error) throw new QueryError()
    const rows = filterSubjects((data ?? []).flatMap(subjectFromLink), query)
    return capList(rows, rows.length)
  })
}

export async function getTeacherSubject(input: { id?: string; name?: string; code?: string }) {
  return guard(async (supabase) => {
    const { data, error } = await supabase
      .from("teacher_subjects")
      .select("subjects(id, name, code, credits, semester_number, is_active, courses(name))")
    if (error) throw new QueryError()
    const rows = (data ?? []).flatMap(subjectFromLink)
    return choose(rows, input.id, input.name || input.code, (row) => [row.name, row.code])
  })
}

export async function listTeacherStudents(query?: string) {
  return guard(async (supabase) => {
    const { data, error } = await supabase
      .from("students")
      .select("id, roll_number, profiles(full_name)")
      .eq("is_active", true)
      .is("deleted_at", null)
      .order("roll_number")
    if (error) throw new QueryError()
    const rows = filterStudents((data ?? []).flatMap(studentFromRow), query)
    return capList(rows, rows.length)
  })
}

export async function getTeacherStudent(input: { id?: string; name?: string; rollNumber?: string }) {
  return guard(async (supabase) => {
    const { data, error } = await supabase
      .from("students")
      .select("id, roll_number, profiles(full_name)")
      .eq("is_active", true)
      .is("deleted_at", null)
    if (error) throw new QueryError()
    const rows = (data ?? []).flatMap(studentFromRow)
    const chosen = choose(rows, input.id, input.name || input.rollNumber, (row) => [row.name, row.rollNumber])
    if (!("rollNumber" in chosen) || typeof chosen.rollNumber !== "string" || typeof chosen.id !== "string") return chosen
    const [scores, marks] = await Promise.all([
      supabase.rpc("taught_quiz_scores"),
      supabase
        .from("exam_marks")
        .select("exam_name, score, maximum, subjects(code)", { count: "exact" })
        .eq("student_id", chosen.id)
        .order("created_at", { ascending: false })
        .limit(20),
    ])
    if (scores.error || marks.error) throw new QueryError()
    return {
      ...chosen,
      ...scoresForRoll(scores.data, chosen.rollNumber),
      ...marksFromRows(marks.data, marks.count ?? (marks.data ?? []).length),
    }
  })
}

export async function listTeacherAnnouncements(query?: string) {
  return guard(async (supabase) => {
    const filter = textFilter(query)
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

export async function getTeacherAnnouncement(input: { id?: string; title?: string }) {
  return guard(async (supabase) => {
    const request = supabase
      .from("announcements")
      .select("id, title, body, audience, priority, publish_at, departments(name)")
      .eq("status", "published")
      .is("deleted_at", null)
      .limit(20)
    const id = input.id?.trim() ?? ""
    const title = textFilter(input.title)
    if (!id && !title) return { matches: [] as { id: string; title: string }[] }
    const { data, error } = id ? await request.eq("id", id) : await request.ilike("title", `%${title}%`)
    if (error) throw new QueryError()
    const rows = (data ?? []).flatMap(announcementDetailRow)
    if (id) return rows[0] ?? { matches: [] }
    return choose(rows, undefined, title ?? undefined, (row) => [row.title])
  })
}

function filterSubjects(rows: { name: string; code: string }[], query?: string) {
  const needle = textFilter(query)?.toLowerCase()
  if (!needle) return rows
  return rows.filter((row) => row.name.toLowerCase().includes(needle) || row.code.toLowerCase().includes(needle))
}

function filterStudents(rows: { name: string; rollNumber: string }[], query?: string) {
  const needle = textFilter(query)?.toLowerCase()
  if (!needle) return rows
  return rows.filter((row) => row.name.toLowerCase().includes(needle) || row.rollNumber.toLowerCase().includes(needle))
}

function choose<T extends { id: string }>(
  rows: T[],
  id: string | undefined,
  query: string | undefined,
  fields: (row: T) => string[],
) {
  const target = id?.trim() ?? ""
  if (target) {
    const row = rows.find((item) => item.id === target)
    return row ?? { matches: [] as T[] }
  }
  const text = textFilter(query)
  if (!text) return { matches: [] as T[] }
  const resolved = resolveFields(rows, text, fields)
  if (resolved.status === "one") return resolved.row
  if (resolved.status === "many") return { matches: resolved.rows, total: resolved.total }
  return { matches: [] as T[] }
}

async function guard<T>(load: (supabase: Client) => Promise<T>) {
  try {
    return await load(await createClient())
  } catch (error) {
    console.error(error)
    return recordsUnavailable
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
  const department = Array.isArray(value.departments) ? value.departments[0] : value.departments
  return {
    id: value.id,
    title: value.title,
    audience: value.audience,
    priority: value.priority,
    publishAt: value.publish_at,
    department: isRecord(department) && typeof department.name === "string" ? department.name : "",
  }
}

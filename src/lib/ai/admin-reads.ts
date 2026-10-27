import "server-only"

import { getCurrentProfile } from "@/lib/auth/session"
import { createClient } from "@/lib/supabase/server"
import type { ProposalLookup } from "@/lib/ai/admin-harness"

const pageSize = 20
const denied = "You do not have permission to access this resource."
const unreadable = "The records could not be read."
const missing = "That record could not be found."

type Builder = {
  select: (columns: string, options?: { count: "exact" }) => Builder
  is: (column: string, value: null) => Builder
  eq: (column: string, value: string | number | boolean) => Builder
  ilike: (column: string, value: string) => Builder
  or: (filters: string) => Builder
  order: (column: string, options?: { ascending: boolean }) => Builder
  limit: (count: number) => Promise<{ data: Row[] | null; error: { message: string } | null; count: number | null }>
  maybeSingle: () => Promise<{ data: Row | null; error: { message: string } | null }>
}

function tables(client: Client) {
  return client as unknown as { from: (table: string) => Builder }
}

type Client = Awaited<ReturnType<typeof createClient>>
type Row = Record<string, unknown>

export async function loadProposalLookup(): Promise<ProposalLookup | null> {
  const client = await adminClient()
  if (!client) return null
  return {
    find: (kind, query) => findRow(client, kind, query),
  }
}

export async function adminList(kind: string, filter: { query?: string; departmentCode?: string; courseCode?: string; status?: string }) {
  const client = await adminClient()
  if (!client) return denied
  const term = exact(filter.query ?? "")
  const listed = await listKind(client, kind, term, filter)
  if (!listed) return unreadable
  return JSON.stringify({ total: listed.total, rows: listed.rows.map(present) })
}

export async function adminRead(kind: string, filter: Record<string, string | undefined>) {
  const client = await adminClient()
  if (!client) return denied
  const query: Record<string, string> = {}
  const aliases: Record<string, string> = { rollNumber: "roll", companyName: "company", roleTitle: "role" }
  for (const [key, value] of Object.entries(filter)) {
    if (value) query[aliases[key] ?? key] = value
  }
  const found = await findRow(client, kind, query)
  if (found === "many") return "More than one record matches. Ask for a narrower name."
  if (!found) return missing
  return JSON.stringify(present(found))
}

async function adminClient() {
  const profile = await getCurrentProfile()
  if (!profile?.isActive || profile.role !== "admin") return null
  return createClient()
}

async function listKind(client: Client, kind: string, term: string, filter: { departmentCode?: string; status?: string; courseCode?: string }) {
  if (kind === "departments") return page(client, "departments", "id, name, code, description, is_active", "name", (query) => likeAny(query, term, ["name", "code"]))
  if (kind === "courses") {
    const departmentId = filter.departmentCode ? await idFor(client, "departments", "code", filter.departmentCode) : null
    return page(client, "courses", "id, name, code, duration_semesters, description, is_active, department_id, departments(code)", "name", (query) => {
      const next = likeAny(query, term, ["name", "code"])
      return departmentId ? next.eq("department_id", departmentId) : next
    })
  }
  if (kind === "subjects") {
    const courseId = filter.courseCode ? await idFor(client, "courses", "code", filter.courseCode) : null
    return page(client, "subjects", "id, name, code, credits, semester_number, is_active, course_id, courses(code), departments(code)", "name", (query) => {
      const next = likeAny(query, term, ["name", "code"])
      return courseId ? next.eq("course_id", courseId) : next
    })
  }
  if (kind === "students") return page(client, "students", "id, roll_number, is_active, department_id, course_id, semester_id, profiles(full_name, email), departments(code), courses(code)", "roll_number", (query) => (term ? query.ilike("roll_number", `%${term}%`) : query))
  if (kind === "teachers") return page(client, "teachers", "id, employee_code, designation, is_active, department_id, profiles(full_name, email), departments(code)", "employee_code", (query) => (term ? query.ilike("employee_code", `%${term}%`) : query))
  if (kind === "admissions") return page(client, "admissions", "id, full_name, email, phone, status, notes, departments(code), courses(code)", "created_at", (query) => likeAny(query, term, ["full_name", "email"]))
  if (kind === "announcements") return page(client, "announcements", "id, title, body, audience, priority, status, publish_at, expires_at, departments(code)", "publish_at", (query) => (term ? query.ilike("title", `%${term}%`) : query))
  if (kind === "events") return page(client, "events", "id, title, description, event_type, starts_at, ends_at, venue, status, is_public", "starts_at", (query) => (term ? query.ilike("title", `%${term}%`) : query))
  if (kind === "placements") return page(client, "placement_drives", "id, company_name, role_title, description, package_text, location, job_type, eligibility, required_skills, status, apply_by, visit_at, venue, departments(code), courses(code)", "apply_by", (query) => likeAny(query, term, ["company_name", "role_title"]))
  if (kind === "applications") {
    return page(client, "placement_applications", "id, status, students(roll_number), placement_drives(company_name, role_title)", "applied_at", (query) => (filter.status ? query.eq("status", filter.status) : query), false)
  }
  return null
}

async function page(
  client: Client,
  table: string,
  select: string,
  order: string,
  apply: (query: Builder) => Builder,
  deleted = true,
) {
  let query = tables(client).from(table).select(select, { count: "exact" })
  if (deleted) query = query.is("deleted_at", null)
  const { data, error, count } = await apply(query).order(order, { ascending: true }).limit(pageSize)
  if (error) return null
  const rows = (data ?? []).map(camel)
  return { total: count ?? rows.length, rows }
}

async function findRow(client: Client, kind: string, query: Record<string, string>): Promise<Record<string, unknown> | null | "many"> {
  if (kind === "subjects") return subjectIds(client, query.codes ?? "")
  if (kind === "semester") return semester(client, query)
  if (kind === "teacherEmail") return emailOwner(client, query.email ?? "")
  if (kind === "application") return application(client, query)
  const table = tableFor(kind)
  if (!table) return null
  const rows = await rowsFor(client, table, kind, query)
  if (!rows) return null
  if (rows === "many") return "many"
  return camel(rows)
}

function tableFor(kind: string) {
  if (kind === "department" || kind === "departments") return "departments"
  if (kind === "course" || kind === "courses") return "courses"
  if (kind === "subject" || kind === "subjects") return "subjects"
  if (kind === "student" || kind === "students") return "students"
  if (kind === "teacher" || kind === "teachers") return "teachers"
  if (kind === "admission" || kind === "admissions") return "admissions"
  if (kind === "announcement" || kind === "announcements") return "announcements"
  if (kind === "event" || kind === "events") return "events"
  if (kind === "drive" || kind === "placements") return "placement_drives"
  return null
}

async function rowsFor(client: Client, table: string, kind: string, query: Record<string, string>) {
  let request = tables(client).from(table).select(selectFor(kind)).is("deleted_at", null)
  if (query.id) request = request.eq("id", query.id)
  else if (query.code && (kind === "department" || kind === "course")) request = request.ilike("code", exact(query.code))
  else if (kind === "subject" && query.courseId && query.code) request = request.eq("course_id", query.courseId).ilike("code", exact(query.code))
  else if (kind === "student" && query.roll) request = request.ilike("roll_number", exact(query.roll))
  else if (kind === "teacher" && query.employeeCode) request = request.ilike("employee_code", exact(query.employeeCode))
  else if (kind === "admission" && query.email) request = request.ilike("email", exact(query.email))
  else if ((kind === "announcement" || kind === "event") && query.title) request = request.ilike("title", exact(query.title))
  else if (kind === "drive" && query.company) {
    request = request.ilike("company_name", exact(query.company))
    if (query.role) request = request.ilike("role_title", exact(query.role))
  } else return null
  const { data, error } = await request.limit(2)
  if (error || !data || data.length === 0) return null
  if (data.length > 1) return "many" as const
  const row = data[0]
  if (!row) return null
  if (kind === "teacher") {
    const subjects = await client.from("teacher_subjects").select("subject_id").eq("teacher_id", String(row.id))
    return { ...row, subject_ids: (subjects.data ?? []).map((item) => item.subject_id) }
  }
  return row
}

function selectFor(kind: string) {
  if (kind === "department") return "id, name, code, description, is_active"
  if (kind === "course") return "id, department_id, name, code, duration_semesters, description, is_active"
  if (kind === "subject") return "id, department_id, course_id, semester_number, name, code, credits, is_active"
  if (kind === "student") return "id, roll_number, department_id, course_id, semester_id, is_active"
  if (kind === "teacher") return "id, department_id, employee_code, designation, is_active, profiles(full_name, phone)"
  if (kind === "admission") return "id, full_name, email, phone, department_id, course_id, semester_id, notes, status, departments(code), courses(code), semesters(number)"
  if (kind === "announcement") return "id, title, body, audience, department_id, priority, publish_at, expires_at, status"
  if (kind === "event") return "id, title, description, event_type, starts_at, ends_at, venue, status, is_public"
  return "id, company_name, role_title, description, package_text, location, job_type, eligibility, required_skills, department_id, course_id, apply_by, visit_at, venue, status"
}

async function subjectIds(client: Client, codes: string) {
  const list = codes.split(",").map(exact).filter(Boolean)
  if (list.length === 0) return { ids: [] }
  const ids: string[] = []
  for (const code of list) {
    const { data, error } = await client.from("subjects").select("id").ilike("code", code).is("deleted_at", null).limit(2)
    if (error || !data || data.length !== 1) return null
    const id = data[0]?.id
    if (typeof id !== "string") return null
    ids.push(id)
  }
  return { ids }
}

async function semester(client: Client, query: Record<string, string>) {
  if (!query.courseId || !query.number) return null
  const { data, error } = await client
    .from("semesters")
    .select("id")
    .eq("course_id", query.courseId)
    .eq("number", Number(query.number))
    .eq("is_active", true)
    .is("deleted_at", null)
    .limit(2)
  if (error || !data || data.length === 0) return null
  if (data.length > 1) return "many" as const
  return data[0] ? camel(data[0]) : null
}

async function emailOwner(client: Client, email: string) {
  const cleaned = exact(email)
  if (!cleaned) return null
  const { data, error } = await client.from("profiles").select("id").ilike("email", cleaned).limit(1)
  if (error || !data || data.length === 0) return null
  return data[0] ? camel(data[0]) : null
}

async function application(client: Client, query: Record<string, string>) {
  let request = tables(client).from("placement_applications").select("id, status, students!inner(roll_number), placement_drives!inner(company_name, role_title)")
  if (query.id) request = request.eq("id", query.id)
  else if (query.roll || query.company) {
    if (query.roll) request = request.eq("students.roll_number", exact(query.roll))
    if (query.company) request = request.ilike("placement_drives.company_name", exact(query.company))
    if (query.role) request = request.ilike("placement_drives.role_title", exact(query.role))
  } else return null
  const { data, error } = await request.limit(2)
  if (error || !data || data.length === 0) return null
  if (data.length > 1) return "many" as const
  return data[0] ? camel(data[0]) : null
}

async function idFor(client: Client, table: string, column: string, value: string) {
  const { data } = await tables(client).from(table).select("id").ilike(column, exact(value)).is("deleted_at", null).limit(1)
  const id = data?.[0]?.id
  return typeof id === "string" ? id : null
}

function likeAny(query: Builder, term: string, columns: string[]) {
  if (!term) return query
  return query.or(columns.map((column) => `${column}.ilike.%${term}%`).join(","))
}

function exact(value: string) {
  return value.replace(/[%_\\,]/g, "").trim()
}

function camel(row: Row) {
  const next: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(row)) {
    if (key === "profiles" || key === "students" || key === "placement_drives" || key === "departments" || key === "courses" || key === "semesters") {
      const related = relatedRow(value)
      if (key === "profiles") {
        next.fullName = typeof related.full_name === "string" ? related.full_name : ""
        next.phone = typeof related.phone === "string" ? related.phone : ""
        next.email = typeof related.email === "string" ? related.email : next.email
      } else if (key === "students") {
        next.rollNumber = typeof related.roll_number === "string" ? related.roll_number : ""
      } else if (key === "placement_drives") {
        next.companyName = typeof related.company_name === "string" ? related.company_name : ""
        next.roleTitle = typeof related.role_title === "string" ? related.role_title : ""
      } else if (key === "departments") {
        next.departmentCode = typeof related.code === "string" ? related.code : ""
      } else if (key === "courses") {
        next.courseCode = typeof related.code === "string" ? related.code : ""
      } else if (key === "semesters") {
        next.semesterNumber = typeof related.number === "number" || typeof related.number === "string" ? String(related.number) : ""
      }
      continue
    }
    next[key.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase())] = value
  }
  if (Array.isArray(row.subject_ids)) next.subjectIds = row.subject_ids
  return next
}

function relatedRow(value: unknown) {
  const row = Array.isArray(value) ? value[0] : value
  return row && typeof row === "object" ? (row as Row) : {}
}

function present(row: Record<string, unknown>) {
  const next: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(row)) {
    if (key === "password") continue
    next[key] = typeof value === "string" && value.length > 400 ? `${value.slice(0, 400)}…` : value
  }
  return next
}

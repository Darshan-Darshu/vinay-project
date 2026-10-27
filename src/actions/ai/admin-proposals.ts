"use server"

import { z } from "zod"

import { saveAnnouncement, saveEvent } from "@/actions/admin/records/save-campus"
import { saveCourse, saveDepartment, saveSubject } from "@/actions/admin/records/save-catalog"
import { enrollAdmission, saveAdmission, saveStudent, saveTeacher, setAdmissionStatus } from "@/actions/admin/records/save-people"
import { savePlacementDrive, setPlacementApplicationStatus } from "@/actions/admin/records/save-placements"
import type { FormState } from "@/actions/form-state"
import { getCurrentProfile } from "@/lib/auth/session"
import {
  claimDecision,
  commitProposal,
  isAdminAction,
  prepareProposal,
  proposalExpiry,
  runConfirmedProposal,
  applyAdmissionEdits,
  specialistFor,
  withoutSecrets,
  type AdminAction,
  type AdminProposalCard,
  type AdminSpecialist,
} from "@/lib/ai/admin-harness"
import { loadProposalLookup } from "@/lib/ai/admin-reads"
import { publicProposalFields } from "@/lib/ai/chat-widgets"
import { createClient } from "@/lib/supabase/server"

const denied = "You do not have permission to access this resource."
const unavailable = "That change is no longer available."
const empty: FormState = { error: null, success: null }

const savers: Record<AdminAction, (previous: FormState, formData: FormData) => Promise<FormState>> = {
  "department.create": saveDepartment,
  "department.update": saveDepartment,
  "course.create": saveCourse,
  "course.update": saveCourse,
  "subject.create": saveSubject,
  "subject.update": saveSubject,
  "student.update": saveStudent,
  "teacher.create": saveTeacher,
  "teacher.update": saveTeacher,
  "admission.create": saveAdmission,
  "admission.update": saveAdmission,
  "admission.status": setAdmissionStatus,
  "admission.enroll": enrollAdmission,
  "announcement.create": saveAnnouncement,
  "announcement.update": saveAnnouncement,
  "event.create": saveEvent,
  "event.update": saveEvent,
  "placement.create": savePlacementDrive,
  "placement.update": savePlacementDrive,
  "placement.application": setPlacementApplicationStatus,
}

export async function stageAdminProposal(input: {
  sessionId: string | null
  specialist: string
  action: string
  fields: Record<string, unknown>
}): Promise<{ error: string } | AdminProposalCard> {
  if (!isAdminAction(input.action) || !isSpecialist(input.specialist) || specialistFor(input.action) !== input.specialist) {
    return { error: "That record cannot be changed from this office." }
  }
  const lookup = await loadProposalLookup()
  const profile = await adminProfile()
  if (!lookup || !profile) return { error: denied }
  const prepared = await prepareProposal(input.action, input.fields, lookup)
  const supabase = await createClient()
  const committed = await commitProposal(prepared, async (row) => {
    const inserted = await supabase
      .from("admin_chat_proposals")
      .insert({
        profile_id: profile.id,
        session_id: uuidOrNull(input.sessionId),
        specialist: input.specialist,
        action: row.action,
        payload: row.payload,
        summary: row.summary,
        expires_at: proposalExpiry(new Date()),
      })
      .select("id")
      .maybeSingle()
    return typeof inserted.data?.id === "string" ? inserted.data.id : null
  })
  if (!committed.inserted) return { error: committed.error }
  return {
    id: committed.id,
    specialist: input.specialist,
    summary: committed.summary,
    action: committed.action,
    fields: publicProposalFields(committed.payload),
  }
}

export async function confirmAdminProposal(id: string, edits?: Record<string, string>) {
  const claimed = await claimProposal(id)
  if ("error" in claimed) return { error: claimed.error, verified: null as string | null, fieldErrors: null as Record<string, string> | null }
  const payload = asPayload(claimed.row.payload)
  if (!payload) {
    await claimed.release()
    return { error: unavailable, verified: null, fieldErrors: null }
  }
  const applied = applyAdmissionEdits(claimed.row.action, payload, edits)
  if (!applied.ok) {
    await claimed.release()
    return { error: applied.error, verified: null, fieldErrors: applied.fieldErrors }
  }
  const result = await runConfirmedProposal({ action: claimed.row.action, payload: applied.payload }, {
    save: async (action, fields) => {
      if (!isAdminAction(action)) return { error: unavailable }
      const saved = await savers[action](empty, toForm(fields))
      return { error: saved.error }
    },
    readBack: (action, fields) => readBack(claimed.supabase, action, fields),
    release: claimed.release,
    strip: async () => {
      await claimed.supabase
        .from("admin_chat_proposals")
        .update({ payload: withoutSecrets(applied.payload) })
        .eq("id", claimed.row.id)
        .eq("profile_id", claimed.profileId)
    },
  })
  if (!result.error && result.verified) await settleChatWidget(claimed.supabase, id, result.verified)
  return { ...result, fieldErrors: null }
}

export async function cancelAdminProposal(id: string) {
  const claimed = await claimProposal(id)
  if ("error" in claimed) return { error: claimed.error }
  const payload = asPayload(claimed.row.payload)
  if (payload) {
    await claimed.supabase
      .from("admin_chat_proposals")
      .update({ payload: withoutSecrets(payload) })
      .eq("id", claimed.row.id)
      .eq("profile_id", claimed.profileId)
  }
  await settleChatWidget(claimed.supabase, id, "Cancelled. Nothing was saved.")
  return { error: null }
}

export async function listOpenAdminProposals(): Promise<AdminProposalCard[]> {
  const profile = await adminProfile()
  if (!profile) return []
  const supabase = await createClient()
  const listed = await supabase
    .from("admin_chat_proposals")
    .select("id, specialist, summary, action, payload")
    .eq("profile_id", profile.id)
    .is("consumed_at", null)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: true })
  if (listed.error) return []
  return (listed.data ?? []).flatMap((row) => {
    if (typeof row.id !== "string" || typeof row.specialist !== "string" || typeof row.summary !== "string") return []
    const payload = asPayload(row.payload)
    return [{
      id: row.id,
      specialist: row.specialist,
      summary: row.summary,
      action: typeof row.action === "string" ? row.action : undefined,
      fields: payload ? publicProposalFields(payload) : {},
    }]
  })
}

export async function attachAdminProposals(ids: string[], sessionId: string) {
  const profile = await adminProfile()
  const session = uuidOrNull(sessionId)
  if (!profile || !session || ids.length === 0) return
  const supabase = await createClient()
  await supabase
    .from("admin_chat_proposals")
    .update({ session_id: session })
    .in("id", ids.filter((id) => z.uuid().safeParse(id).success))
    .eq("profile_id", profile.id)
}

async function claimProposal(id: string) {
  const profile = await adminProfile()
  if (!profile || !z.uuid().safeParse(id).success) return { error: denied }
  const supabase = await createClient()
  const loaded = await supabase.from("admin_chat_proposals").select("id, profile_id, action, payload, expires_at, consumed_at").eq("id", id).maybeSingle()
  const decision = claimDecision(claimRow(loaded.data), profile.id, new Date())
  if (decision !== "ok") return { error: unavailable }
  const claimed = await supabase
    .from("admin_chat_proposals")
    .update({ consumed_at: new Date().toISOString() })
    .eq("id", id)
    .eq("profile_id", profile.id)
    .is("consumed_at", null)
    .gt("expires_at", new Date().toISOString())
    .select("id, action, payload")
    .maybeSingle()
  if (!claimed.data || typeof claimed.data.id !== "string" || typeof claimed.data.action !== "string") return { error: unavailable }
  return {
    supabase,
    profileId: profile.id,
    row: claimed.data,
    release: async () => {
      await supabase.from("admin_chat_proposals").update({ consumed_at: null }).eq("id", id).eq("profile_id", profile.id)
    },
  }
}

async function adminProfile() {
  const profile = await getCurrentProfile()
  if (!profile?.isActive || profile.role !== "admin") return null
  return profile
}

async function readBack(
  supabase: Awaited<ReturnType<typeof createClient>>,
  action: string,
  payload: Record<string, string | string[]>,
) {
  if (action === "teacher.create") {
    const email = stringValue(payload.email)
    const person = await supabase.from("profiles").select("id, full_name").ilike("email", email).maybeSingle()
    if (!person.data?.id) return null
    const teacher = await supabase.from("teachers").select("id").eq("profile_id", person.data.id).is("deleted_at", null).maybeSingle()
    return teacher.data ? `Teacher ${person.data.full_name} is saved.` : null
  }
  if (action === "admission.enroll") {
    const roll = stringValue(payload.rollNumber)
    const student = await supabase.from("students").select("roll_number").eq("roll_number", roll).is("deleted_at", null).maybeSingle()
    return student.data ? `Student ${student.data.roll_number} is enrolled.` : null
  }
  const target = readTarget(action, payload)
  if (!target) return null
  const query = looseFrom(supabase).from(target.table).select(target.select).eq(target.column, target.value)
  const filtered = target.courseId ? query.eq("course_id", target.courseId) : query
  const { data } = await (target.deleted ? filtered.is("deleted_at", null) : filtered).maybeSingle()
  if (!data) return null
  return target.label(data)
}

function looseFrom(supabase: Awaited<ReturnType<typeof createClient>>) {
  type AnyQuery = {
    eq: (column: string, value: string) => AnyQuery
    is: (column: string, value: null) => AnyQuery
    maybeSingle: () => Promise<{ data: Record<string, unknown> | null }>
  }
  return supabase as unknown as { from: (table: string) => { select: (columns: string) => AnyQuery } }
}

function readTarget(action: string, payload: Record<string, string | string[]>) {
  const id = stringValue(payload.id)
  if (action.startsWith("department.")) {
    return rowTarget("departments", id ? "id" : "code", id || stringValue(payload.code), "name, code, is_active", (row) => `Department ${text(row, "name")} (${text(row, "code")}) is ${text(row, "is_active") === "true" || row.is_active === true ? "active" : "inactive"}.`)
  }
  if (action.startsWith("course.")) {
    return rowTarget("courses", id ? "id" : "code", id || stringValue(payload.code), "name, code, is_active", (row) => `Course ${text(row, "name")} (${text(row, "code")}) is ${row.is_active === true ? "active" : "inactive"}.`)
  }
  if (action.startsWith("subject.")) {
    if (id) return rowTarget("subjects", "id", id, "name, code, is_active", (row) => `Subject ${text(row, "name")} (${text(row, "code")}) is ${row.is_active === true ? "active" : "inactive"}.`)
    return {
      table: "subjects",
      column: "code",
      value: stringValue(payload.code),
      select: "name, code, is_active, course_id",
      deleted: true,
      label: (row: Record<string, unknown>) => `Subject ${text(row, "name")} (${text(row, "code")}) is ${row.is_active === true ? "active" : "inactive"}.`,
      courseId: stringValue(payload.courseId),
    }
  }
  if (action === "student.update" || action === "teacher.update") {
    const table = action === "student.update" ? "students" : "teachers"
    return rowTarget(table, "id", id, "id, is_active", (row) => `${table === "students" ? "Student" : "Teacher"} ${text(row, "id")} is ${row.is_active === true ? "active" : "inactive"}.`)
  }
  if (action.startsWith("admission.")) {
    return rowTarget("admissions", id ? "id" : "email", id || stringValue(payload.email), "full_name, email, status", (row) => `Application for ${text(row, "full_name")} is ${text(row, "status")}.`)
  }
  if (action.startsWith("announcement.")) {
    return rowTarget("announcements", id ? "id" : "title", id || stringValue(payload.title), "title, status", (row) => `Announcement "${text(row, "title")}" is ${text(row, "status")}.`)
  }
  if (action.startsWith("event.")) {
    return rowTarget("events", id ? "id" : "title", id || stringValue(payload.title), "title, status", (row) => `Event "${text(row, "title")}" is ${text(row, "status")}.`)
  }
  if (action.startsWith("placement.") && action !== "placement.application") {
    return rowTarget("placement_drives", id ? "id" : "company_name", id || stringValue(payload.companyName), "company_name, role_title, status", (row) => `Placement ${text(row, "company_name")} for ${text(row, "role_title")} is ${text(row, "status")}.`)
  }
  if (action === "placement.application") {
    return rowTarget("placement_applications", "id", id, "id, status", (row) => `Application ${text(row, "id")} is ${text(row, "status")}.`, false)
  }
  return null
}

function rowTarget(
  table: string,
  column: string,
  value: string,
  select: string,
  label: (row: Record<string, unknown>) => string,
  deleted = true,
) {
  if (!value) return null
  return { table, column, value, select, label, deleted, courseId: "" }
}

function toForm(fields: Record<string, string | string[]>) {
  const form = new FormData()
  for (const [key, value] of Object.entries(fields)) {
    if (Array.isArray(value)) {
      for (const item of value) form.append(key, item)
    } else if (value.length > 0) {
      form.set(key, value)
    }
  }
  return form
}

function asPayload(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  const payload: Record<string, string | string[]> = {}
  for (const [key, item] of Object.entries(value)) {
    if (typeof item === "string") payload[key] = item
    else if (Array.isArray(item) && item.every((part) => typeof part === "string")) payload[key] = item
    else return null
  }
  return payload
}

function claimRow(value: unknown) {
  if (!value || typeof value !== "object") return null
  const row = value as Record<string, unknown>
  if (typeof row.profile_id !== "string" || typeof row.expires_at !== "string") return null
  return {
    profileId: row.profile_id,
    expiresAt: row.expires_at,
    consumedAt: typeof row.consumed_at === "string" ? row.consumed_at : null,
  }
}

function stringValue(value: string | string[] | undefined) {
  return typeof value === "string" ? value : ""
}

function text(row: Record<string, unknown>, key: string) {
  const value = row[key]
  return typeof value === "string" ? value : ""
}

async function settleChatWidget(
  supabase: Awaited<ReturnType<typeof createClient>>,
  proposalId: string,
  result: string,
) {
  const settled = await supabase.rpc("settle_chat_widget", { target_proposal: proposalId, result_text: result })
  if (settled.error) console.error(settled.error)
}

function uuidOrNull(value: string | null) {
  if (!value || !z.uuid().safeParse(value).success) return null
  return value
}

function isSpecialist(value: string): value is AdminSpecialist {
  return (["admissions", "students", "teachers", "departments", "courses", "subjects", "announcements", "events", "placements"] as const).includes(value as AdminSpecialist)
}

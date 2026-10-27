import { z } from "zod"

import type { ChatWidget } from "@/lib/ai/chat-widgets"

import {
  admissionSchema,
  admissionStatusSchema,
  announcementSchema,
  courseSchema,
  departmentSchema,
  enrollSchema,
  eventSchema,
  placementApplicationStatusSchema,
  placementDriveSchema,
  studentUpdateSchema,
  subjectSchema,
  teacherCreateSchema,
  teacherUpdateSchema,
} from "@/lib/validations/records"

export const adminSpecialists = [
  "admissions",
  "students",
  "teachers",
  "departments",
  "courses",
  "subjects",
  "announcements",
  "events",
  "placements",
] as const

export type AdminSpecialist = (typeof adminSpecialists)[number]

export const adminActions = [
  "department.create",
  "department.update",
  "course.create",
  "course.update",
  "subject.create",
  "subject.update",
  "student.update",
  "teacher.create",
  "teacher.update",
  "admission.create",
  "admission.update",
  "admission.status",
  "admission.enroll",
  "announcement.create",
  "announcement.update",
  "event.create",
  "event.update",
  "placement.create",
  "placement.update",
  "placement.application",
] as const

export type AdminAction = (typeof adminActions)[number]

export function isAdminAction(value: string): value is AdminAction {
  return (adminActions as readonly string[]).includes(value)
}

const actionSpecialists = {
  "department.create": "departments",
  "department.update": "departments",
  "course.create": "courses",
  "course.update": "courses",
  "subject.create": "subjects",
  "subject.update": "subjects",
  "student.update": "students",
  "teacher.create": "teachers",
  "teacher.update": "teachers",
  "admission.create": "admissions",
  "admission.update": "admissions",
  "admission.status": "admissions",
  "admission.enroll": "admissions",
  "announcement.create": "announcements",
  "announcement.update": "announcements",
  "event.create": "events",
  "event.update": "events",
  "placement.create": "placements",
  "placement.update": "placements",
  "placement.application": "placements",
} as const satisfies Record<AdminAction, AdminSpecialist>

export function specialistFor(action: AdminAction) {
  return actionSpecialists[action]
}

export const parentSpecialistTools = [
  "ask_admissions",
  "ask_students",
  "ask_teachers",
  "ask_departments",
  "ask_courses",
  "ask_subjects",
  "ask_announcements",
  "ask_events",
  "ask_placements",
] as const

export const specialistToolNames = {
  admissions: ["list_admissions", "read_admission", "propose_admission", "propose_admission_status", "propose_enrollment"],
  students: ["list_students", "read_student", "propose_student"],
  teachers: ["list_teachers", "read_teacher", "propose_teacher"],
  departments: ["list_departments", "read_department", "propose_department"],
  courses: ["list_courses", "read_course", "propose_course"],
  subjects: ["list_subjects", "read_subject", "propose_subject"],
  announcements: ["list_announcements", "read_announcement", "propose_announcement"],
  events: ["list_events", "read_event", "propose_event"],
  placements: ["list_placements", "read_placement", "list_applications", "propose_placement", "propose_application_status"],
} as const

export const actionSavers = {
  "department.create": "saveDepartment",
  "department.update": "saveDepartment",
  "course.create": "saveCourse",
  "course.update": "saveCourse",
  "subject.create": "saveSubject",
  "subject.update": "saveSubject",
  "student.update": "saveStudent",
  "teacher.create": "saveTeacher",
  "teacher.update": "saveTeacher",
  "admission.create": "saveAdmission",
  "admission.update": "saveAdmission",
  "admission.status": "setAdmissionStatus",
  "admission.enroll": "enrollAdmission",
  "announcement.create": "saveAnnouncement",
  "announcement.update": "saveAnnouncement",
  "event.create": "saveEvent",
  "event.update": "saveEvent",
  "placement.create": "savePlacementDrive",
  "placement.update": "savePlacementDrive",
  "placement.application": "setPlacementApplicationStatus",
} as const satisfies Record<AdminAction, string>

export const parentStepLimit = 6
export const specialistStepLimit = 5
export const maxSpecialistCalls = 4
export const maxSpecialistTools = 5
export const proposalTtlMs = 15 * 60 * 1000

export type AdminProposalCard = {
  id: string
  specialist: string
  summary: string
  action?: string
  fields?: Record<string, string>
}

export type ProposalLookup = {
  find(kind: string, query: Record<string, string>): Promise<Record<string, unknown> | null | "many">
}

export type PreparedProposal =
  | { ok: false; error: string }
  | { ok: true; action: AdminAction; payload: Record<string, string | string[]>; summary: string }

const many = "More than one record matches. Ask for a narrower name."
const missing = "That record could not be found."

export function isReadOrPropose(name: string) {
  return name.startsWith("list_") || name.startsWith("read_") || name.startsWith("propose_")
}

export function takeSpecialistSlot(used: number) {
  if (used >= maxSpecialistCalls) return { allowed: false, next: used }
  return { allowed: true, next: used + 1 }
}

export function takeToolSlot(used: number) {
  if (used >= maxSpecialistTools) return { allowed: false, next: used }
  return { allowed: true, next: used + 1 }
}

export function specialistMissedTools(toolCalls: number) {
  return toolCalls < 1
}

const admissionMoves: Record<string, readonly string[]> = {
  applied: ["under_review"],
  under_review: ["approved", "rejected"],
  approved: ["rejected"],
  rejected: ["under_review"],
  completed: [],
}

const admissionStatusPhrases: [RegExp, string][] = [
  [/\bunder[\s_-]?review\b/i, "under_review"],
  [/\bapprove[d]?\b/i, "approved"],
  [/\breject(?:ed)?\b/i, "rejected"],
  [/\bcompleted\b/i, "completed"],
  [/\bapplied\b/i, "applied"],
]

const nameSkip = new Set(["the", "a", "an", "and", "or", "for", "of", "to", "as", "his", "her", "him", "their", "them", "this", "that", "admission", "admissions", "status", "application", "applicant", "student", "record", "please", "would", "like", "change", "update", "set", "program", "degree", "department", "course", "code", "create", "add", "new"])

const createGuides: Record<string, string> = {
  admission: "To create an admission, send one message with the full name, email, phone, department code, and course code. Example: Create admission for Meera Shah, meera@example.com, +91 98450 22001, department ECE, course BT-ECE. A confirm card appears before anything is saved.",
  student: "A student login is created by enrolling an approved admission. Send the applicant email, roll number, and a password. A confirm card appears before the account is created.",
  teacher: "To create a teacher, send the full name, email, phone, password, department code, and employee code. A confirm card appears before anything is saved.",
  department: "To create a department, send the name and code. Example: Create department Electronics, code ECE. A confirm card appears before anything is saved.",
  course: "To create a course, send the name, code, department code, and duration in semesters. A confirm card appears before anything is saved.",
  subject: "To create a subject, send the name, code, department code, course code, semester number, and credits. A confirm card appears before anything is saved.",
  announcement: "To create an announcement, send the title, message, and audience (everyone, students, teachers, or admins). A confirm card appears before anything is saved.",
  event: "To create an event, send the title, type, start time, and venue. A confirm card appears before anything is saved.",
  placement: "To create a placement drive, send the company, role, and application deadline. A confirm card appears before anything is saved.",
}

export function admissionMoveAllowed(from: string, to: string) {
  return (admissionMoves[from] ?? []).includes(to)
}

export function admissionStatusRequest(text: string, history: { content: string }[] = []) {
  const email = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] ?? ""
  const status = bareStatus(text) || statusIn(text)
  if (!status && !wantsStatusChange(text)) return null
  if (status && !bareStatus(text) && !wantsStatusChange(text)) return null
  const name = explicitPerson(text) || personFromHistory(history)
  if (!email && !name && !status) return null
  return { name, email, status }
}

export function createKind(text: string) {
  if (!/\b(create|add|new)\b/i.test(text)) return null
  if (/\b(admission|application)\b/i.test(text)) return "admission"
  if (/\bstudent\b/i.test(text)) return "student"
  if (/\bteacher\b/i.test(text)) return "teacher"
  if (/\bdepartment\b/i.test(text)) return "department"
  if (/\bcourse\b/i.test(text)) return "course"
  if (/\bsubject\b/i.test(text)) return "subject"
  if (/\b(announcement|notice)\b/i.test(text)) return "announcement"
  if (/\bevent\b/i.test(text)) return "event"
  if (/\b(placement|drive)\b/i.test(text)) return "placement"
  return null
}

export function createReply(text: string) {
  const kind = createKind(text)
  return kind ? createGuides[kind] ?? null : null
}

export function admissionDraft(text: string) {
  if (createKind(text) !== "admission") return null
  const email = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] ?? ""
  const phone = text.match(/(?:\+\d{1,3}[\s-]?)?(?:\d[\s-]?){8,14}/)?.[0]?.trim() ?? ""
  const departmentCode = text.match(/\bdepartment\s+(?:code\s+)?([A-Za-z0-9-]+)/i)?.[1] ?? ""
  const courseCode = text.match(/\bcourse\s+(?:code\s+)?([A-Za-z0-9-]+)/i)?.[1] ?? ""
  const fullName = explicitPerson(text)
  if (!fullName || !email || !phone || !departmentCode || !courseCode) return { ready: false as const }
  return { ready: true as const, fullName, email, phone, departmentCode, courseCode }
}

export function matchAdmission(
  rows: { id?: string; fullName?: string; email?: string; status?: string }[],
  request: { name: string; email: string },
) {
  return rows.filter((row) => {
    if (request.email) return (row.email ?? "").toLowerCase() === request.email.toLowerCase()
    return (row.fullName ?? "").toLowerCase() === request.name.toLowerCase()
  })
}

export function adminVisibleReply(facts: string[], modelText: string, widgets: ChatWidget[] = []) {
  const visual = widgets.some((widget) => widget.kind === "list" || widget.kind === "detail")
  const rendered = facts.map((fact) => formatSpecialistFact(fact, visual)).filter(Boolean)
  if (rendered.length > 0) return rendered.join("\n\n")
  if (widgets.length > 0) {
    if (claimsRecordChange(modelText)) {
      return "Nothing was saved. A change appears here as a form, and the record updates only after you confirm it."
    }
    return modelText.trim() || "The admissions are in the card below."
  }
  if (claimsRecordChange(modelText)) {
    return "Nothing was saved. A change appears here as a card, and the record updates only after you confirm it."
  }
  return modelText.trim()
}

function statusIn(text: string) {
  return admissionStatusPhrases.find(([pattern]) => pattern.test(text))?.[1] ?? ""
}

function bareStatus(text: string) {
  const match = text.trim().match(/^(?:to\s+)?(under[\s_-]?review|approved|rejected|completed|applied)[.?!]*$/i)
  if (!match?.[1]) return ""
  return match[1].toLowerCase().replace(/[\s-]+/g, "_")
}

function wantsStatusChange(text: string) {
  const words = text.match(/[A-Za-z]+/g) ?? []
  const typedChange = words.some((word) => ["change", "update"].some((target) => editDistance(word.toLowerCase(), target) <= 2) || /^(set|mark|move|make)$/i.test(word))
  return typedChange || (Boolean(statusIn(text)) && /\b(to|his|her|their|status)\b/i.test(text))
}

function explicitPerson(text: string) {
  const words = text.match(/[A-Za-z][A-Za-z'.-]*/g) ?? []
  for (let index = 0; index < words.length - 1; index += 1) {
    const first = words[index]
    const second = words[index + 1]
    if (!first || !second || !isPersonWord(first) || !isPersonWord(second)) continue
    return `${cleanWord(first)} ${cleanWord(second)}`
  }
  return ""
}

function personFromHistory(history: { content: string }[]) {
  for (let index = history.length - 1; index >= 0; index -= 1) {
    const name = explicitPerson(history[index]?.content ?? "")
    if (name) return name
  }
  return ""
}

function isPersonWord(word: string) {
  const lower = cleanWord(word).toLowerCase()
  if (!lower || nameSkip.has(lower)) return false
  if (["under", "review", "approved", "rejected", "completed", "applied", "approve", "reject"].includes(lower)) return false
  if (["change", "update"].some((target) => editDistance(lower, target) <= 2)) return false
  if (/^[A-Z0-9-]{2,8}$/.test(word)) return false
  return /^[A-Za-z][a-z'.-]*$/.test(cleanWord(word))
}

function cleanWord(word: string) {
  return word.replace(/['’]s$/i, "")
}

function editDistance(left: string, right: string) {
  const rows = Array.from({ length: left.length + 1 }, (_, index) => [index])
  for (let column = 1; column <= right.length; column += 1) rows[0]?.push(column)
  for (let row = 1; row <= left.length; row += 1) {
    for (let column = 1; column <= right.length; column += 1) {
      const cost = left[row - 1] === right[column - 1] ? 0 : 1
      rows[row]?.push(Math.min((rows[row - 1]?.[column] ?? 0) + 1, (rows[row]?.[column - 1] ?? 0) + 1, (rows[row - 1]?.[column - 1] ?? 0) + cost))
    }
  }
  return rows[left.length]?.[right.length] ?? left.length
}

function formatSpecialistFact(fact: string, visual = false) {
  const parsed = embeddedJson(fact)
  const rendered = !visual && parsed ? renderRecords(parsed) : ""
  const prose = fact
    .replace(/\{[\s\S]*\}/g, " ")
    .replace(/Use only these rows\.\s*/g, " ")
    .replace(/Do not describe an outage\.\s*/g, " ")
    .replace(/The specialist did not call a tool\.\s*/g, " ")
    .replace(/Current \w+ rows:\s*/g, " ")
    .replace(/\s+/g, " ")
    .trim()
  const safeProse = prose && !claimsRecordChange(prose) ? prose : ""
  return [safeProse, rendered].filter(Boolean).join("\n\n")
}

function embeddedJson(fact: string) {
  const start = fact.indexOf("{")
  const end = fact.lastIndexOf("}")
  if (start < 0 || end <= start) return null
  try {
    return JSON.parse(fact.slice(start, end + 1)) as unknown
  } catch {
    return null
  }
}

function renderRecords(value: unknown) {
  if (!value || typeof value !== "object") return ""
  const record = value as { rows?: unknown }
  const rows = Array.isArray(record.rows) ? record.rows : [value]
  return rows.map((row) => `- ${recordLine(row)}`).filter((line) => line !== "- ").join("\n")
}

function recordLine(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return ""
  const row = value as Record<string, unknown>
  const name = textValue(row.fullName) || textValue(row.name) || textValue(row.title) || textValue(row.companyName) || textValue(row.rollNumber) || textValue(row.employeeCode)
  if (!name) return ""
  const status = textValue(row.status).replaceAll("_", " ")
  const department = textValue(row.departmentCode)
  const course = textValue(row.courseCode)
  return [name, status, department, course].filter(Boolean).join(" · ")
}

function textValue(value: unknown) {
  return typeof value === "string" ? value.trim() : ""
}

function claimsRecordChange(text: string) {
  if (/nothing was (saved|changed)|nothing is saved yet|not available|cannot set|not a status/i.test(text)) return false
  return /\b(has been updated|was updated|i updated|i have updated|status has been|saved the|record was saved)\b/i.test(text)
}

export function proposalExpiry(now: Date) {
  return new Date(now.getTime() + proposalTtlMs).toISOString()
}

export function withoutSecrets(payload: Record<string, unknown>) {
  const next = { ...payload }
  delete next.password
  return next
}

export function claimDecision(
  row: { profileId: string; expiresAt: string; consumedAt: string | null } | null,
  actorId: string,
  now: Date,
) {
  if (!row) return "missing" as const
  if (row.profileId !== actorId) return "foreign" as const
  if (row.consumedAt) return "consumed" as const
  if (new Date(row.expiresAt).getTime() <= now.getTime()) return "expired" as const
  return "ok" as const
}

export async function commitProposal(
  prepared: PreparedProposal,
  insert: (row: { action: AdminAction; payload: Record<string, string | string[]>; summary: string }) => Promise<string | null>,
) {
  if (!prepared.ok) return { inserted: false as const, error: prepared.error }
  const id = await insert({ action: prepared.action, payload: prepared.payload, summary: prepared.summary })
  if (!id) return { inserted: false as const, error: "The change could not be staged." }
  return { inserted: true as const, id, summary: prepared.summary, action: prepared.action, payload: prepared.payload }
}

const admissionEditKeys = {
  "admission.create": ["fullName", "email", "phone", "departmentId", "courseId", "semesterId", "notes"],
  "admission.update": ["fullName", "email", "phone", "departmentId", "courseId", "semesterId", "notes"],
  "admission.status": ["status"],
  "admission.enroll": ["rollNumber"],
} as const

export function applyAdmissionEdits(
  action: string,
  stored: Record<string, string | string[]>,
  edits?: Record<string, unknown>,
): { ok: true; payload: Record<string, string | string[]> } | { ok: false; error: string; fieldErrors: Record<string, string> } {
  if (!action.startsWith("admission.")) return { ok: true, payload: stored }
  const keys = admissionEditKeys[action as keyof typeof admissionEditKeys]
  if (!keys) return { ok: false, error: "That change is no longer available.", fieldErrors: {} }
  const next: Record<string, string | string[]> = { ...stored }
  if (edits) {
    for (const key of keys) {
      const value = edits[key]
      if (typeof value === "string") next[key] = value.trim()
    }
  }
  if (action === "admission.enroll") next.password = typeof stored.password === "string" ? stored.password : ""
  else delete next.password
  return admissionPayload(action, next)
}

function admissionPayload(
  action: string,
  fields: Record<string, string | string[]>,
): { ok: true; payload: Record<string, string | string[]> } | { ok: false; error: string; fieldErrors: Record<string, string> } {
  const textAt = (key: string) => (typeof fields[key] === "string" ? fields[key] : "")
  if (action === "admission.create" || action === "admission.update") {
    const parsed = admissionSchema.safeParse({
      id: textAt("id"),
      fullName: textAt("fullName"),
      email: textAt("email"),
      phone: textAt("phone"),
      departmentId: textAt("departmentId"),
      courseId: textAt("courseId"),
      semesterId: textAt("semesterId"),
      notes: textAt("notes"),
    })
    if (!parsed.success) return editFail(parsed.error)
    return {
      ok: true,
      payload: {
        id: parsed.data.id,
        fullName: parsed.data.fullName,
        email: parsed.data.email,
        phone: parsed.data.phone,
        departmentId: parsed.data.departmentId,
        courseId: parsed.data.courseId,
        semesterId: parsed.data.semesterId ?? "",
        notes: parsed.data.notes,
      },
    }
  }
  if (action === "admission.status") {
    const parsed = admissionStatusSchema.safeParse({ id: textAt("id"), status: textAt("status") })
    if (!parsed.success) return editFail(parsed.error)
    return { ok: true, payload: { id: parsed.data.id, status: parsed.data.status } }
  }
  const parsed = enrollSchema.safeParse({
    id: textAt("id"),
    rollNumber: textAt("rollNumber"),
    password: textAt("password"),
  })
  if (!parsed.success) return editFail(parsed.error)
  return { ok: true, payload: { id: parsed.data.id, rollNumber: parsed.data.rollNumber, password: parsed.data.password } }
}

function editFail(error: z.ZodError): { ok: false; error: string; fieldErrors: Record<string, string> } {
  const fieldErrors: Record<string, string> = {}
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form")
    if (!fieldErrors[key]) fieldErrors[key] = issue.message
  }
  const first = error.issues[0]
  const path = first?.path.join(".") || "form"
  return { ok: false, error: `${path}: ${first?.message ?? "Check the form and try again."}`, fieldErrors }
}

export async function runConfirmedProposal(
  claimed: { action: string; payload: Record<string, string | string[]> },
  deps: {
    save: (action: string, payload: Record<string, string | string[]>) => Promise<{ error: string | null }>
    readBack: (action: string, payload: Record<string, string | string[]>) => Promise<string | null>
    release: () => Promise<void>
    strip: () => Promise<void>
  },
) {
  const saved = await deps.save(claimed.action, claimed.payload)
  if (saved.error) {
    await deps.release()
    return { error: saved.error, verified: null }
  }
  await deps.strip()
  const verified = await deps.readBack(claimed.action, claimed.payload)
  if (!verified) return { error: "The office could not confirm the saved row.", verified: null }
  return { error: null, verified }
}

export async function prepareProposal(
  action: AdminAction,
  fields: Record<string, unknown>,
  lookup: ProposalLookup,
): Promise<PreparedProposal> {
  if (action === "department.create" || action === "department.update") return departmentProposal(action, fields, lookup)
  if (action === "course.create" || action === "course.update") return courseProposal(action, fields, lookup)
  if (action === "subject.create" || action === "subject.update") return subjectProposal(action, fields, lookup)
  if (action === "student.update") return studentProposal(fields, lookup)
  if (action === "teacher.create" || action === "teacher.update") return teacherProposal(action, fields, lookup)
  if (action === "admission.create" || action === "admission.update") return admissionProposal(action, fields, lookup)
  if (action === "admission.status") return admissionStatusProposal(fields, lookup)
  if (action === "admission.enroll") return enrollProposal(fields, lookup)
  if (action === "announcement.create" || action === "announcement.update") return announcementProposal(action, fields, lookup)
  if (action === "event.create" || action === "event.update") return eventProposal(action, fields, lookup)
  if (action === "placement.create" || action === "placement.update") return placementProposal(action, fields, lookup)
  return applicationProposal(fields, lookup)
}

async function departmentProposal(action: AdminAction, fields: Record<string, unknown>, lookup: ProposalLookup): Promise<PreparedProposal> {
  const creating = action === "department.create"
  const current = creating ? null : await currentRow(lookup, "department", fields, { code: text(fields, "code") })
  if (isFail(current)) return current
  if (creating) {
    const existing = await lookup.find("department", { code: text(fields, "code") })
    if (existing) return fail("That department code is already in use.")
  }
  const name = pick(fields, "name", current, "name")
  const code = text(fields, "nextCode") || pick(fields, "code", current, "code")
  const parsed = departmentSchema.safeParse({
    id: current ? str(current, "id") : "",
    name,
    code,
    description: pick(fields, "description", current, "description"),
    isActive: pickFlag(fields, current),
  })
  if (!parsed.success) return schemaFail(parsed.error)
  return ok(action, {
    id: parsed.data.id,
    name: parsed.data.name,
    code: parsed.data.code,
    description: parsed.data.description,
    isActive: yes(parsed.data.isActive),
  }, `${creating ? "Create" : "Update"} department ${parsed.data.name} (${parsed.data.code}). Active ${parsed.data.isActive}.`)
}

async function courseProposal(action: AdminAction, fields: Record<string, unknown>, lookup: ProposalLookup): Promise<PreparedProposal> {
  const creating = action === "course.create"
  const current = creating ? null : await currentRow(lookup, "course", fields, { code: text(fields, "code") })
  if (isFail(current)) return current
  if (creating) {
    const existing = await lookup.find("course", { code: text(fields, "code") })
    if (existing) return fail("That course code is already in use.")
  }
  const departmentId = await departmentChoice(fields, lookup, current)
  if (typeof departmentId !== "string") return departmentId
  const duration = fields.durationSemesters === undefined && current ? numOf(current.durationSemesters) : num(fields, "durationSemesters")
  const parsed = courseSchema.safeParse({
    id: current ? str(current, "id") : "",
    departmentId,
    name: pick(fields, "name", current, "name"),
    code: text(fields, "nextCode") || pick(fields, "code", current, "code"),
    durationSemesters: duration ?? "",
    description: pick(fields, "description", current, "description"),
    isActive: pickFlag(fields, current),
  })
  if (!parsed.success) return schemaFail(parsed.error)
  return ok(action, {
    id: parsed.data.id,
    departmentId: parsed.data.departmentId,
    name: parsed.data.name,
    code: parsed.data.code,
    durationSemesters: String(parsed.data.durationSemesters),
    description: parsed.data.description,
    isActive: yes(parsed.data.isActive),
  }, `${creating ? "Create" : "Update"} course ${parsed.data.name} (${parsed.data.code}), ${parsed.data.durationSemesters} semesters. Active ${parsed.data.isActive}.`)
}

async function subjectProposal(action: AdminAction, fields: Record<string, unknown>, lookup: ProposalLookup): Promise<PreparedProposal> {
  const creating = action === "subject.create"
  const chosen = text(fields, "courseCode") ? await courseChoice(fields, lookup) : null
  if (chosen && !("id" in chosen)) return chosen
  const current = creating
    ? null
    : await currentRow(lookup, "subject", fields, { courseId: chosen && "id" in chosen ? chosen.id : "", code: text(fields, "code") })
  if (isFail(current)) return current
  const courseId = (chosen && "id" in chosen ? chosen.id : "") || (current ? str(current, "courseId") : "")
  const courseCode = (chosen && "id" in chosen ? chosen.code : "") || "the course"
  if (!courseId) return fail("Choose a course that still exists.")
  if (creating) {
    const existing = await lookup.find("subject", { courseId, code: text(fields, "code") })
    if (existing) return fail("That subject code is already used on this course.")
  }
  const departmentId = await departmentChoice(fields, lookup, current ?? { departmentId: chosen && "id" in chosen ? chosen.departmentId : "" })
  if (typeof departmentId !== "string") return departmentId
  const parsed = subjectSchema.safeParse({
    id: current ? str(current, "id") : "",
    departmentId,
    courseId,
    semesterNumber: fields.semesterNumber === undefined && current ? numOf(current.semesterNumber) : num(fields, "semesterNumber"),
    name: pick(fields, "name", current, "name"),
    code: text(fields, "nextCode") || pick(fields, "code", current, "code"),
    credits: fields.credits === undefined && current ? numOf(current.credits) : num(fields, "credits"),
    isActive: pickFlag(fields, current),
  })
  if (!parsed.success) return schemaFail(parsed.error)
  return ok(action, {
    id: parsed.data.id,
    departmentId: parsed.data.departmentId,
    courseId: parsed.data.courseId,
    semesterNumber: String(parsed.data.semesterNumber),
    name: parsed.data.name,
    code: parsed.data.code,
    credits: String(parsed.data.credits),
    isActive: yes(parsed.data.isActive),
  }, `${creating ? "Create" : "Update"} subject ${parsed.data.name} (${parsed.data.code}) on ${courseCode}. Active ${parsed.data.isActive}.`)
}

async function studentProposal(fields: Record<string, unknown>, lookup: ProposalLookup): Promise<PreparedProposal> {
  const current = await currentRow(lookup, "student", fields, { roll: text(fields, "rollNumber") })
  if (isFail(current)) return current
  if (!current) return fail(missing)
  const departmentId = await optionalDepartment(fields, lookup, str(current, "departmentId"))
  if (typeof departmentId !== "string") return departmentId
  const courseId = await optionalCourse(fields, lookup, str(current, "courseId"))
  if (typeof courseId !== "string") return courseId
  const semesterId = await optionalSemester(fields, lookup, courseId, str(current, "semesterId"))
  if (typeof semesterId !== "string") return semesterId
  const roll = text(fields, "nextRollNumber") || str(current, "rollNumber")
  const parsed = studentUpdateSchema.safeParse({
    id: str(current, "id"),
    rollNumber: roll,
    departmentId,
    courseId,
    semesterId,
    isActive: pickFlag(fields, current),
  })
  if (!parsed.success) return schemaFail(parsed.error)
  return ok("student.update", {
    id: parsed.data.id,
    rollNumber: parsed.data.rollNumber,
    departmentId: parsed.data.departmentId ?? "",
    courseId: parsed.data.courseId ?? "",
    semesterId: parsed.data.semesterId ?? "",
    isActive: yes(parsed.data.isActive),
  }, `Update student ${parsed.data.rollNumber}. Active ${parsed.data.isActive}.`)
}

async function teacherProposal(action: AdminAction, fields: Record<string, unknown>, lookup: ProposalLookup): Promise<PreparedProposal> {
  const creating = action === "teacher.create"
  if (creating) {
    const email = text(fields, "email")
    if (email) {
      const existing = await lookup.find("teacherEmail", { email })
      if (existing) return fail("That email is already in use.")
    }
    const departmentId = await optionalDepartment(fields, lookup, "")
    if (typeof departmentId !== "string") return departmentId
    const subjectIds = await subjectChoice(fields, lookup, [])
    if (!Array.isArray(subjectIds)) return subjectIds
    const parsed = teacherCreateSchema.safeParse({
      fullName: text(fields, "fullName"),
      email: text(fields, "email"),
      phone: text(fields, "phone"),
      password: text(fields, "password"),
      departmentId,
      employeeCode: text(fields, "employeeCode"),
      designation: text(fields, "designation"),
      isActive: pickFlag(fields, null),
      subjectIds,
    })
    if (!parsed.success) return schemaFail(parsed.error)
    return ok(action, {
      fullName: parsed.data.fullName,
      email: parsed.data.email,
      phone: parsed.data.phone,
      password: parsed.data.password,
      departmentId: parsed.data.departmentId ?? "",
      employeeCode: parsed.data.employeeCode ?? "",
      designation: parsed.data.designation,
      isActive: yes(parsed.data.isActive),
      subjectIds: parsed.data.subjectIds,
    }, `Create teacher ${parsed.data.fullName} (${parsed.data.email}). A password is included.`)
  }
  const current = await currentRow(lookup, "teacher", fields, { employeeCode: text(fields, "employeeCode") })
  if (isFail(current)) return current
  if (!current) return fail(missing)
  const departmentId = await optionalDepartment(fields, lookup, str(current, "departmentId"))
  if (typeof departmentId !== "string") return departmentId
  const currentSubjects = Array.isArray(current.subjectIds) ? current.subjectIds.filter((item): item is string => typeof item === "string") : []
  const subjectIds = await subjectChoice(fields, lookup, currentSubjects)
  if (!Array.isArray(subjectIds)) return subjectIds
  const parsed = teacherUpdateSchema.safeParse({
    id: str(current, "id"),
    fullName: pick(fields, "fullName", current, "fullName"),
    phone: fields.phone === undefined ? str(current, "phone") : text(fields, "phone"),
    departmentId,
    employeeCode: text(fields, "nextEmployeeCode") || str(current, "employeeCode"),
    designation: fields.designation === undefined ? str(current, "designation") : text(fields, "designation"),
    isActive: pickFlag(fields, current),
    subjectIds,
  })
  if (!parsed.success) return schemaFail(parsed.error)
  return ok(action, {
    id: parsed.data.id,
    fullName: parsed.data.fullName,
    phone: parsed.data.phone,
    departmentId: parsed.data.departmentId ?? "",
    employeeCode: parsed.data.employeeCode ?? "",
    designation: parsed.data.designation,
    isActive: yes(parsed.data.isActive),
    subjectIds: parsed.data.subjectIds,
  }, `Update teacher ${parsed.data.fullName}. Active ${parsed.data.isActive}.`)
}

async function admissionProposal(action: AdminAction, fields: Record<string, unknown>, lookup: ProposalLookup): Promise<PreparedProposal> {
  const creating = action === "admission.create"
  if (creating && text(fields, "email")) {
    const existing = await lookup.find("admission", { email: text(fields, "email") })
    if (existing === "many" || existing) return fail("That email already has an application.")
  }
  const current = creating ? null : await currentRow(lookup, "admission", fields, { email: text(fields, "email") })
  if (isFail(current)) return current
  const departmentId = await departmentChoice(fields, lookup, current)
  if (typeof departmentId !== "string") return departmentId
  const chosen = text(fields, "courseCode") ? await courseChoice(fields, lookup) : null
  if (chosen && !("id" in chosen)) return chosen
  const courseId = (chosen && "id" in chosen ? chosen.id : "") || (current ? str(current, "courseId") : "")
  if (!courseId) return fail("Choose a course that still exists.")
  const semesterId = await optionalSemester(fields, lookup, courseId, current ? str(current, "semesterId") : "")
  if (typeof semesterId !== "string") return semesterId
  const parsed = admissionSchema.safeParse({
    id: current ? str(current, "id") : "",
    fullName: pick(fields, "fullName", current, "fullName"),
    email: pick(fields, "email", current, "email"),
    phone: fields.phone === undefined && current ? str(current, "phone") : text(fields, "phone"),
    departmentId,
    courseId,
    semesterId,
    notes: fields.notes === undefined && current ? str(current, "notes") : text(fields, "notes"),
  })
  if (!parsed.success) return schemaFail(parsed.error)
  return ok(action, {
    id: parsed.data.id,
    fullName: parsed.data.fullName,
    email: parsed.data.email,
    phone: parsed.data.phone,
    departmentId: parsed.data.departmentId,
    courseId: parsed.data.courseId,
    semesterId: parsed.data.semesterId ?? "",
    notes: parsed.data.notes,
  }, `${creating ? "Create" : "Update"} application for ${parsed.data.fullName} (${parsed.data.email}).`)
}

async function admissionStatusProposal(fields: Record<string, unknown>, lookup: ProposalLookup): Promise<PreparedProposal> {
  const current = await currentRow(lookup, "admission", fields, { email: text(fields, "email") })
  if (isFail(current) || !current) return current ?? fail(missing)
  const requested = text(fields, "status").toLowerCase().replaceAll("-", "_").replaceAll(" ", "_")
  const who = str(current, "fullName") || "That application"
  const from = str(current, "status")
  if (!["under_review", "approved", "rejected"].includes(requested)) {
    return fail(`${who} is ${from.replaceAll("_", " ")}. ${requested.replaceAll("_", " ")} is not a status this assistant can set. Nothing was changed.`)
  }
  if (!admissionMoveAllowed(from, requested)) {
    const next = (admissionMoves[from] ?? []).map((status) => status.replaceAll("_", " "))
    const hint = next.length > 0 ? ` Reply "${next[0]}" and the confirm card will appear.` : ""
    return fail(`${who} is still ${from.replaceAll("_", " ")}. ${requested.replaceAll("_", " ")} is not the next step.${hint} Nothing was changed.`)
  }
  const parsed = admissionStatusSchema.safeParse({ id: str(current, "id"), status: requested })
  if (!parsed.success) return schemaFail(parsed.error)
  return ok("admission.status", {
    id: parsed.data.id,
    status: parsed.data.status,
  }, `Set ${str(current, "fullName") || "the application"} to ${parsed.data.status.replaceAll("_", " ")}.`)
}

async function enrollProposal(fields: Record<string, unknown>, lookup: ProposalLookup): Promise<PreparedProposal> {
  const current = await currentRow(lookup, "admission", fields, { email: text(fields, "email") })
  if (isFail(current) || !current) return current ?? fail(missing)
  const parsed = enrollSchema.safeParse({
    id: str(current, "id"),
    rollNumber: text(fields, "rollNumber"),
    password: text(fields, "password"),
  })
  if (!parsed.success) return schemaFail(parsed.error)
  return ok("admission.enroll", {
    id: parsed.data.id,
    rollNumber: parsed.data.rollNumber,
    password: parsed.data.password,
  }, `Enroll ${str(current, "fullName") || "the applicant"} as roll ${parsed.data.rollNumber}. A password is included.`)
}

async function announcementProposal(action: AdminAction, fields: Record<string, unknown>, lookup: ProposalLookup): Promise<PreparedProposal> {
  const creating = action === "announcement.create"
  const current = creating ? null : await currentRow(lookup, "announcement", fields, { title: text(fields, "title") })
  if (isFail(current)) return current
  const departmentId = await optionalDepartment(fields, lookup, current ? str(current, "departmentId") : "")
  if (typeof departmentId !== "string") return departmentId
  const parsed = announcementSchema.safeParse({
    id: current ? str(current, "id") : "",
    title: pick(fields, "title", current, "title"),
    body: fields.body === undefined && current ? str(current, "body") : text(fields, "body"),
    audience: pick(fields, "audience", current, "audience") || "everyone",
    departmentId,
    priority: pick(fields, "priority", current, "priority") || "normal",
    publishAt: pick(fields, "publishAt", current, "publishAt"),
    expiresAt: fields.expiresAt === undefined && current ? str(current, "expiresAt") : text(fields, "expiresAt"),
    status: pick(fields, "status", current, "status") || "draft",
  })
  if (!parsed.success) return schemaFail(parsed.error)
  return ok(action, {
    id: parsed.data.id,
    title: parsed.data.title,
    body: parsed.data.body,
    audience: parsed.data.audience,
    departmentId: parsed.data.departmentId ?? "",
    priority: parsed.data.priority,
    publishAt: parsed.data.publishAt,
    expiresAt: parsed.data.expiresAt ?? "",
    status: parsed.data.status,
  }, `${creating ? "Create" : "Update"} announcement "${parsed.data.title}" for ${parsed.data.audience}. Status ${parsed.data.status}.`)
}

async function eventProposal(action: AdminAction, fields: Record<string, unknown>, lookup: ProposalLookup): Promise<PreparedProposal> {
  const creating = action === "event.create"
  const current = creating ? null : await currentRow(lookup, "event", fields, { title: text(fields, "title") })
  if (isFail(current)) return current
  const parsed = eventSchema.safeParse({
    id: current ? str(current, "id") : "",
    title: pick(fields, "title", current, "title"),
    description: fields.description === undefined && current ? str(current, "description") : text(fields, "description"),
    eventType: pick(fields, "eventType", current, "eventType"),
    startsAt: pick(fields, "startsAt", current, "startsAt"),
    endsAt: fields.endsAt === undefined && current ? str(current, "endsAt") : text(fields, "endsAt"),
    venue: fields.venue === undefined && current ? str(current, "venue") : text(fields, "venue"),
    status: pick(fields, "status", current, "status") || "draft",
    isPublic: fields.isPublic === undefined && current ? current.isPublic === true : flag(fields, "isPublic", false),
  })
  if (!parsed.success) return schemaFail(parsed.error)
  return ok(action, {
    id: parsed.data.id,
    title: parsed.data.title,
    description: parsed.data.description,
    eventType: parsed.data.eventType,
    startsAt: parsed.data.startsAt,
    endsAt: parsed.data.endsAt ?? "",
    venue: parsed.data.venue,
    status: parsed.data.status,
    isPublic: yes(parsed.data.isPublic),
  }, `${creating ? "Create" : "Update"} event "${parsed.data.title}" (${parsed.data.eventType}). Status ${parsed.data.status}. Public ${parsed.data.isPublic}.`)
}

async function placementProposal(action: AdminAction, fields: Record<string, unknown>, lookup: ProposalLookup): Promise<PreparedProposal> {
  const creating = action === "placement.create"
  const current = creating
    ? null
    : await currentRow(lookup, "drive", fields, { company: text(fields, "companyName"), role: text(fields, "roleTitle") })
  if (isFail(current)) return current
  const departmentId = await optionalDepartment(fields, lookup, current ? str(current, "departmentId") : "")
  if (typeof departmentId !== "string") return departmentId
  const courseId = await optionalCourse(fields, lookup, current ? str(current, "courseId") : "")
  if (typeof courseId !== "string") return courseId
  const parsed = placementDriveSchema.safeParse({
    id: current ? str(current, "id") : "",
    companyName: pick(fields, "companyName", current, "companyName"),
    roleTitle: pick(fields, "roleTitle", current, "roleTitle"),
    description: fields.description === undefined && current ? str(current, "description") : text(fields, "description"),
    packageText: fields.packageText === undefined && current ? str(current, "packageText") : text(fields, "packageText"),
    location: fields.location === undefined && current ? str(current, "location") : text(fields, "location"),
    jobType: pick(fields, "jobType", current, "jobType"),
    eligibility: fields.eligibility === undefined && current ? str(current, "eligibility") : text(fields, "eligibility"),
    requiredSkills: fields.requiredSkills === undefined && current ? skillsText(current.requiredSkills) : text(fields, "requiredSkills"),
    departmentId,
    courseId,
    applyBy: pick(fields, "applyBy", current, "applyBy"),
    visitAt: fields.visitAt === undefined && current ? str(current, "visitAt") : text(fields, "visitAt"),
    venue: fields.venue === undefined && current ? str(current, "venue") : text(fields, "venue"),
    status: pick(fields, "status", current, "status") || "draft",
  })
  if (!parsed.success) return schemaFail(parsed.error)
  return ok(action, {
    id: parsed.data.id,
    companyName: parsed.data.companyName,
    roleTitle: parsed.data.roleTitle,
    description: parsed.data.description,
    packageText: parsed.data.packageText,
    location: parsed.data.location,
    jobType: parsed.data.jobType,
    eligibility: parsed.data.eligibility,
    requiredSkills: text(fields, "requiredSkills") || skillsText(current?.requiredSkills),
    departmentId: parsed.data.departmentId ?? "",
    courseId: parsed.data.courseId ?? "",
    applyBy: parsed.data.applyBy,
    visitAt: parsed.data.visitAt ?? "",
    venue: parsed.data.venue,
    status: parsed.data.status,
  }, `${creating ? "Create" : "Update"} placement ${parsed.data.companyName} for ${parsed.data.roleTitle}. Status ${parsed.data.status}.`)
}

async function applicationProposal(fields: Record<string, unknown>, lookup: ProposalLookup): Promise<PreparedProposal> {
  const found = await lookup.find("application", {
    id: text(fields, "id"),
    roll: text(fields, "rollNumber"),
    company: text(fields, "companyName"),
    role: text(fields, "roleTitle"),
  })
  if (found === "many") return fail(many)
  if (!found) return fail(missing)
  const parsed = placementApplicationStatusSchema.safeParse({ id: str(found, "id"), status: text(fields, "status") })
  if (!parsed.success) return schemaFail(parsed.error)
  return ok("placement.application", {
    id: parsed.data.id,
    status: parsed.data.status,
  }, `Set the application for ${str(found, "rollNumber") || "the student"} to ${parsed.data.status.replaceAll("_", " ")}.`)
}

async function currentRow(
  lookup: ProposalLookup,
  kind: string,
  fields: Record<string, unknown>,
  byKey: Record<string, string>,
) {
  const explicit = text(fields, "id")
  const found = explicit
    ? await lookup.find(kind, { id: explicit })
    : await lookup.find(kind, byKey)
  if (found === "many") return fail(many)
  if (!found) return fail(missing)
  return found
}

async function departmentChoice(
  fields: Record<string, unknown>,
  lookup: ProposalLookup,
  current: Record<string, unknown> | null,
): Promise<string | PreparedProposal> {
  if (fields.departmentCode === undefined && current) return str(current, "departmentId")
  const code = text(fields, "departmentCode")
  if (!code) return fail("Choose a department that still exists.")
  const found = await lookup.find("department", { code })
  if (found === "many") return fail(many)
  if (!found) return fail("Choose a department that still exists.")
  return str(found, "id")
}

async function optionalDepartment(fields: Record<string, unknown>, lookup: ProposalLookup, currentId: string) {
  if (fields.departmentCode === undefined) return currentId
  if (!text(fields, "departmentCode")) return ""
  const found = await lookup.find("department", { code: text(fields, "departmentCode") })
  if (found === "many") return fail(many)
  if (!found) return fail("Choose a department that still exists.")
  return str(found, "id")
}

async function courseChoice(fields: Record<string, unknown>, lookup: ProposalLookup) {
  const code = text(fields, "courseCode")
  if (!code) return fail("Choose a course that still exists.")
  const found = await lookup.find("course", { code })
  if (found === "many") return fail(many)
  if (!found) return fail("Choose a course that still exists.")
  return { id: str(found, "id"), departmentId: str(found, "departmentId"), code: str(found, "code") || code }
}

async function optionalCourse(fields: Record<string, unknown>, lookup: ProposalLookup, currentId: string) {
  if (fields.courseCode === undefined) return currentId
  if (!text(fields, "courseCode")) return ""
  const found = await lookup.find("course", { code: text(fields, "courseCode") })
  if (found === "many") return fail(many)
  if (!found) return fail("Choose a course that still exists.")
  return str(found, "id")
}

async function optionalSemester(
  fields: Record<string, unknown>,
  lookup: ProposalLookup,
  courseId: string,
  currentId: string,
) {
  if (fields.semesterNumber === undefined) return currentId
  const number = num(fields, "semesterNumber")
  if (!number || !courseId) return ""
  const found = await lookup.find("semester", { courseId, number: String(number) })
  if (found === "many") return fail(many)
  if (!found) return fail("That semester could not be found.")
  return str(found, "id")
}

async function subjectChoice(fields: Record<string, unknown>, lookup: ProposalLookup, currentIds: string[]) {
  if (fields.subjectCodes === undefined) return currentIds
  const codes = Array.isArray(fields.subjectCodes) ? fields.subjectCodes.filter((item): item is string => typeof item === "string" && item.trim().length > 0) : []
  if (codes.length === 0) return []
  const found = await lookup.find("subjects", { codes: codes.join(",") })
  if (!found || found === "many" || !Array.isArray(found.ids)) return fail("Choose subjects that still exist.")
  const ids = found.ids.filter((item): item is string => typeof item === "string")
  if (ids.length !== codes.length) return fail("Choose subjects that still exist.")
  return ids
}

function ok(action: AdminAction, payload: Record<string, string | string[]>, summary: string): PreparedProposal {
  return { ok: true, action, payload, summary }
}

function fail(error: string): PreparedProposal {
  return { ok: false, error }
}

function isFail(value: Record<string, unknown> | PreparedProposal | null): value is PreparedProposal {
  return Boolean(value && "ok" in value && value.ok === false)
}

function schemaFail(error: z.ZodError): PreparedProposal {
  const issue = error.issues[0]
  const path = issue?.path.join(".") || "form"
  return fail(`${path}: ${issue?.message ?? "Check the form and try again."}`)
}

function text(fields: Record<string, unknown>, key: string) {
  const value = fields[key]
  return typeof value === "string" ? value.trim() : ""
}

function num(fields: Record<string, unknown>, key: string) {
  return numOf(fields[key])
}

function numOf(value: unknown) {
  if (typeof value === "number" && Number.isInteger(value)) return value
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value)
    if (Number.isInteger(parsed)) return parsed
  }
  return null
}

function flag(fields: Record<string, unknown>, key: string, fallback: boolean) {
  const value = fields[key]
  if (typeof value === "boolean") return value
  if (value === "true") return true
  if (value === "false") return false
  return fallback
}

function pickFlag(fields: Record<string, unknown>, current: Record<string, unknown> | null) {
  if (fields.isActive === undefined && current) return current.isActive === true
  return flag(fields, "isActive", true)
}

function pick(fields: Record<string, unknown>, key: string, current: Record<string, unknown> | null, currentKey: string) {
  if (fields[key] === undefined && current) return str(current, currentKey)
  return text(fields, key)
}

function str(row: Record<string, unknown> | null | undefined, key: string) {
  const value = row?.[key]
  return typeof value === "string" ? value : ""
}

function yes(value: boolean) {
  return value ? "true" : "false"
}

function skillsText(value: unknown) {
  if (typeof value === "string") return value
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === "string").join(", ")
  return ""
}

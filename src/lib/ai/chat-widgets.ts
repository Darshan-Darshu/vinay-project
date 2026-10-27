export type AdmissionWidgetRow = {
  id: string
  fullName: string
  email: string
  phone: string
  status: string
  notes: string
  departmentCode: string
  courseCode: string
  semesterNumber: string
}

export type AdmissionFormMode = "create" | "update" | "status" | "enroll"

export type ChatWidget =
  | { kind: "list"; specialist: "admissions"; total: number; rows: AdmissionWidgetRow[] }
  | { kind: "detail"; specialist: "admissions"; row: AdmissionWidgetRow }
  | {
      kind: "form"
      specialist: "admissions"
      proposalId: string
      mode: AdmissionFormMode
      fields: Record<string, string>
      summary: string
      result?: string
    }

const formModes: Record<string, AdmissionFormMode> = {
  "admission.create": "create",
  "admission.update": "update",
  "admission.status": "status",
  "admission.enroll": "enroll",
}

export function admissionListWidget(payload: string): ChatWidget | null {
  const parsed = jsonValue(payload)
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null
  const record = parsed as { total?: unknown; rows?: unknown }
  if (!Array.isArray(record.rows)) return null
  const rows = record.rows.flatMap((row) => {
    const parsedRow = admissionRow(row)
    return parsedRow ? [parsedRow] : []
  })
  const total = typeof record.total === "number" && record.total >= rows.length ? record.total : rows.length
  return { kind: "list", specialist: "admissions", total, rows: rows.slice(0, 20) }
}

export function admissionDetailWidget(payload: string): ChatWidget | null {
  const row = admissionRow(jsonValue(payload))
  if (!row) return null
  return { kind: "detail", specialist: "admissions", row }
}

export function admissionReadWidget(kind: string, payload: string) {
  if (kind === "admissions") return admissionListWidget(payload)
  if (kind === "admission") return admissionDetailWidget(payload)
  return null
}

export function admissionFormWidget(card: {
  id: string
  specialist: string
  summary: string
  action?: string
  fields?: Record<string, string>
}): Extract<ChatWidget, { kind: "form" }> | null {
  const mode = card.action ? formModes[card.action] : undefined
  if (card.specialist !== "admissions" || !mode || !card.fields) return null
  return {
    kind: "form",
    specialist: "admissions",
    proposalId: card.id,
    mode,
    fields: publicFields(card.fields),
    summary: clip(card.summary, 500),
  }
}

export function publicProposalFields(payload: Record<string, string | string[]>) {
  const fields: Record<string, string> = {}
  for (const [key, value] of Object.entries(payload)) {
    if (key === "password" || typeof value !== "string") continue
    fields[key] = value
  }
  return publicFields(fields)
}

export function parseChatWidgets(value: unknown): ChatWidget[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((item) => {
    const widget = parseWidget(item)
    return widget ? [widget] : []
  }).slice(0, 8)
}

function parseWidget(value: unknown): ChatWidget | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  const widget = value as Record<string, unknown>
  if (widget.specialist !== "admissions") return null
  if (widget.kind === "list") {
    if (!Array.isArray(widget.rows)) return null
    const rows = widget.rows.flatMap((row) => {
      const parsed = admissionRow(row)
      return parsed ? [parsed] : []
    }).slice(0, 20)
    const total = typeof widget.total === "number" && widget.total >= rows.length ? widget.total : rows.length
    return { kind: "list", specialist: "admissions", total, rows }
  }
  if (widget.kind === "detail") {
    const row = admissionRow(widget.row)
    if (!row) return null
    return { kind: "detail", specialist: "admissions", row }
  }
  if (widget.kind === "form") {
    const mode = typeof widget.mode === "string" ? formModes[`admission.${widget.mode}`] ?? (isFormMode(widget.mode) ? widget.mode : null) : null
    if (!mode || typeof widget.proposalId !== "string" || typeof widget.summary !== "string") return null
    const result = typeof widget.result === "string" && widget.result.trim() ? clip(widget.result, 500) : undefined
    return {
      kind: "form",
      specialist: "admissions",
      proposalId: widget.proposalId,
      mode,
      fields: publicFields(widget.fields),
      summary: clip(widget.summary, 500),
      ...(result ? { result } : {}),
    }
  }
  return null
}

function isFormMode(value: string): value is AdmissionFormMode {
  return value === "create" || value === "update" || value === "status" || value === "enroll"
}

function admissionRow(value: unknown): AdmissionWidgetRow | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  const row = value as Record<string, unknown>
  const fullName = textOf(row.fullName)
  const email = textOf(row.email)
  if (!fullName && !email) return null
  return {
    id: textOf(row.id),
    fullName,
    email,
    phone: textOf(row.phone),
    status: textOf(row.status),
    notes: textOf(row.notes),
    departmentCode: textOf(row.departmentCode),
    courseCode: textOf(row.courseCode),
    semesterNumber: textOf(row.semesterNumber),
  }
}

function publicFields(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {}
  const fields: Record<string, string> = {}
  for (const [key, item] of Object.entries(value)) {
    if (key === "password" || typeof item !== "string") continue
    fields[key] = clip(item, 4000)
  }
  return fields
}

function jsonValue(payload: string) {
  try {
    return JSON.parse(payload) as unknown
  } catch {
    return null
  }
}

function textOf(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return String(value)
  return typeof value === "string" ? clip(value.trim(), 4000) : ""
}

function clip(value: string, max: number) {
  return value.length > max ? value.slice(0, max) : value
}

export const listCap = 40
export const matchCap = 8
export const scoreCap = 20

export const recordsUnavailable = { error: "unavailable" as const }

export function textFilter(query: string | undefined) {
  const text = query?.trim().replace(/[%_]/g, "") ?? ""
  return text.length > 0 ? text : null
}

export function capList<T>(rows: T[], total: number) {
  return { rows: rows.slice(0, listCap), total }
}

export function capWindow<T>(rows: T[], total: number) {
  return { rows: rows.slice(0, scoreCap), total }
}

export function resolveFields<T>(rows: T[], query: string, fields: (row: T) => string[]) {
  const needle = query.trim().toLowerCase()
  if (!needle) return { status: "none" as const }
  const values = (row: T) => fields(row).map((field) => field.toLowerCase())
  const partial = rows.filter((row) => values(row).some((field) => field.includes(needle)))
  const exact = partial.filter((row) => values(row).some((field) => field === needle))
  const chosen = exact.length > 0 ? exact : partial
  if (chosen.length === 0) return { status: "none" as const }
  if (chosen.length === 1) return { status: "one" as const, row: chosen[0] }
  return { status: "many" as const, rows: chosen.slice(0, matchCap), total: chosen.length }
}

export function subjectFromLink(value: unknown) {
  if (!isRecord(value)) return []
  const subject = one(value.subjects)
  if (!subject || subject.is_active !== true) return []
  if (typeof subject.id !== "string" || typeof subject.name !== "string" || typeof subject.code !== "string") return []
  if (typeof subject.credits !== "number" || typeof subject.semester_number !== "number") return []
  return [{
    id: subject.id,
    code: subject.code,
    name: subject.name,
    credits: subject.credits,
    semester: subject.semester_number,
    course: nameOf(subject.courses),
  }]
}

export function studentFromRow(value: unknown) {
  if (!isRecord(value) || typeof value.id !== "string" || typeof value.roll_number !== "string") return []
  return [{ id: value.id, name: nameOf(value.profiles, "full_name"), rollNumber: value.roll_number }]
}

export function scoresForRoll(value: unknown, rollNumber: string) {
  const rows = Array.isArray(value) ? value.flatMap((item) => {
    if (!isRecord(item) || item.rollNumber !== rollNumber) return []
    if (typeof item.title !== "string" || typeof item.score !== "number" || typeof item.maxScore !== "number") return []
    if (typeof item.submittedAt !== "string") return []
    return [{ title: item.title, score: item.score, maximum: item.maxScore, submittedAt: item.submittedAt }]
  }) : []
  return { scores: rows.slice(0, scoreCap), total: rows.length }
}

export function marksFromRows(value: unknown, total: number) {
  const rows = Array.isArray(value) ? value.flatMap((item) => {
    if (!isRecord(item) || typeof item.exam_name !== "string" || typeof item.score !== "number" || typeof item.maximum !== "number") return []
    return [{ examName: item.exam_name, subjectCode: nameOf(item.subjects, "code"), score: item.score, maximum: item.maximum }]
  }) : []
  return { marks: rows.slice(0, scoreCap), total }
}

function nameOf(value: unknown, key = "name") {
  const row = one(value)
  if (!row || typeof row[key] !== "string") return ""
  return row[key]
}

function one(value: unknown): Record<string, unknown> | null {
  const row = Array.isArray(value) ? value[0] : value
  return isRecord(row) ? row : null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

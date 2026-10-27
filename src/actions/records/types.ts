export type RecordTone = "neutral" | "good" | "wait" | "alert" | "info"

export type RecordCard = {
  id: string
  title: string
  subtitle: string
  detail: string
  meta: string
  badge: string
  tone: RecordTone
  /** Set when a student can still send one application. */
  applyDriveId?: string
}

export type RecordLoader = (query: string, facet: string) => Promise<RecordCard[]>

export type RecordSearch = {
  q?: string | string[]
  facet?: string | string[]
}

export type RecordFacet = {
  value: string
  label: string
}

export const editorKinds = [
  "department",
  "course",
  "subject",
  "academic-year",
  "semester",
  "teacher",
  "student",
  "admission",
  "announcement",
  "event",
  "sports",
  "placement",
] as const

export type EditorKind = (typeof editorKinds)[number]

export function isEditorKind(value: string): value is EditorKind {
  return (editorKinds as readonly string[]).includes(value)
}

export type Directory = {
  title: string
  description: string
  empty: string
  noun: string
  facets?: RecordFacet[]
  /** Present on admin lists that open a create/edit sheet. */
  editor?: EditorKind
  /** Students are created by enrolling an application, so that list has no New button. */
  canCreate?: boolean
  load: RecordLoader
}

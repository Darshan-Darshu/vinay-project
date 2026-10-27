export const unpublishedReply = "That has not been published."
export const admissionFormSignal = "FORM:admission"
export const searchUnavailable = "Search is unavailable."

const emailPattern = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi
const phonePattern = /(?:\+\d{1,3}[\s-]?)?(?:\(?\d{2,4}\)?[\s-]?)?\d{3,4}[\s-]?\d{4}/g
const statusPattern = /\b(?:applied|under review|under_review|approved|rejected|completed)\b/gi

export type PublicCourse = {
  name: string
  code: string
  description: string
  durationSemesters: number
  departmentName: string
  departmentCode: string
}

export type PublicSubject = {
  name: string
  code: string
  credits: number
  semesterNumber: number
  courseCode: string
}

export type PublicPassage = {
  source: string
  recordId: string
  title: string
  text: string
}

export function filterCourses(courses: PublicCourse[], filter: { department?: string; code?: string; name?: string }) {
  const department = filter.department?.trim().toLowerCase() ?? ""
  const code = filter.code?.trim().toLowerCase() ?? ""
  const name = filter.name?.trim().toLowerCase() ?? ""
  return courses.filter((course) => {
    if (department && course.departmentName.toLowerCase() !== department && course.departmentCode.toLowerCase() !== department) {
      return false
    }
    if (code && course.code.toLowerCase() !== code) return false
    if (name && !course.name.toLowerCase().includes(name)) return false
    return true
  })
}

export function filterSubjects(subjects: PublicSubject[], courseCode: string) {
  const code = courseCode.trim().toLowerCase()
  return subjects.filter((subject) => subject.courseCode.toLowerCase() === code)
}

export function collegeNamespace(provider: string) {
  return `college-${provider}`
}

export function passageVectorId(source: string, recordId: string, ordinal: number) {
  return `${source}:${recordId}:${ordinal}`
}

export function buildPublicPassages(input: {
  settings: { name: string; about: string; admissionsInfo: string } | null
  departments: { id: string; name: string; description: string }[]
  courses: { id: string; name: string; description: string }[]
  events: { id: string; title: string; description: string }[]
  announcements: { id: string; title: string; body: string }[]
  documents?: { id: string; title: string; body: string }[]
}): PublicPassage[] {
  const chunks: { source: string; recordId: string; title: string; text: string }[] = []
  if (input.settings?.about.trim()) {
    chunks.push({ source: "about", recordId: "college", title: input.settings.name || "College", text: input.settings.about })
  }
  if (input.settings?.admissionsInfo.trim()) {
    chunks.push({
      source: "admissions",
      recordId: "admissions",
      title: "Admissions",
      text: input.settings.admissionsInfo,
    })
  }
  for (const department of input.departments) {
    if (department.description.trim()) {
      chunks.push({ source: "department", recordId: department.id, title: department.name, text: department.description })
    }
  }
  for (const course of input.courses) {
    if (course.description.trim()) {
      chunks.push({ source: "course", recordId: course.id, title: course.name, text: course.description })
    }
  }
  for (const event of input.events) {
    if (event.description.trim()) {
      chunks.push({ source: "event", recordId: event.id, title: event.title, text: event.description })
    }
  }
  for (const announcement of input.announcements) {
    if (announcement.body.trim()) {
      chunks.push({ source: "announcement", recordId: announcement.id, title: announcement.title, text: announcement.body })
    }
  }
  for (const document of input.documents ?? []) {
    if (document.body.trim()) {
      chunks.push({ source: "document", recordId: document.id, title: document.title, text: document.body })
    }
  }
  return chunks.flatMap((chunk) =>
    chunkPassage(chunk.text).map((text) => ({
      source: chunk.source,
      recordId: chunk.recordId,
      title: chunk.title,
      text,
    })),
  )
}

function chunkPassage(text: string) {
  const paragraphs = text.split(/\n\s*\n/).map((part) => part.trim()).filter((part) => part.length > 0)
  const passages: string[] = []
  for (const paragraph of paragraphs) {
    if (paragraph.length <= 1200) {
      passages.push(paragraph)
      continue
    }
    for (let index = 0; index < paragraph.length; index += 1200) {
      passages.push(paragraph.slice(index, index + 1200))
    }
  }
  return passages
}

export function readPineconeMatches(matches: { metadata?: Record<string, unknown> | null }[]) {
  return matches.flatMap((match) => {
    const metadata = match.metadata
    if (!metadata || typeof metadata.title !== "string" || typeof metadata.source !== "string" || typeof metadata.text !== "string") {
      return []
    }
    if (!metadata.text.trim()) return []
    return [{ title: metadata.title, source: metadata.source, text: metadata.text }]
  })
}

export function groundReply(reply: string, toolResults: string[]) {
  const results = toolResults.map((result) => result.trim()).filter(Boolean)
  if (results.length === 0) return unpublishedReply
  const corpus = results.join("\n")
  let text = scrubTokens(reply, corpus, emailPattern)
  text = scrubTokens(text, corpus, phonePattern)
  text = text.replace(statusPattern, (status) => (corpus.toLowerCase().includes(status.toLowerCase()) ? status : ""))
  text = scrubQuotes(text, passageTexts(results))
  return text.replace(/[ \t]{2,}/g, " ").replace(/ +([.,])/g, "$1").trim()
}

export function guestHistory(value: unknown) {
  if (!Array.isArray(value)) return []
  const messages: { role: "user" | "assistant"; content: string }[] = []
  for (const item of value) {
    if (!item || typeof item !== "object") continue
    const record = item as { role?: unknown; content?: unknown }
    if (record.role !== "user" && record.role !== "assistant") continue
    if (typeof record.content !== "string") continue
    const raw = record.role === "assistant" ? withoutApplicationCta(record.content) : record.content.trim()
    const content = raw.slice(0, 2000)
    if (!content) continue
    messages.push({ role: record.role, content })
  }
  return messages.slice(-6)
}

export function wantsAdmissionForm(toolResults: string[]) {
  return toolResults.some((result) => result.includes(admissionFormSignal))
}

const applicationInvite = /\b(?:fill out the application form|fill in the form|complete the form)\b|\bclick here\b[^\n]{0,120}\bapplication\b/i

export function offersApplicationForm(text: string) {
  return applicationInvite.test(text)
}

export function withoutApplicationCta(reply: string) {
  return reply
    .replace(/^[^\n]*(?:\bfill out the application form\b|\bfill in the form\b|\bcomplete the form\b|\bclick here\b[^\n]{0,120}\bapplication\b)[^\n]*\n?/gim, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}

function scrubTokens(reply: string, corpus: string, pattern: RegExp) {
  return reply.replace(pattern, (token) => (corpus.includes(token) ? token : ""))
}

function passageTexts(toolResults: string[]) {
  const texts: string[] = []
  for (const result of toolResults) {
    try {
      const parsed = JSON.parse(result) as { matches?: unknown }
      if (!Array.isArray(parsed.matches)) continue
      for (const match of parsed.matches) {
        if (match && typeof match === "object" && "text" in match && typeof match.text === "string") texts.push(match.text)
      }
    } catch {
      continue
    }
  }
  return texts
}

function scrubQuotes(reply: string, passages: string[]) {
  if (passages.length === 0) return reply
  return reply.replace(/"([^"]{12,})"/g, (quoted, inner: string) => (passages.some((passage) => passage.includes(inner)) ? quoted : ""))
}

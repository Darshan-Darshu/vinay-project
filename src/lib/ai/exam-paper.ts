export const examPaperLimits = {
  one: 20,
  two: 10,
  five: 8,
  twenty: 4,
} as const

export const examPaperMaxQuestions = 30

export type ExamPaperCounts = {
  one: number
  two: number
  five: number
  twenty: number
}

export type SectionMark = 1 | 2 | 5 | 20

export const examPaperBands = [
  { key: "one", marks: 1, limit: examPaperLimits.one, label: "1 mark" },
  { key: "two", marks: 2, limit: examPaperLimits.two, label: "2 marks" },
  { key: "five", marks: 5, limit: examPaperLimits.five, label: "5 marks" },
  { key: "twenty", marks: 20, limit: examPaperLimits.twenty, label: "20 marks" },
] as const satisfies readonly { key: keyof ExamPaperCounts; marks: SectionMark; limit: number; label: string }[]

export function examPaperQuestionCount(counts: ExamPaperCounts) {
  return counts.one + counts.two + counts.five + counts.twenty
}

export function examPaperTotal(counts: ExamPaperCounts) {
  return counts.one + counts.two * 2 + counts.five * 5 + counts.twenty * 20
}

export function canGenerateExamPaper(counts: ExamPaperCounts) {
  if (!within(counts.one, examPaperLimits.one)) return false
  if (!within(counts.two, examPaperLimits.two)) return false
  if (!within(counts.five, examPaperLimits.five)) return false
  if (!within(counts.twenty, examPaperLimits.twenty)) return false
  const count = examPaperQuestionCount(counts)
  return count >= 1 && count <= examPaperMaxQuestions
}

export function parseExamSection(value: unknown, count: number): string[] | null {
  if (!Number.isInteger(count) || count < 1 || count > examPaperMaxQuestions) return null
  if (!Array.isArray(value) || value.length !== count) return null
  const stems: string[] = []
  for (const item of value) {
    if (!isRecord(item) || typeof item.stem !== "string") return null
    const stem = item.stem.trim()
    if (!stem) return null
    stems.push(stem)
  }
  return stems
}

function within(value: number, max: number) {
  return Number.isInteger(value) && value >= 0 && value <= max
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

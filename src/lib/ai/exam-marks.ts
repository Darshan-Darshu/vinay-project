export type ExamMarkRow = {
  rollNumber: string
  subjectCode: string
  examName: string
  score: number
  maximum: number
}

export function parseExamMark(value: unknown): ExamMarkRow | null {
  if (!isRecord(value)) return null
  const rollNumber = text(value.rollNumber)
  const subjectCode = text(value.subjectCode)
  const examName = text(value.examName)
  if (!rollNumber || !subjectCode || !examName) return null
  if (typeof value.score !== "number" || typeof value.maximum !== "number") return null
  if (!Number.isInteger(value.score) || !Number.isInteger(value.maximum)) return null
  if (value.maximum < 1 || value.maximum > 100) return null
  if (value.score < 0 || value.score > value.maximum) return null
  return { rollNumber, subjectCode, examName, score: value.score, maximum: value.maximum }
}

export function parseExamCsv(text: string): ExamMarkRow[] | null {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter((line) => line.length > 0)
  if (lines.length < 2) return null
  const header = lines[0].split(",").map((cell) => cell.trim())
  const expected = ["roll_number", "subject_code", "exam_name", "score", "maximum"]
  if (header.length !== expected.length || expected.some((name, index) => header[index] !== name)) return null
  const rows: ExamMarkRow[] = []
  for (const line of lines.slice(1)) {
    const cells = line.split(",").map((cell) => cell.trim())
    if (cells.length !== 5) return null
    const score = Number(cells[3])
    const maximum = Number(cells[4])
    const row = parseExamMark({
      rollNumber: cells[0],
      subjectCode: cells[1],
      examName: cells[2],
      score,
      maximum,
    })
    if (!row) return null
    rows.push(row)
  }
  return rows
}

export function canReadAttempt(callerStudentId: string, attemptStudentId: string) {
  return callerStudentId.length > 0 && callerStudentId === attemptStudentId
}

function text(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

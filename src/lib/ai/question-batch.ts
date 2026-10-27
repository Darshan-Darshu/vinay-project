export type DraftOption = {
  body: string
  isCorrect: boolean
}

export type DraftQuestion = {
  questionType: "mcq" | "true_false"
  difficulty: "easy" | "medium" | "hard"
  marks: number
  stem: string
  explanation: string
  options: DraftOption[]
}

export function parseQuestionBatch(value: unknown): DraftQuestion[] | null {
  if (!Array.isArray(value) || value.length < 1 || value.length > 10) return null
  const batch: DraftQuestion[] = []
  for (const item of value) {
    const question = parseQuestion(item)
    if (!question) return null
    batch.push(question)
  }
  return batch
}

function parseQuestion(value: unknown): DraftQuestion | null {
  if (!isRecord(value)) return null
  if (value.questionType !== "mcq" && value.questionType !== "true_false") return null
  if (value.difficulty !== "easy" && value.difficulty !== "medium" && value.difficulty !== "hard") return null
  if (typeof value.marks !== "number" || !Number.isInteger(value.marks) || value.marks < 1 || value.marks > 100) return null
  if (typeof value.stem !== "string" || value.stem.trim().length === 0) return null
  if (typeof value.explanation !== "string") return null
  if (!Array.isArray(value.options)) return null
  const options = value.options.flatMap(parseOption)
  if (options.length !== value.options.length) return null
  const correct = options.filter((option) => option.isCorrect).length
  if (correct !== 1) return null
  if (value.questionType === "true_false" && options.length !== 2) return null
  if (value.questionType === "mcq" && (options.length < 2 || options.length > 6)) return null
  return {
    questionType: value.questionType,
    difficulty: value.difficulty,
    marks: value.marks,
    stem: value.stem.trim(),
    explanation: value.explanation.trim(),
    options,
  }
}

function parseOption(value: unknown): DraftOption[] {
  if (!isRecord(value) || typeof value.body !== "string" || value.body.trim().length === 0 || typeof value.isCorrect !== "boolean") {
    return []
  }
  return [{ body: value.body.trim(), isCorrect: value.isCorrect }]
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

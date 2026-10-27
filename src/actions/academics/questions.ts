"use server"

import { actionError, fail, field, ok, refreshAcademic, staffContext, subjectChoices } from "@/actions/academics/shared"
import type { FormState } from "@/actions/form-state"
import { isRecord, QueryError } from "@/lib/db/errors"
import { questionSchema } from "@/lib/validations/academics"

export type QuestionOptionView = {
  id: string
  label: string
  body: string
  isCorrect: boolean
}

export type QuestionView = {
  id: string
  subjectId: string
  subjectName: string
  topic: string
  questionType: "mcq" | "true_false"
  difficulty: "easy" | "medium" | "hard"
  marks: number
  stem: string
  explanation: string
  options: QuestionOptionView[]
  frozen: boolean
  source: "manual" | "ai"
}

const labels = ["A", "B", "C", "D", "E", "F"]

export async function loadQuestionDesk() {
  const { supabase } = await staffContext()
  const [subjects, questions] = await Promise.all([
    subjectChoices(),
    supabase
      .from("questions")
      .select(
        "id, subject_id, topic, question_type, difficulty, marks, stem, explanation, source, subjects(name), question_options(id, label, option_text, is_correct, ordinal), question_paper_questions(question_papers(status))",
      )
      .order("created_at", { ascending: false }),
  ])
  if (questions.error) throw new QueryError()
  return {
    subjects,
    questions: (questions.data ?? []).flatMap(toQuestion),
  }
}

export async function saveQuestion(_previous: FormState, formData: FormData): Promise<FormState> {
  const questionType = field(formData, "questionType")
  const optionCount = questionType === "true_false" ? 2 : 4
  const correct = field(formData, "correct")
  const options = Array.from({ length: optionCount }, (_, index) => ({
    body: questionType === "true_false" ? (index === 0 ? "True" : "False") : field(formData, `option${index}`),
    isCorrect: correct === String(index),
  })).filter((option) => option.body.length > 0)

  const parsed = questionSchema.safeParse({
    id: field(formData, "id"),
    subjectId: field(formData, "subjectId"),
    topic: field(formData, "topic"),
    questionType,
    difficulty: field(formData, "difficulty"),
    marks: field(formData, "marks"),
    stem: field(formData, "stem"),
    explanation: field(formData, "explanation"),
    options,
  })
  if (!parsed.success) return fail("Check the question and choose one correct option.")

  const { supabase } = await staffContext()
  const result = await supabase.rpc("save_question", {
    target_question: parsed.data.id,
    target_subject: parsed.data.subjectId,
    topic: parsed.data.topic,
    question_type: parsed.data.questionType,
    difficulty: parsed.data.difficulty,
    marks: parsed.data.marks,
    stem: parsed.data.stem,
    explanation: parsed.data.explanation,
    options: parsed.data.options.map((option, index) => ({
      label: labels[index] ?? String(index + 1),
      body: option.body,
      isCorrect: option.isCorrect,
    })),
  })
  if (result.error || !result.data) return fail(actionError(result.error))
  refreshAcademic()
  return ok("Question saved.")
}

export async function deleteQuestion(_previous: FormState, formData: FormData): Promise<FormState> {
  const id = field(formData, "id")
  if (!id) return fail("That question could not be found.")
  const { supabase } = await staffContext()
  const result = await supabase.from("questions").delete().eq("id", id)
  if (result.error?.code === "23503") return fail("Remove this question from its draft papers first.")
  if (result.error) return fail(actionError(result.error))
  refreshAcademic()
  return ok("Question deleted.")
}

function toQuestion(value: unknown): QuestionView[] {
  if (
    !isRecord(value) ||
    typeof value.id !== "string" ||
    typeof value.subject_id !== "string" ||
    typeof value.stem !== "string" ||
    typeof value.marks !== "number" ||
    (value.question_type !== "mcq" && value.question_type !== "true_false") ||
    (value.difficulty !== "easy" && value.difficulty !== "medium" && value.difficulty !== "hard")
  ) {
    return []
  }
  const options = Array.isArray(value.question_options) ? value.question_options.flatMap(toOption) : []
  options.sort((left, right) => left.ordinal - right.ordinal)
  const links = Array.isArray(value.question_paper_questions) ? value.question_paper_questions : []
  const frozen = links.some((link) => {
    if (!isRecord(link)) return false
    const paper = Array.isArray(link.question_papers) ? link.question_papers[0] : link.question_papers
    return isRecord(paper) && paper.status === "published"
  })
  return [
    {
      id: value.id,
      subjectId: value.subject_id,
      subjectName: subjectName(value.subjects),
      topic: typeof value.topic === "string" ? value.topic : "",
      questionType: value.question_type,
      difficulty: value.difficulty,
      marks: value.marks,
      stem: value.stem,
      explanation: typeof value.explanation === "string" ? value.explanation : "",
      options: options.map(({ ordinal: _ordinal, ...option }) => option),
      frozen,
      source: value.source === "ai" ? "ai" : "manual",
    },
  ]
}

function toOption(value: unknown) {
  if (
    !isRecord(value) ||
    typeof value.id !== "string" ||
    typeof value.label !== "string" ||
    typeof value.option_text !== "string" ||
    typeof value.is_correct !== "boolean" ||
    typeof value.ordinal !== "number"
  ) {
    return []
  }
  return [{ id: value.id, label: value.label, body: value.option_text, isCorrect: value.is_correct, ordinal: value.ordinal }]
}

function subjectName(value: unknown) {
  const row = Array.isArray(value) ? value[0] : value
  return isRecord(row) && typeof row.name === "string" ? row.name : "Subject"
}

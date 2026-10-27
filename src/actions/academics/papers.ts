"use server"

import { actionError, fail, field, ok, refreshAcademic, relatedName, staffContext, subjectChoices } from "@/actions/academics/shared"
import type { FormState } from "@/actions/form-state"
import { isRecord, QueryError } from "@/lib/db/errors"
import { paperQuestionSchema, paperSchema } from "@/lib/validations/academics"

export type PaperSummary = {
  id: string
  title: string
  subjectId: string
  subjectName: string
  status: "draft" | "published"
  opensAt: string
  closesAt: string
  durationMinutes: number
  totalMarks: number
  questionCount: number
}

export type PaperQuestion = {
  id: string
  stem: string
  marks: number
  options: { label: string; body: string; isCorrect: boolean }[]
}

export async function loadPaperDesk() {
  const { supabase } = await staffContext()
  const [subjects, papers] = await Promise.all([
    subjectChoices(),
    supabase
      .from("question_papers")
      .select("id, title, subject_id, status, opens_at, closes_at, duration_minutes, total_marks, subjects(name), question_paper_questions(question_id)")
      .order("created_at", { ascending: false }),
  ])
  if (papers.error) throw new QueryError()
  return { subjects, papers: (papers.data ?? []).flatMap(toSummary) }
}

export async function loadPaper(id: string) {
  const { supabase } = await staffContext()
  const paper = await supabase
    .from("question_papers")
    .select(
      "id, title, subject_id, status, opens_at, closes_at, duration_minutes, total_marks, subjects(name), question_paper_questions(ordinal, marks, questions(id, stem, question_options(label, option_text, is_correct, ordinal)))",
    )
    .eq("id", id)
    .maybeSingle()
  if (paper.error) throw new QueryError()
  const summary = toSummary(paper.data)
  if (summary.length === 0 || !isRecord(paper.data)) return null
  const links = Array.isArray(paper.data.question_paper_questions) ? paper.data.question_paper_questions : []
  const questions = links.flatMap(toPaperQuestion).sort((left, right) => left.ordinal - right.ordinal)
  const bank = await supabase
    .from("questions")
    .select("id, stem")
    .eq("subject_id", summary[0].subjectId)
    .order("stem")
  if (bank.error) throw new QueryError()
  const used = new Set(questions.map((question) => question.id))
  return {
    paper: summary[0],
    questions: questions.map(({ ordinal: _ordinal, ...question }) => question),
    available: (bank.data ?? []).flatMap((row) => {
      if (!isRecord(row) || typeof row.id !== "string" || typeof row.stem !== "string" || used.has(row.id)) return []
      return [{ id: row.id, stem: row.stem }]
    }),
  }
}

export async function createPaper(_previous: FormState, formData: FormData): Promise<FormState> {
  const parsed = paperSchema.safeParse({
    subjectId: field(formData, "subjectId"),
    title: field(formData, "title"),
    durationMinutes: field(formData, "durationMinutes"),
    opensAt: field(formData, "opensAt"),
    closesAt: field(formData, "closesAt"),
  })
  if (!parsed.success) return fail("The open time has to be before the close time.")
  const { profile, supabase } = await staffContext()
  const result = await supabase
    .from("question_papers")
    .insert({
      subject_id: parsed.data.subjectId,
      title: parsed.data.title,
      duration_minutes: parsed.data.durationMinutes,
      opens_at: parsed.data.opensAt,
      closes_at: parsed.data.closesAt,
      created_by: profile.id,
    })
    .select("id")
    .maybeSingle()
  if (result.error || !isRecord(result.data) || typeof result.data.id !== "string") {
    return fail(actionError(result.error))
  }
  const base = profile.role === "admin" ? "/admin/papers" : "/teacher/papers"
  refreshAcademic([`${base}/${result.data.id}`])
  return ok("Draft paper saved.")
}

export async function addPaperQuestion(_previous: FormState, formData: FormData): Promise<FormState> {
  const parsed = paperQuestionSchema.safeParse({
    paperId: field(formData, "paperId"),
    questionId: field(formData, "questionId"),
  })
  if (!parsed.success) return fail("Choose a question from this subject.")
  const { supabase } = await staffContext()
  const question = await supabase.from("questions").select("marks").eq("id", parsed.data.questionId).maybeSingle()
  if (question.error || !isRecord(question.data) || typeof question.data.marks !== "number") {
    return fail("Choose a question from this subject.")
  }
  const existing = await supabase
    .from("question_paper_questions")
    .select("ordinal")
    .eq("paper_id", parsed.data.paperId)
    .order("ordinal", { ascending: false })
    .limit(1)
  if (existing.error) return fail(actionError(existing.error))
  const top = existing.data?.[0]
  const ordinal = isRecord(top) && typeof top.ordinal === "number" ? top.ordinal + 1 : 0
  const inserted = await supabase.from("question_paper_questions").insert({
    paper_id: parsed.data.paperId,
    question_id: parsed.data.questionId,
    ordinal,
    marks: question.data.marks,
  })
  if (inserted.error) return fail(actionError(inserted.error))
  refreshAcademic([`/admin/papers/${parsed.data.paperId}`, `/teacher/papers/${parsed.data.paperId}`])
  return ok("Question added.")
}

export async function removePaperQuestion(_previous: FormState, formData: FormData): Promise<FormState> {
  const parsed = paperQuestionSchema.safeParse({
    paperId: field(formData, "paperId"),
    questionId: field(formData, "questionId"),
  })
  if (!parsed.success) return fail("That question could not be found.")
  const { supabase } = await staffContext()
  const result = await supabase
    .from("question_paper_questions")
    .delete()
    .eq("paper_id", parsed.data.paperId)
    .eq("question_id", parsed.data.questionId)
  if (result.error) return fail(actionError(result.error))
  refreshAcademic([`/admin/papers/${parsed.data.paperId}`, `/teacher/papers/${parsed.data.paperId}`])
  return ok("Question removed.")
}

export async function publishPaper(_previous: FormState, formData: FormData): Promise<FormState> {
  const paperId = field(formData, "paperId")
  if (!paperId) return fail("That paper could not be found.")
  const { supabase } = await staffContext()
  const result = await supabase.rpc("publish_question_paper", { target_paper: paperId })
  if (result.error) return fail(actionError(result.error))
  refreshAcademic([`/admin/papers/${paperId}`, `/teacher/papers/${paperId}`, "/student/tests"])
  return ok("Paper published. Its questions are now frozen.")
}

function toSummary(value: unknown): PaperSummary[] {
  if (
    !isRecord(value) ||
    typeof value.id !== "string" ||
    typeof value.title !== "string" ||
    typeof value.subject_id !== "string" ||
    (value.status !== "draft" && value.status !== "published") ||
    typeof value.opens_at !== "string" ||
    typeof value.closes_at !== "string" ||
    typeof value.duration_minutes !== "number" ||
    typeof value.total_marks !== "number"
  ) {
    return []
  }
  const links = Array.isArray(value.question_paper_questions) ? value.question_paper_questions : []
  return [
    {
      id: value.id,
      title: value.title,
      subjectId: value.subject_id,
      subjectName: relatedName(value.subjects, "name") || "Subject",
      status: value.status,
      opensAt: value.opens_at,
      closesAt: value.closes_at,
      durationMinutes: value.duration_minutes,
      totalMarks: value.total_marks,
      questionCount: links.length,
    },
  ]
}

function toPaperQuestion(value: unknown) {
  if (!isRecord(value) || typeof value.ordinal !== "number" || typeof value.marks !== "number") return []
  const question = Array.isArray(value.questions) ? value.questions[0] : value.questions
  if (!isRecord(question) || typeof question.id !== "string" || typeof question.stem !== "string") return []
  const options = Array.isArray(question.question_options) ? question.question_options.flatMap(toOption) : []
  options.sort((left, right) => left.ordinal - right.ordinal)
  return [
    {
      ordinal: value.ordinal,
      id: question.id,
      stem: question.stem,
      marks: value.marks,
      options: options.map(({ ordinal: _ordinal, ...option }) => option),
    },
  ]
}

function toOption(value: unknown) {
  if (
    !isRecord(value) ||
    typeof value.label !== "string" ||
    typeof value.option_text !== "string" ||
    typeof value.is_correct !== "boolean" ||
    typeof value.ordinal !== "number"
  ) {
    return []
  }
  return [{ label: value.label, body: value.option_text, isCorrect: value.is_correct, ordinal: value.ordinal }]
}

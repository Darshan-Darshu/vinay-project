"use server"

import { actionError, fail, field, ok, refreshAcademic, relatedName, studentContext } from "@/actions/academics/shared"
import type { FormState } from "@/actions/form-state"
import { isRecord, QueryError } from "@/lib/db/errors"
import { attemptSchema } from "@/lib/validations/academics"

export type TestSummary = {
  id: string
  title: string
  subjectName: string
  opensAt: string
  closesAt: string
  durationMinutes: number
  maxScore: number
  attemptStatus: "in_progress" | "submitted" | "expired" | null
  score: number | null
}

export type AttemptOption = {
  id: string
  label: string
  body: string
  isCorrect: boolean | null
}

export type AttemptQuestion = {
  id: string
  stem: string
  marks: number
  explanation: string | null
  selectedOptionId: string | null
  options: AttemptOption[]
}

export type StudentPaper = {
  id: string
  title: string
  subjectName: string
  durationMinutes: number
  opensAt: string
  closesAt: string
  maxScore: number
  attemptId: string | null
  attemptStatus: "in_progress" | "submitted" | "expired" | null
  score: number | null
  questions: AttemptQuestion[]
}

export async function loadTests() {
  const { profile, supabase } = await studentContext()
  const student = await supabase
    .from("students")
    .select("course_id")
    .eq("profile_id", profile.id)
    .is("deleted_at", null)
    .maybeSingle()
  if (student.error) throw new QueryError()
  const courseId = isRecord(student.data) && typeof student.data.course_id === "string" ? student.data.course_id : null
  if (!courseId) return { enrolled: false as const, tests: [] as TestSummary[] }

  const expired = await supabase.rpc("expire_my_closed_attempts")
  if (expired.error) throw new QueryError()
  const papers = await supabase
    .from("question_papers")
    .select("id, title, opens_at, closes_at, duration_minutes, total_marks, subjects(name), test_attempts(status, score, max_score)")
    .eq("status", "published")
    .order("opens_at", { ascending: false })
  if (papers.error) throw new QueryError()
  return { enrolled: true as const, tests: (papers.data ?? []).flatMap(toSummary) }
}

export async function loadStudentPaper(paperId: string) {
  const { supabase } = await studentContext()
  const result = await supabase.rpc("student_paper", { target_paper: paperId })
  if (result.error) return { error: actionError(result.error), paper: null }
  const paper = toPaper(result.data)
  if (!paper) return { error: "This paper is not open.", paper: null }
  return { error: null, paper }
}

export async function startAttempt(_previous: FormState, formData: FormData): Promise<FormState> {
  const paperId = field(formData, "paperId")
  if (!paperId) return fail("This paper is not open.")
  const { supabase } = await studentContext()
  const result = await supabase.rpc("start_test_attempt", { target_paper: paperId })
  if (result.error) return fail(actionError(result.error))
  refreshAcademic([`/student/tests/${paperId}`])
  return ok("Attempt started.")
}

export async function saveAttempt(_previous: FormState, formData: FormData): Promise<FormState> {
  const parsed = attemptSchema.safeParse({
    attemptId: field(formData, "attemptId"),
    intent: field(formData, "intent"),
    answers: readAnswers(formData),
  })
  if (!parsed.success) return fail("Check the form and try again.")
  const paperId = field(formData, "paperId")
  const { supabase } = await studentContext()
  const result =
    parsed.data.intent === "submit"
      ? await supabase.rpc("submit_test_attempt", {
          target_attempt: parsed.data.attemptId,
          answers: parsed.data.answers,
        })
      : await supabase.rpc("save_test_answers", {
          target_attempt: parsed.data.attemptId,
          answers: parsed.data.answers,
        })
  if (result.error) return fail(actionError(result.error))
  refreshAcademic([`/student/tests/${paperId}`])
  if (parsed.data.intent === "submit") {
    return ok(`Submitted. Score: ${typeof result.data === "number" ? result.data : 0}.`)
  }
  return ok("Progress saved.")
}

function readAnswers(formData: FormData) {
  return formData
    .getAll("questionId")
    .filter((value): value is string => typeof value === "string")
    .flatMap((questionId) => {
      const optionId = formData.get(`option-${questionId}`)
      return typeof optionId === "string" && optionId ? [{ questionId, optionId }] : []
    })
}

function toSummary(value: unknown): TestSummary[] {
  if (
    !isRecord(value) ||
    typeof value.id !== "string" ||
    typeof value.title !== "string" ||
    typeof value.opens_at !== "string" ||
    typeof value.closes_at !== "string" ||
    typeof value.duration_minutes !== "number" ||
    typeof value.total_marks !== "number"
  ) {
    return []
  }
  const attempt = Array.isArray(value.test_attempts) ? value.test_attempts[0] : value.test_attempts
  const status =
    isRecord(attempt) &&
    (attempt.status === "in_progress" || attempt.status === "submitted" || attempt.status === "expired")
      ? attempt.status
      : null
  return [
    {
      id: value.id,
      title: value.title,
      subjectName: relatedName(value.subjects, "name") || "Subject",
      opensAt: value.opens_at,
      closesAt: value.closes_at,
      durationMinutes: value.duration_minutes,
      maxScore: isRecord(attempt) && typeof attempt.max_score === "number" ? attempt.max_score : value.total_marks,
      attemptStatus: status,
      score: isRecord(attempt) && typeof attempt.score === "number" ? attempt.score : null,
    },
  ]
}

function toPaper(value: unknown): StudentPaper | null {
  if (
    !isRecord(value) ||
    typeof value.id !== "string" ||
    typeof value.title !== "string" ||
    typeof value.subjectName !== "string" ||
    typeof value.durationMinutes !== "number" ||
    typeof value.opensAt !== "string" ||
    typeof value.closesAt !== "string" ||
    typeof value.maxScore !== "number" ||
    !Array.isArray(value.questions)
  ) {
    return null
  }
  const status = value.attemptStatus
  return {
    id: value.id,
    title: value.title,
    subjectName: value.subjectName,
    durationMinutes: value.durationMinutes,
    opensAt: value.opensAt,
    closesAt: value.closesAt,
    maxScore: value.maxScore,
    attemptId: typeof value.attemptId === "string" ? value.attemptId : null,
    attemptStatus: status === "in_progress" || status === "submitted" || status === "expired" ? status : null,
    score: typeof value.score === "number" ? value.score : null,
    questions: value.questions.flatMap(toQuestion),
  }
}

function toQuestion(value: unknown): AttemptQuestion[] {
  if (!isRecord(value) || typeof value.id !== "string" || typeof value.stem !== "string" || typeof value.marks !== "number") {
    return []
  }
  const options = Array.isArray(value.options) ? value.options.flatMap(toOption) : []
  return [
    {
      id: value.id,
      stem: value.stem,
      marks: value.marks,
      explanation: typeof value.explanation === "string" ? value.explanation : null,
      selectedOptionId: typeof value.selectedOptionId === "string" ? value.selectedOptionId : null,
      options,
    },
  ]
}

function toOption(value: unknown): AttemptOption[] {
  if (!isRecord(value) || typeof value.id !== "string" || typeof value.label !== "string" || typeof value.body !== "string") {
    return []
  }
  return [
    {
      id: value.id,
      label: value.label,
      body: value.body,
      isCorrect: typeof value.isCorrect === "boolean" ? value.isCorrect : null,
    },
  ]
}

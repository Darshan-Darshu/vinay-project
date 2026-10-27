"use server"

import { redirect } from "next/navigation"
import { z } from "zod"

import { actionError, fail, field, refreshAcademic, relatedName, staffContext, subjectChoices } from "@/actions/academics/shared"
import type { FormState } from "@/actions/form-state"
import type { SectionMark } from "@/lib/ai/exam-paper"
import { isRecord, QueryError } from "@/lib/db/errors"

export type ExamPaperSummary = {
  id: string
  title: string
  subjectName: string
  difficulty: "easy" | "medium" | "hard"
  totalMarks: number
  questionCount: number
}

export type ExamPaperQuestion = {
  ordinal: number
  sectionMarks: SectionMark
  stem: string
}

export type ExamPaperDetail = ExamPaperSummary & {
  topics: string
  questions: ExamPaperQuestion[]
}

export async function loadExamPaperDesk() {
  const { supabase } = await staffContext()
  const [subjects, papers] = await Promise.all([
    subjectChoices(),
    supabase
      .from("exam_papers")
      .select("id, title, difficulty, total_marks, subjects(name), exam_paper_questions(id)")
      .order("created_at", { ascending: false }),
  ])
  if (papers.error) throw new QueryError()
  return { subjects, papers: (papers.data ?? []).flatMap(toSummary) }
}

export async function loadExamPaper(id: string) {
  const { supabase } = await staffContext()
  const paper = await supabase
    .from("exam_papers")
    .select("id, title, topics, difficulty, total_marks, subjects(name), exam_paper_questions(section_marks, ordinal, stem)")
    .eq("id", id)
    .maybeSingle()
  if (paper.error) throw new QueryError()
  return toDetail(paper.data)
}

export async function deleteExamPaper(_previous: FormState, formData: FormData): Promise<FormState> {
  const paperId = field(formData, "paperId")
  if (!z.string().uuid().safeParse(paperId).success) return fail("That paper could not be found.")
  const { profile, supabase } = await staffContext()
  const result = await supabase.from("exam_papers").delete().eq("id", paperId).select("id")
  if (result.error) return fail(actionError(result.error))
  if (!result.data?.length) return fail("That paper could not be found.")
  const base = profile.role === "admin" ? "/admin/exam-papers" : "/teacher/exam-papers"
  refreshAcademic([base, `/admin/exam-papers/${paperId}`, `/teacher/exam-papers/${paperId}`])
  redirect(base)
}

function toSummary(value: unknown): ExamPaperSummary[] {
  if (!isRecord(value) || typeof value.id !== "string" || typeof value.title !== "string" || typeof value.total_marks !== "number") {
    return []
  }
  if (value.difficulty !== "easy" && value.difficulty !== "medium" && value.difficulty !== "hard") return []
  const questions = Array.isArray(value.exam_paper_questions) ? value.exam_paper_questions : []
  return [
    {
      id: value.id,
      title: value.title,
      subjectName: relatedName(value.subjects, "name"),
      difficulty: value.difficulty,
      totalMarks: value.total_marks,
      questionCount: questions.length,
    },
  ]
}

function toDetail(value: unknown): ExamPaperDetail | null {
  const summary = toSummary(value)
  if (summary.length === 0 || !isRecord(value) || typeof value.topics !== "string") return null
  const links = Array.isArray(value.exam_paper_questions) ? value.exam_paper_questions : []
  return {
    ...summary[0],
    topics: value.topics,
    questions: links.flatMap(toQuestion).sort((left, right) => left.ordinal - right.ordinal),
  }
}

function toQuestion(value: unknown): ExamPaperQuestion[] {
  if (!isRecord(value) || typeof value.stem !== "string" || typeof value.ordinal !== "number") return []
  if (value.section_marks !== 1 && value.section_marks !== 2 && value.section_marks !== 5 && value.section_marks !== 20) {
    return []
  }
  return [{ ordinal: value.ordinal, sectionMarks: value.section_marks, stem: value.stem }]
}

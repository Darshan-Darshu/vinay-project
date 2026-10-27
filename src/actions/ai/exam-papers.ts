"use server"

import { redirect } from "next/navigation"
import { z } from "zod"

import { actionError, fail, field, refreshAcademic, staffContext, subjectChoices, taughtSubjectIds } from "@/actions/academics/shared"
import type { FormState } from "@/actions/form-state"
import { generationFailed } from "@/lib/ai/errors"
import { canGenerateExamPaper, examPaperBands, parseExamSection, type SectionMark } from "@/lib/ai/exam-paper"
import { generateJson } from "@/lib/ai/model"
import { recordUsage, type AiFeature } from "@/lib/ai/usage"

const feature: AiFeature = "exam_paper"

const formSchema = z.object({
  subjectId: z.string().uuid(),
  title: z.string().trim().min(1).max(160),
  topics: z.string().trim().min(1).max(500),
  difficulty: z.enum(["easy", "medium", "hard"]),
  one: z.number().int(),
  two: z.number().int(),
  five: z.number().int(),
  twenty: z.number().int(),
})

function sectionSchema(count: number) {
  return z.object({
    questions: z.array(z.object({ stem: z.string() })).length(count),
  })
}

export async function generateExamPaper(_previous: FormState, formData: FormData): Promise<FormState> {
  const parsed = formSchema.safeParse({
    subjectId: field(formData, "subjectId"),
    title: field(formData, "title"),
    topics: field(formData, "topics"),
    difficulty: field(formData, "difficulty"),
    one: Number(field(formData, "one")),
    two: Number(field(formData, "two")),
    five: Number(field(formData, "five")),
    twenty: Number(field(formData, "twenty")),
  })
  if (!parsed.success) return fail("Check the form and try again.")
  const counts = {
    one: parsed.data.one,
    two: parsed.data.two,
    five: parsed.data.five,
    twenty: parsed.data.twenty,
  }
  if (!canGenerateExamPaper(counts)) return fail("Check the form and try again.")

  const { profile, supabase } = await staffContext()
  const allowed = await taughtSubjectIds()
  if (!allowed.has(parsed.data.subjectId)) return fail("You do not have permission to edit this question.")
  const subjects = await subjectChoices()
  const subject = subjects.find((item) => item.id === parsed.data.subjectId)
  if (!subject) return fail("You do not have permission to edit this question.")

  const questions: { sectionMarks: SectionMark; stem: string }[] = []
  for (const band of examPaperBands) {
    const count = counts[band.key]
    if (count === 0) continue
    const generated = await generateJson(
      sectionSchema(count),
      "You write college written exam questions. Return only the requested JSON. Each item is a question stem. Do not include an answer, options, or a question number. Do not write multiple choice or true or false.",
      `Write exactly ${count} distinct ${parsed.data.difficulty} written questions for ${subject.name}. Topics: ${parsed.data.topics}. Each question is worth exactly ${band.marks} marks.`,
    )
    if (!generated) return fail(generationFailed)
    const stems = generated.object ? parseExamSection(generated.object.questions, count) : null
    await recordUsage({
      profileId: profile.id,
      role: profile.role,
      model: generated.modelName,
      feature,
      latencyMs: generated.latencyMs,
      promptTokens: generated.promptTokens,
      completionTokens: generated.completionTokens,
      status: stems ? "ok" : "error",
    })
    if (!stems) return fail(generationFailed)
    for (const stem of stems) questions.push({ sectionMarks: band.marks, stem })
  }

  const saved = await supabase.rpc("save_exam_paper", {
    paper: {
      subjectId: parsed.data.subjectId,
      title: parsed.data.title,
      topics: parsed.data.topics,
      difficulty: parsed.data.difficulty,
      questions,
    },
  })
  if (saved.error || typeof saved.data !== "string") return fail(actionError(saved.error))

  const base = profile.role === "admin" ? "/admin/exam-papers" : "/teacher/exam-papers"
  refreshAcademic([base, `${base}/${saved.data}`])
  redirect(`${base}/${saved.data}`)
}

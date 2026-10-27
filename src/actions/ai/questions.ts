"use server"

import { z } from "zod"

import { fail, field, ok, refreshAcademic, staffContext, taughtSubjectIds } from "@/actions/academics/shared"
import type { FormState } from "@/actions/form-state"
import { generationFailed } from "@/lib/ai/errors"
import { generateJson } from "@/lib/ai/model"
import { parseQuestionBatch } from "@/lib/ai/question-batch"
import { recordUsage } from "@/lib/ai/usage"

const draftSchema = z.object({
  questions: z.array(
    z.object({
      questionType: z.enum(["mcq", "true_false"]),
      difficulty: z.enum(["easy", "medium", "hard"]),
      marks: z.number().int(),
      stem: z.string(),
      explanation: z.string(),
      options: z.array(z.object({ body: z.string(), isCorrect: z.boolean() })),
    }),
  ),
})

export async function generateQuestionDrafts(_previous: FormState, formData: FormData): Promise<FormState> {
  const subjectId = field(formData, "subjectId")
  const topic = field(formData, "topic").trim()
  const count = Number(field(formData, "count"))
  const difficulty = field(formData, "difficulty")
  if (!subjectId || !topic || !Number.isInteger(count) || count < 1 || count > 10) {
    return fail("Check the form and try again.")
  }
  if (difficulty !== "easy" && difficulty !== "medium" && difficulty !== "hard") {
    return fail("Check the form and try again.")
  }

  const { profile, supabase } = await staffContext()
  const allowed = await taughtSubjectIds()
  if (!allowed.has(subjectId)) return fail("You do not have permission to edit this question.")

  const generated = await generateJson(
    draftSchema,
    "You write college exam questions. Return only the requested JSON. Each question has exactly one correct option. True or false questions have exactly two options. Multiple choice questions have two to six options. Do not publish anything.",
    `Write ${count} ${difficulty} questions about ${topic}. Use question types mcq and true_false. Marks are integers from 1 to 100.`,
  )
  if (!generated) return fail(generationFailed)
  if (!generated.object) {
    await recordUsage({
      profileId: profile.id,
      role: profile.role,
      model: generated.modelName,
      feature: "question_drafts",
      latencyMs: generated.latencyMs,
      promptTokens: generated.promptTokens,
      completionTokens: generated.completionTokens,
      status: "error",
    })
    return fail(generationFailed)
  }

  const batch = parseQuestionBatch(generated.object.questions)
  if (!batch || batch.length !== count) {
    await recordUsage({
      profileId: profile.id,
      role: profile.role,
      model: generated.modelName,
      feature: "question_drafts",
      latencyMs: generated.latencyMs,
      promptTokens: generated.promptTokens,
      completionTokens: generated.completionTokens,
      status: "error",
    })
    return fail(generationFailed)
  }

  const saved = await supabase.rpc("save_ai_questions", {
    target_subject: subjectId,
    questions: batch.map((question) => ({ ...question, topic })),
  })
  if (saved.error || !saved.data) return fail(generationFailed)

  await recordUsage({
    profileId: profile.id,
    role: profile.role,
    model: generated.modelName,
    feature: "question_drafts",
    latencyMs: generated.latencyMs,
    promptTokens: generated.promptTokens,
    completionTokens: generated.completionTokens,
    status: "ok",
  })
  refreshAcademic()
  return ok("Draft questions saved.")
}

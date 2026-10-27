import { z } from "zod"

import { normalizeSkills } from "@/lib/academics/skills"

const optionalId = z.union([z.literal(""), z.uuid()]).transform((value) => value || null)

export const questionSchema = z.object({
  id: optionalId,
  subjectId: z.uuid(),
  topic: z.string().trim().max(120),
  questionType: z.enum(["mcq", "true_false"]),
  difficulty: z.enum(["easy", "medium", "hard"]),
  marks: z.coerce.number().int().min(1).max(100),
  stem: z.string().trim().min(1).max(4000),
  explanation: z.string().trim().max(4000),
  options: z
    .array(
      z.object({
        body: z.string().trim().min(1).max(1000),
        isCorrect: z.boolean(),
      }),
    )
    .min(2)
    .max(6)
    .refine((options) => options.filter((option) => option.isCorrect).length === 1, {
      message: "Choose one correct option.",
    }),
})

export const paperSchema = z
  .object({
    subjectId: z.uuid(),
    title: z.string().trim().min(1).max(160),
    durationMinutes: z.coerce.number().int().min(1).max(300),
    opensAt: z.string().trim().min(1),
    closesAt: z.string().trim().min(1),
  })
  .superRefine((value, ctx) => {
    const opens = Date.parse(value.opensAt)
    const closes = Date.parse(value.closesAt)
    if (Number.isNaN(opens)) ctx.addIssue({ code: "custom", path: ["opensAt"] })
    if (Number.isNaN(closes) || closes <= opens) ctx.addIssue({ code: "custom", path: ["closesAt"] })
  })
  .transform((value) => ({
    ...value,
    opensAt: new Date(value.opensAt).toISOString(),
    closesAt: new Date(value.closesAt).toISOString(),
  }))

export const paperQuestionSchema = z.object({
  paperId: z.uuid(),
  questionId: z.uuid(),
})

export const materialSchema = z
  .object({
    subjectId: z.uuid(),
    title: z.string().trim().min(1).max(160),
    kind: z.enum(["pdf", "link"]),
    externalUrl: z.string().trim().max(2000),
    approvedForRag: z.boolean(),
  })
  .superRefine((value, ctx) => {
    if (value.kind !== "link") return
    try {
      const url = new URL(value.externalUrl)
      if (url.protocol !== "https:" && url.protocol !== "http:") {
        ctx.addIssue({ code: "custom", path: ["externalUrl"] })
      }
    } catch {
      ctx.addIssue({ code: "custom", path: ["externalUrl"] })
    }
  })

export const resumeSchema = z.object({
  skills: z
    .string()
    .trim()
    .max(2000)
    .transform(normalizeSkills)
    .refine((skills) => skills.length <= 40 && skills.every((skill) => skill.length <= 40), {
      message: "Enter at most 40 skills, each 40 characters or fewer.",
    }),
})

export const attemptSchema = z.object({
  attemptId: z.uuid(),
  intent: z.enum(["save", "submit"]),
  answers: z.array(
    z.object({
      questionId: z.uuid(),
      optionId: z.uuid(),
    }),
  ),
})

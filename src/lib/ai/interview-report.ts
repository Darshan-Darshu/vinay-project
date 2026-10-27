import { z } from "zod"

const commentSchema = z.object({
  main: z.number().int().min(1).max(5),
  comment: z.string().trim().min(1),
})

const shortList = z.array(z.string().trim().min(1)).min(1).max(4)

export const interviewReportSchema = z
  .object({
    score: z.number().int().min(0).max(100),
    summary: z.string().trim().min(1),
    questionComments: z.array(commentSchema).length(5),
    strengths: shortList,
    gaps: shortList,
    nextSteps: shortList,
  })
  .superRefine((value, context) => {
    const mains = value.questionComments.map((comment) => comment.main).sort((left, right) => left - right)
    if (mains.join(",") !== "1,2,3,4,5") {
      context.addIssue({
        code: "custom",
        message: "Question comments must cover mains 1 through 5.",
        path: ["questionComments"],
      })
    }
  })

export type InterviewReport = z.infer<typeof interviewReportSchema>

export type InterviewExchange = {
  main: number
  question: string
  answer: string
  followUp: string
  followUpAnswer: string
}

export type InterviewPending = {
  main: number
  kind: "question" | "follow_up"
  prompt: string
}

type GroupedTurn = {
  kind: "question" | "follow_up" | "answer"
  content: string
}

export function groupInterviewTurns(turns: GroupedTurn[]): {
  exchanges: InterviewExchange[]
  pending: InterviewPending | null
} {
  const exchanges: InterviewExchange[] = []
  let pending: InterviewPending | null = null

  for (const turn of turns) {
    if (turn.kind === "question") {
      pending = { main: exchanges.length + 1, kind: "question", prompt: turn.content }
      continue
    }
    if (turn.kind === "follow_up") {
      pending = { main: exchanges.length, kind: "follow_up", prompt: turn.content }
      continue
    }
    if (!pending) continue
    if (pending.kind === "question") {
      exchanges.push({
        main: pending.main,
        question: pending.prompt,
        answer: turn.content,
        followUp: "",
        followUpAnswer: "",
      })
    } else {
      const current = exchanges[exchanges.length - 1]
      if (current) {
        current.followUp = pending.prompt
        current.followUpAnswer = turn.content
      }
    }
    pending = null
  }

  return { exchanges, pending }
}

export function commentFor(report: InterviewReport, main: number) {
  return report.questionComments.find((comment) => comment.main === main)?.comment ?? ""
}

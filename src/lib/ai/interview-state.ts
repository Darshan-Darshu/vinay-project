import { z } from "zod"

export const interviewTurnSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("follow_up"), question: z.string().min(1) }),
  z.object({ kind: z.literal("question"), question: z.string().min(1) }),
  z.object({ kind: z.literal("close") }),
])

export type InterviewPhase = {
  mainCount: number
  followUpPending: boolean
  completed: boolean
  awaitingReport: boolean
}

export type InterviewTurn =
  | { kind: "follow_up"; question: string }
  | { kind: "question"; question: string }
  | { kind: "close" }

export function acceptInterviewTurn(phase: InterviewPhase, turn: InterviewTurn): InterviewPhase | null {
  if (phase.completed || phase.awaitingReport || phase.mainCount < 0 || phase.mainCount > 5) return null

  if (phase.mainCount === 0) {
    if (turn.kind !== "question" || !hasText(turn.question)) return null
    return resting(1, false)
  }

  if (phase.followUpPending) {
    if (phase.mainCount === 5) return turn.kind === "close" ? awaitingReport() : null
    if (turn.kind !== "question" || !hasText(turn.question)) return null
    return resting(phase.mainCount + 1, false)
  }

  if (phase.mainCount < 5) {
    if (turn.kind === "follow_up" && hasText(turn.question)) return resting(phase.mainCount, true)
    if (turn.kind === "question" && hasText(turn.question)) return resting(phase.mainCount + 1, false)
    return null
  }

  if (turn.kind === "follow_up" && hasText(turn.question)) return resting(5, true)
  if (turn.kind === "close") return awaitingReport()
  return null
}

function resting(mainCount: number, followUpPending: boolean): InterviewPhase {
  return { mainCount, followUpPending, completed: false, awaitingReport: false }
}

function awaitingReport(): InterviewPhase {
  return { mainCount: 5, followUpPending: false, completed: false, awaitingReport: true }
}

function hasText(value: string) {
  return value.trim().length > 0
}

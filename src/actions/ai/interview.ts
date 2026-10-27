"use server"

import { fail, field, ok, studentContext } from "@/actions/academics/shared"
import type { FormState } from "@/actions/form-state"
import { generationFailed } from "@/lib/ai/errors"
import { groupInterviewTurns, interviewReportSchema, type InterviewReport } from "@/lib/ai/interview-report"
import { acceptInterviewTurn, interviewTurnSchema, type InterviewPhase } from "@/lib/ai/interview-state"
import { generateJson } from "@/lib/ai/model"
import { recordUsage } from "@/lib/ai/usage"
import { isRecord, QueryError } from "@/lib/db/errors"
import { revalidatePath } from "next/cache"

const savedWithoutReport = "Answer saved. The report could not be written yet."
const sessionSelect =
  "id, role_title, status, score, feedback, report, created_at, main_count, follow_up_pending, interview_turns(ordinal, kind, content)"

export type InterviewTurnView = {
  kind: "question" | "follow_up" | "answer"
  content: string
}

export type InterviewSessionView = {
  id: string
  roleTitle: string
  status: "in_progress" | "awaiting_report" | "completed"
  score: number | null
  feedback: string
  report: InterviewReport | null
  createdAt: string
  mainCount: number
  followUpPending: boolean
  turns: InterviewTurnView[]
}

export type InterviewDrive = {
  id: string
  label: string
}

type StudentBundle = Awaited<ReturnType<typeof studentContext>>

export async function loadInterviewDesk() {
  const { supabase } = await studentContext()
  const [drives, sessions] = await Promise.all([
    supabase.from("placement_drives").select("id, company_name, role_title").eq("status", "open").order("company_name"),
    supabase.from("interview_sessions").select(sessionSelect).order("created_at", { ascending: false }),
  ])
  if (drives.error || sessions.error) throw new QueryError()
  return {
    drives: (drives.data ?? []).flatMap(toDrive),
    sessions: (sessions.data ?? []).flatMap((row) => {
      const session = toSession(row)
      return session ? [session] : []
    }),
  }
}

export async function startInterview(_previous: FormState, formData: FormData): Promise<FormState> {
  const driveId = field(formData, "driveId")
  const typedRole = field(formData, "roleTitle").trim()
  const { profile, supabase } = await studentContext()
  const active = await supabase
    .from("interview_sessions")
    .select("id")
    .in("status", ["in_progress", "awaiting_report"])
    .maybeSingle()
  if (active.error) return fail(generationFailed)
  if (isRecord(active.data)) return fail("You already have an interview in progress.")

  let roleTitle = typedRole
  if (driveId) {
    const drive = await supabase
      .from("placement_drives")
      .select("role_title, status")
      .eq("id", driveId)
      .maybeSingle()
    if (!isRecord(drive.data) || drive.data.status !== "open" || typeof drive.data.role_title !== "string") {
      return fail("Choose an open drive or type a role.")
    }
    roleTitle = drive.data.role_title
  } else if (!roleTitle) {
    return fail("Choose an open drive or type a role.")
  }

  const opening: InterviewPhase = { mainCount: 0, followUpPending: false, completed: false, awaitingReport: false }
  const generated = await askModel(opening, `Role: ${roleTitle}. Ask the first interview question.`)
  if (!generated) return fail(generationFailed)
  if (!generated.object) {
    await logTurn(profile, generated, "error")
    return fail(generationFailed)
  }
  const accepted = acceptInterviewTurn(opening, generated.object)
  if (!accepted || generated.object.kind !== "question") {
    await logTurn(profile, generated, "error")
    return fail(generationFailed)
  }

  const started = await supabase.rpc("begin_interview", {
    target_drive: driveId || null,
    requested_role: driveId ? "" : roleTitle,
  })
  if (started.error || typeof started.data !== "string") {
    await logTurn(profile, generated, "error")
    return fail(knownOr(started.error?.message, generationFailed))
  }
  const opened = await supabase.rpc("open_interview_question", {
    target_session: started.data,
    question_text: generated.object.question,
  })
  if (opened.error) {
    await supabase.rpc("cancel_empty_interview", { target_session: started.data })
    await logTurn(profile, generated, "error")
    return fail(generationFailed)
  }
  await logTurn(profile, generated, "ok")
  revalidatePath("/student/interview")
  return ok("Interview started.")
}

export async function answerInterview(_previous: FormState, formData: FormData): Promise<FormState> {
  const sessionId = field(formData, "sessionId")
  const answer = field(formData, "answer").trim()
  if (!sessionId || !answer) return fail("Write an answer before submitting.")
  const { profile, supabase } = await studentContext()
  const existing = await supabase.from("interview_sessions").select(sessionSelect).eq("id", sessionId).maybeSingle()
  const session = toSession(existing.data)
  if (!session || session.status !== "in_progress") return fail("That interview could not be found.")

  const phase: InterviewPhase = {
    mainCount: session.mainCount,
    followUpPending: session.followUpPending,
    completed: false,
    awaitingReport: false,
  }
  if (phase.followUpPending && phase.mainCount === 5) {
    return closeAndReport(profile, supabase, sessionId, answer)
  }

  const transcript = session.turns.map((turn) => `${turn.kind}: ${turn.content}`).join("\n")
  const generated = await askModel(
    phase,
    `Role: ${session.roleTitle}\n${transcript}\nanswer: ${answer}\nRespond with the single next JSON kind that this state allows.`,
  )
  if (!generated) return fail(generationFailed)
  if (!generated.object) {
    await logTurn(profile, generated, "error")
    return fail(generationFailed)
  }
  const accepted = acceptInterviewTurn(phase, generated.object)
  if (!accepted) {
    await logTurn(profile, generated, "error")
    return fail(generationFailed)
  }

  if (generated.object.kind === "close") {
    await logTurn(profile, generated, "ok")
    return closeAndReport(profile, supabase, sessionId, answer)
  }

  const advanced = await supabase.rpc("advance_interview", {
    target_session: sessionId,
    answer_text: answer,
    turn_kind: generated.object.kind,
    turn_text: generated.object.question,
    turn_score: null,
    turn_feedback: "",
  })
  if (advanced.error) return fail(generationFailed)
  await recordUsage({
    profileId: profile.id,
    role: profile.role,
    model: generated.modelName,
    feature: "interview_turn",
    latencyMs: generated.latencyMs,
    promptTokens: generated.promptTokens,
    completionTokens: generated.completionTokens,
    status: "ok",
  })
  revalidatePath("/student/interview")
  return ok("Answer saved.")
}

export async function writeInterviewReport(_previous: FormState, formData: FormData): Promise<FormState> {
  const sessionId = field(formData, "sessionId")
  if (!sessionId) return fail("That interview could not be found.")
  const { profile, supabase } = await studentContext()
  return requestInterviewReport(profile, supabase, sessionId, generationFailed)
}

async function requestInterviewReport(
  profile: StudentBundle["profile"],
  supabase: StudentBundle["supabase"],
  sessionId: string,
  failureMessage: string,
): Promise<FormState> {
  const existing = await supabase.from("interview_sessions").select(sessionSelect).eq("id", sessionId).maybeSingle()
  const session = toSession(existing.data)
  if (!session || session.status !== "awaiting_report") {
    revalidatePath("/student/interview")
    if (failureMessage === savedWithoutReport) return ok(savedWithoutReport)
    return fail("That interview could not be found.")
  }

  const generated = await generateJson(
    interviewReportSchema,
    "You are an interview coach writing a report for one student. Return JSON only. Score from 0 to 100. Write exactly one comment for each main question from 1 to 5, using that question's answer and its follow-up when one was asked. Include 1 to 4 strengths, 1 to 4 gaps, and 1 to 4 next steps. Do not mention other students.",
    `Role: ${session.roleTitle}\n${transcriptForReport(session)}`,
  )
  if (!generated) {
    revalidatePath("/student/interview")
    return failureMessage === savedWithoutReport ? ok(savedWithoutReport) : fail(failureMessage)
  }
  if (!generated.object) {
    await logTurn(profile, generated, "error", "interview_feedback")
    revalidatePath("/student/interview")
    return failureMessage === savedWithoutReport ? ok(savedWithoutReport) : fail(failureMessage)
  }

  const saved = await supabase.rpc("save_interview_report", {
    target_session: sessionId,
    report_body: generated.object,
    turn_score: generated.object.score,
    summary: generated.object.summary,
  })
  if (saved.error) {
    console.error(saved.error)
    await logTurn(profile, generated, "error", "interview_feedback")
    revalidatePath("/student/interview")
    return failureMessage === savedWithoutReport ? ok(savedWithoutReport) : fail(failureMessage)
  }
  await logTurn(profile, generated, "ok", "interview_feedback")
  revalidatePath("/student/interview")
  return ok("Interview complete.")
}

async function closeAndReport(
  profile: StudentBundle["profile"],
  supabase: StudentBundle["supabase"],
  sessionId: string,
  answer: string,
): Promise<FormState> {
  const closed = await supabase.rpc("close_interview", {
    target_session: sessionId,
    answer_text: answer,
  })
  if (closed.error) return fail(generationFailed)
  return requestInterviewReport(profile, supabase, sessionId, savedWithoutReport)
}

function transcriptForReport(session: InterviewSessionView) {
  return groupInterviewTurns(session.turns)
    .exchanges.map((exchange) => {
      const lines = [`main ${exchange.main}`, `question: ${exchange.question}`, `answer: ${exchange.answer}`]
      if (exchange.followUp) {
        lines.push(`follow-up: ${exchange.followUp}`, `follow-up answer: ${exchange.followUpAnswer}`)
      }
      return lines.join("\n")
    })
    .join("\n\n")
}

async function askModel(phase: InterviewPhase, prompt: string) {
  return generateJson(
    interviewTurnSchema,
    `You are an interview coach. Return JSON only. Allowed kind for this state: ${allowedKinds(phase)}. A follow-up may be asked at most once for the current main question. Close only after five main questions, and do not score the interview. Do not mention other students.`,
    prompt,
  )
}

function allowedKinds(phase: InterviewPhase) {
  if (phase.mainCount === 0) return "question"
  if (phase.followUpPending) return phase.mainCount === 5 ? "close" : "question"
  if (phase.mainCount < 5) return "follow_up or question"
  return "follow_up or close"
}

async function logTurn(
  profile: { id: string; role: string },
  generated: { modelName: string; latencyMs: number; promptTokens: number | null; completionTokens: number | null },
  status: "ok" | "error",
  feature: "interview_turn" | "interview_feedback" = "interview_turn",
) {
  await recordUsage({
    profileId: profile.id,
    role: profile.role,
    model: generated.modelName,
    feature,
    latencyMs: generated.latencyMs,
    promptTokens: generated.promptTokens,
    completionTokens: generated.completionTokens,
    status,
  })
}

function knownOr(message: string | undefined, fallback: string) {
  if (message?.includes("You already have an interview in progress.")) return "You already have an interview in progress."
  if (message?.includes("Your enrollment is not on file yet.")) return "Your enrollment is not on file yet."
  if (message?.includes("Choose an open drive or type a role.")) return "Choose an open drive or type a role."
  return fallback
}

function toDrive(value: unknown): InterviewDrive[] {
  if (!isRecord(value) || typeof value.id !== "string" || typeof value.company_name !== "string" || typeof value.role_title !== "string") {
    return []
  }
  return [{ id: value.id, label: `${value.company_name} · ${value.role_title}` }]
}

function toSession(value: unknown): InterviewSessionView | null {
  if (
    !isRecord(value) ||
    typeof value.id !== "string" ||
    typeof value.role_title !== "string" ||
    (value.status !== "in_progress" && value.status !== "awaiting_report" && value.status !== "completed") ||
    typeof value.created_at !== "string" ||
    typeof value.main_count !== "number" ||
    typeof value.follow_up_pending !== "boolean"
  ) {
    return null
  }
  const turns = Array.isArray(value.interview_turns) ? value.interview_turns.flatMap(toTurnView) : []
  turns.sort((left, right) => left.ordinal - right.ordinal)
  const report = interviewReportSchema.safeParse(value.report)
  return {
    id: value.id,
    roleTitle: value.role_title,
    status: value.status,
    score: typeof value.score === "number" ? value.score : null,
    feedback: typeof value.feedback === "string" ? value.feedback : "",
    report: report.success ? report.data : null,
    createdAt: value.created_at,
    mainCount: value.main_count,
    followUpPending: value.follow_up_pending,
    turns: turns.map((turn) => ({ kind: turn.kind, content: turn.content })),
  }
}

function toTurnView(value: unknown): Array<{ ordinal: number; kind: InterviewTurnView["kind"]; content: string }> {
  if (
    !isRecord(value) ||
    typeof value.ordinal !== "number" ||
    typeof value.content !== "string" ||
    (value.kind !== "question" && value.kind !== "follow_up" && value.kind !== "answer")
  ) {
    return []
  }
  return [{ ordinal: value.ordinal, kind: value.kind, content: value.content }]
}

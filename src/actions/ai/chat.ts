"use server"

import { fail, field, ok } from "@/actions/academics/shared"
import type { FormState } from "@/actions/form-state"
import { getCurrentProfile, requireUser } from "@/lib/auth/session"
import { attachAdminProposals } from "@/actions/ai/admin-proposals"
import { runAdminTurn } from "@/lib/ai/admin-agents"
import type { AdminProposalCard } from "@/lib/ai/admin-harness"
import { parseChatWidgets, type ChatWidget } from "@/lib/ai/chat-widgets"
import { runGuestTurn } from "@/lib/ai/guest-agents"
import { runStudentTurn } from "@/lib/ai/student-agents"
import { runTeacherTurn } from "@/lib/ai/teacher-agents"
import { guestHistory, offersApplicationForm } from "@/lib/ai/guest-college"
import { generationFailed } from "@/lib/ai/errors"
import { isRecord, QueryError } from "@/lib/db/errors"
import { createClient } from "@/lib/supabase/server"

export type ChatSessionView = { id: string; createdAt: string }
export type ChatMessageView = { role: "user" | "assistant"; content: string; widgets?: ChatWidget[] }

export async function loadChatDesk(sessionId: string | null) {
  const context = await signedContext()
  const sessions = await context.supabase
    .from("chat_sessions")
    .select("id, created_at")
    .eq("feature", "assistant")
    .order("created_at", { ascending: false })
  if (sessions.error) throw new QueryError()
  const listed = (sessions.data ?? []).flatMap(toSession)
  const selected = sessionId ? listed.find((session) => session.id === sessionId) ?? null : null
  if (!selected) return { sessions: listed, selected: null, messages: [] as ChatMessageView[] }
  const messages = await context.supabase
    .from("chat_messages")
    .select("role, content, widgets, created_at")
    .eq("session_id", selected.id)
    .order("created_at")
  if (messages.error) throw new QueryError()
  return {
    sessions: listed,
    selected,
    messages: (messages.data ?? []).flatMap(toMessage).slice(-20),
  }
}

export async function postChatMessage(sessionId: string | null, message: string) {
  const result = await streamChatTurn({ guest: false, sessionId, message }, () => {})
  return { error: result.error, reply: result.reply, sessionId: result.sessionId }
}

export async function streamChatTurn(
  input: { guest: boolean; sessionId: string | null; message: string; history?: unknown },
  onDelta: (delta: string) => void,
  onForm?: () => void,
  abortSignal?: AbortSignal,
  onProposal?: (proposal: AdminProposalCard) => void,
  onWidget?: (widget: ChatWidget) => void,
) {
  const text = input.message.trim()
  if (!text) return { error: "Write a message first.", reply: null, sessionId: input.sessionId }
  if (text.length > 2000) return { error: "Write a shorter message.", reply: null, sessionId: input.sessionId }
  let shown = ""
  const emit = (delta: string) => {
    shown += delta
    onDelta(delta)
  }
  if (input.guest) {
    await runGuestTurn(guestHistory(input.history), text, emit, onForm, abortSignal)
    const reply = shown.trim()
    if (offersApplicationForm(reply)) onForm?.()
    if (!reply) return { error: generationFailed, reply: null, sessionId: null }
    return { error: null, reply, sessionId: null }
  }
  const context = await chatContext()
  if (!context) {
    return { error: "You do not have permission to access this resource.", reply: null, sessionId: input.sessionId }
  }
  const history = input.sessionId ? await historyFor(context.supabase, input.sessionId) : []
  const proposalIds: string[] = []
  const widgets: ChatWidget[] = []
  const admissionProposals: AdminProposalCard[] = []
  if (context.role === "admin") {
    await runAdminTurn(history, text, context.profile, emit, (proposal) => {
      proposalIds.push(proposal.id)
      if (proposal.specialist === "admissions") admissionProposals.push(proposal)
      else onProposal?.(proposal)
    }, abortSignal, input.sessionId, widgets)
  } else if (context.role === "student") {
    await runStudentTurn(history, text, context.profile, emit, abortSignal)
  } else if (context.role === "teacher") {
    await runTeacherTurn(history, text, context.profile, emit, abortSignal)
  } else {
    return { error: "You do not have permission to access this resource.", reply: null, sessionId: input.sessionId }
  }
  const reply = shown.trim()
  if (!reply) return { error: generationFailed, reply: null, sessionId: input.sessionId }
  const saved = await context.supabase.rpc("save_chat_exchange", {
    target_session: input.sessionId,
    user_text: text,
    assistant_text: reply,
    assistant_widgets: widgets,
  })
  const savedId = typeof saved.data === "string" ? saved.data : null
  if (saved.error || !savedId) return { error: generationFailed, reply: null, sessionId: input.sessionId }
  if (context.role === "admin" && proposalIds.length > 0) await attachAdminProposals(proposalIds, savedId)
  if (context.role === "admin") {
    for (const proposal of admissionProposals) onProposal?.(proposal)
    for (const widget of widgets) onWidget?.(widget)
  }
  return { error: null, reply, sessionId: savedId }
}

export async function sendChatMessage(_previous: FormState, formData: FormData): Promise<FormState> {
  const sessionId = field(formData, "sessionId")
  const result = await postChatMessage(sessionId || null, field(formData, "message"))
  if (result.error) return fail(result.error)
  return ok("Reply saved.")
}

export async function sendGuestMessage(_previous: FormState, formData: FormData): Promise<FormState> {
  const message = field(formData, "message").trim()
  if (!message) return fail("Write a message first.")
  if (message.length > 2000) return fail("Write a shorter message.")
  const result = await streamChatTurn({ guest: true, sessionId: null, message }, () => {})
  if (result.error || !result.reply) return fail(result.error ?? generationFailed)
  return { error: null, success: result.reply }
}

async function chatContext() {
  const profile = await getCurrentProfile()
  if (!profile?.isActive || (profile.role !== "admin" && profile.role !== "teacher" && profile.role !== "student")) {
    return null
  }
  const supabase = await createClient()
  return { profile, role: profile.role, supabase }
}

async function signedContext() {
  const profile = await requireUser()
  if (profile.role !== "admin" && profile.role !== "teacher" && profile.role !== "student") {
    throw new QueryError()
  }
  const supabase = await createClient()
  return { profile, role: profile.role, supabase }
}

async function historyFor(supabase: Awaited<ReturnType<typeof signedContext>>["supabase"], sessionId: string) {
  const messages = await supabase
    .from("chat_messages")
    .select("role, content, created_at")
    .eq("session_id", sessionId)
    .order("created_at")
  if (messages.error) return []
  return (messages.data ?? []).flatMap(toMessage).slice(-20)
}

function toSession(value: unknown): ChatSessionView[] {
  if (!isRecord(value) || typeof value.id !== "string" || typeof value.created_at !== "string") return []
  return [{ id: value.id, createdAt: value.created_at }]
}

function toMessage(value: unknown): ChatMessageView[] {
  if (!isRecord(value) || typeof value.content !== "string") return []
  if (value.role !== "user" && value.role !== "assistant") return []
  const widgets = parseChatWidgets(value.widgets)
  return [{ role: value.role, content: value.content, ...(widgets.length > 0 ? { widgets } : {}) }]
}

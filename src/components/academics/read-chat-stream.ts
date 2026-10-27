import type { ChatWidget } from "@/lib/ai/chat-widgets"

export async function readChatStream(
  input: {
    message: string
    sessionId: string | null
    guest: boolean
    history?: { role: "user" | "assistant"; content: string }[]
  },
  onDelta: (delta: string) => void,
  onForm?: () => void,
  onProposal?: (proposal: { id: string; specialist: string; summary: string; action?: string; fields?: Record<string, string> }) => void,
  onWidget?: (widget: ChatWidget) => void,
) {
  const response = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  })
  if (!response.ok || !response.body) {
    return { error: "We couldn't generate a response right now. Please try again.", sessionId: input.sessionId }
  }
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ""
  let sessionId = input.sessionId
  let error: string | null = null
  while (true) {
    const chunk = await reader.read()
    if (chunk.done) break
    buffer += decoder.decode(chunk.value, { stream: true })
    const frames = buffer.split("\n\n")
    buffer = frames.pop() ?? ""
    for (const frame of frames) {
      const line = frame.split("\n").find((item) => item.startsWith("data: "))
      if (!line) continue
      const payload = JSON.parse(line.slice(6)) as {
        delta?: string
        error?: string
        sessionId?: string | null
        form?: string
        proposal?: { id: string; specialist: string; summary: string; action?: string; fields?: Record<string, string> }
        widget?: ChatWidget
      }
      if (payload.delta) onDelta(payload.delta)
      if (payload.form === "admission") onForm?.()
      if (payload.proposal) onProposal?.(payload.proposal)
      if (payload.widget) onWidget?.(payload.widget)
      if (payload.error) error = payload.error
      if (typeof payload.sessionId === "string") sessionId = payload.sessionId
    }
  }
  return { error, sessionId }
}

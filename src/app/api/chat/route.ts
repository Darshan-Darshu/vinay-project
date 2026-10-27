import { streamChatTurn } from "@/actions/ai/chat"
import type { AdminProposalCard } from "@/lib/ai/admin-harness"
import type { ChatWidget } from "@/lib/ai/chat-widgets"
import { isRecord } from "@/lib/db/errors"

export const maxDuration = 300

function closedController(error: unknown) {
  return error instanceof TypeError && error.message.includes("already closed")
}

export async function POST(request: Request) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return new Response("Bad request", { status: 400 })
  }
  if (!isRecord(body) || typeof body.message !== "string") {
    return new Response("Bad request", { status: 400 })
  }
  const message = body.message
  const sessionId = typeof body.sessionId === "string" && body.sessionId ? body.sessionId : null
  const guest = body.guest === true
  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      let open = true
      const send = (payload: { delta?: string; error?: string; done?: boolean; sessionId?: string | null; form?: string; proposal?: AdminProposalCard; widget?: ChatWidget }) => {
        if (!open || request.signal.aborted) return
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`))
        } catch (error) {
          open = false
          if (!closedController(error)) console.error(error)
        }
      }
      try {
        const result = await streamChatTurn(
          { guest, sessionId, message, history: body.history },
          (delta) => {
            send({ delta })
          },
          () => send({ form: "admission" }),
          request.signal,
          (proposal) => send({ proposal }),
          (widget) => send({ widget }),
        )
        if (request.signal.aborted) return
        if (result.error) send({ error: result.error })
        else send({ done: true, sessionId: result.sessionId })
      } catch (error) {
        if (request.signal.aborted || closedController(error)) return
        console.error(error)
        send({ error: "We couldn't generate a response right now. Please try again." })
      } finally {
        if (open) {
          open = false
          try {
            controller.close()
          } catch (error) {
            if (!closedController(error)) console.error(error)
          }
        }
      }
    },
    cancel() {
      // The browser closed the chat request. Later model output must not write to this stream.
    },
  })
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
    },
  })
}

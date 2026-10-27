"use client"

import { useEffect, useId, useRef, useState, type FormEvent } from "react"
import { ArrowUp, MessageCircle, Plus, X } from "lucide-react"

import { loadChatDesk } from "@/actions/ai/chat"
import { listOpenAdminProposals } from "@/actions/ai/admin-proposals"
import type { ChatMessageView, ChatSessionView } from "@/actions/ai/chat"
import { AdmissionChatForm } from "@/components/academics/admission-chat-form"
import { MarkdownMessage } from "@/components/academics/markdown-message"
import { ChatWidgets } from "@/components/academics/chat-widgets/admission-widgets"
import { ProposalCards } from "@/components/academics/proposal-cards"
import { readChatStream } from "@/components/academics/read-chat-stream"
import { offersApplicationForm, withoutApplicationCta } from "@/lib/ai/guest-college"
import type { AdminProposalCard } from "@/lib/ai/admin-harness"
import { formatDateTime } from "@/lib/format"
import { cn } from "cn"

export function RoleChatDock() {
  return <ChatDock mode="role" />
}

export function GuestChatDock() {
  return <ChatDock mode="guest" />
}

type DockMessage = ChatMessageView & { form?: boolean }

function ChatDock({ mode }: { mode: "role" | "guest" }) {
  const titleId = useId()
  const threadRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const [open, setOpen] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [draft, setDraft] = useState("")
  const [messages, setMessages] = useState<DockMessage[]>([])
  const [sessions, setSessions] = useState<ChatSessionView[]>([])
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [picked, setPicked] = useState(false)
  const [proposals, setProposals] = useState<AdminProposalCard[]>([])

  useEffect(() => {
    if (!open) return
    const previous = document.body.style.overflow
    document.body.style.overflow = "hidden"
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false)
    }
    window.addEventListener("keydown", onKey)
    inputRef.current?.focus()
    return () => {
      document.body.style.overflow = previous
      window.removeEventListener("keydown", onKey)
    }
  }, [open])

  useEffect(() => {
    threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight })
  }, [messages, pending, open, proposals])

  useEffect(() => {
    if (!open || mode !== "role") return
    let active = true
    listOpenAdminProposals()
      .then((rows) => {
        if (active) setProposals(rows)
      })
      .catch(() => {
        if (active) setProposals([])
      })
    return () => {
      active = false
    }
  }, [open, mode, sessionId])

  async function openDock() {
    setOpen(true)
    if (mode !== "role" || picked) return
    setLoading(true)
    setError(null)
    try {
      const listed = await loadChatDesk(null)
      const latest = listed.sessions[0]
      if (!latest) {
        setSessions(listed.sessions)
        setMessages([])
        setSessionId(null)
        setPicked(true)
        return
      }
      const desk = await loadChatDesk(latest.id)
      setSessions(desk.sessions)
      setMessages(desk.messages)
      setSessionId(desk.selected?.id ?? null)
      setPicked(true)
    } catch {
      setError("The assistant could not be opened.")
    } finally {
      setLoading(false)
    }
  }

  async function chooseSession(nextId: string | null) {
    setHistoryOpen(false)
    setSessionId(nextId)
    setPicked(true)
    setError(null)
    if (!nextId) {
      setMessages([])
      return
    }
    setLoading(true)
    try {
      const desk = await loadChatDesk(nextId)
      setSessions(desk.sessions)
      setMessages(desk.messages)
      setSessionId(desk.selected?.id ?? null)
    } catch {
      setError("That chat could not be opened.")
    } finally {
      setLoading(false)
    }
  }

  function settleWidget(proposalId: string, result: string) {
    setMessages((current) => current.map((message) => ({
      ...message,
      widgets: message.widgets?.map((widget) => widget.kind === "form" && widget.proposalId === proposalId ? { ...widget, result } : widget),
    })))
    setProposals((current) => current.filter((item) => item.id !== proposalId))
  }

  async function send(message: string) {
    if (!message || pending) return
    const history = messages
    setDraft("")
    setError(null)
    setPending(true)
    setMessages((current) => [...current, { role: "user", content: message }, { role: "assistant", content: "" }])
    const result = await readChatStream(
      { message, sessionId, guest: mode === "guest", history: mode === "guest" ? history : undefined },
      (delta) => {
        setMessages((current) => {
          const next = [...current]
          const last = next.at(-1)
          if (!last || last.role !== "assistant") return current
          next[next.length - 1] = { ...last, content: last.content + delta }
          return next
        })
      },
      () => {
        setMessages((current) => {
          const next = [...current]
          const last = next.at(-1)
          if (!last || last.role !== "assistant") return current
          next[next.length - 1] = { ...last, form: true }
          return next
        })
      },
      (proposal) => {
        setProposals((current) => current.some((item) => item.id === proposal.id) ? current : [...current, proposal])
      },
      (widget) => {
        setMessages((current) => {
          const next = [...current]
          const last = next.at(-1)
          if (!last || last.role !== "assistant") return current
          next[next.length - 1] = { ...last, widgets: [...(last.widgets ?? []), widget] }
          return next
        })
      },
    )
    setPending(false)
    if (result.error) {
      setError(result.error)
      setMessages((current) => {
        const last = current.at(-1)
        if (last?.role === "assistant" && !last.content) return current.slice(0, -1)
        return current
      })
      return
    }
    if (mode === "guest") return
    setSessionId(result.sessionId)
    setPicked(true)
    const desk = await loadChatDesk(result.sessionId).catch(() => null)
    if (desk) setSessions(desk.sessions)
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const message = draft.trim()
    setDraft("")
    void send(message)
  }

  return (
    <>
      <button
        type="button"
        className="fixed right-5 bottom-5 z-[70] flex size-14 items-center justify-center rounded-full bg-[#2a2436] text-[#f6f1e6] shadow-[0_12px_30px_rgba(28,22,40,0.35)] transition print:hidden hover:bg-[#3a3148]"
        aria-expanded={open}
        aria-label={open ? "Close assistant" : "Open assistant"}
        onClick={() => (open ? setOpen(false) : void openDock())}
      >
        {open ? <X className="size-6" /> : <MessageCircle className="size-6" />}
      </button>
      {open ? (
        <div className="fixed inset-0 z-[60] grid place-items-center bg-[#101a2c]/55 print:hidden" onClick={() => setOpen(false)}>
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className="flex h-[80vh] w-[80vw] flex-col overflow-hidden rounded-[28px] bg-[radial-gradient(circle_at_top,#8d7d96_0%,#5c4d66_46%,#3d334c_100%)] text-[#f7f3ea] shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <header className="flex items-center gap-3 px-5 pt-4 pb-2">
              <h2 id={titleId} className="text-sm font-medium tracking-wide">
                Assistant
              </h2>
              <div className="ml-auto flex items-center gap-2">
                {mode === "role" ? (
                  <button
                    type="button"
                    className="rounded-full bg-white/10 px-3 py-1.5 text-xs hover:bg-white/15"
                    aria-expanded={historyOpen}
                    onClick={() => setHistoryOpen((current) => !current)}
                  >
                    Chats
                  </button>
                ) : null}
                <button
                  type="button"
                  className="flex size-8 items-center justify-center rounded-full bg-white/10 hover:bg-white/15"
                  aria-label="New chat"
                  onClick={() => void chooseSession(null)}
                >
                  <Plus className="size-4" />
                </button>
                <button
                  type="button"
                  className="flex size-8 items-center justify-center rounded-full bg-white/10 hover:bg-white/15"
                  aria-label="Close assistant"
                  onClick={() => setOpen(false)}
                >
                  <X className="size-4" />
                </button>
              </div>
            </header>
            <div className="relative min-h-0 flex-1">
              {historyOpen && mode === "role" ? (
                <div className="absolute top-2 right-5 z-10 max-h-64 w-64 overflow-auto rounded-2xl bg-[#2a2436] p-2 shadow-xl">
                  <button
                    type="button"
                    className="block w-full rounded-xl px-3 py-2 text-left text-sm hover:bg-white/10"
                    onClick={() => void chooseSession(null)}
                  >
                    New chat
                  </button>
                  <ul>
                    {sessions.map((session) => (
                      <li key={session.id}>
                        <button
                          type="button"
                          className={cn(
                            "block w-full rounded-xl px-3 py-2 text-left text-sm hover:bg-white/10",
                            session.id === sessionId && "bg-white/10",
                          )}
                          onClick={() => void chooseSession(session.id)}
                        >
                          {formatDateTime(session.createdAt)}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              <div ref={threadRef} className="h-full overflow-y-auto px-6 py-4">
                {loading ? <p className="text-sm text-white/70">Loading chat…</p> : null}
                {!loading && messages.length === 0 ? (
                  <p className="mx-auto mt-[18vh] max-w-sm text-center text-sm text-white/70">
                    {mode === "guest"
                      ? "Ask about courses, admissions, and events."
                      : "Ask about the records this account can already see."}
                  </p>
                ) : null}
                <ol className="mx-auto flex w-full max-w-3xl flex-col gap-4">
                  {messages.map((message, index) => {
                    const showForm = message.role === "assistant" && (message.form || offersApplicationForm(message.content))
                    const text = showForm ? withoutApplicationCta(message.content) : message.content
                    const thinking = pending && index === messages.length - 1
                    return (
                      <li
                        key={`${message.role}-${index}`}
                        className={cn("flex flex-col", message.role === "user" ? "items-end" : "items-start")}
                      >
                        {text || message.role === "user" || thinking ? (
                          <div
                            className={cn(
                              "max-w-[75%] px-4 py-3 text-sm leading-6",
                              message.role === "user"
                                ? "rounded-[22px] bg-[#f3efe4] text-[#2b2433] whitespace-pre-wrap"
                                : "rounded-[22px] bg-[#2a2436] text-[#f7f3ea]",
                            )}
                          >
                            {message.role === "assistant" && text ? (
                              <MarkdownMessage text={text} />
                            ) : (
                              text || (thinking ? "Thinking…" : "")
                            )}
                          </div>
                        ) : null}
                        {showForm ? <AdmissionChatForm /> : null}
                        {message.role === "assistant" && message.widgets?.length ? (
                          <ChatWidgets widgets={message.widgets} onAsk={(text) => void send(text)} onSettled={settleWidget} />
                        ) : null}
                      </li>
                    )
                  })}
                </ol>
              </div>
            </div>
            {mode === "role" ? (
              <div className="px-5">
                <ProposalCards
                  proposals={proposals.filter((proposal) => !messages.some((message) => message.widgets?.some((widget) => widget.kind === "form" && widget.proposalId === proposal.id)))}
                  onSettled={settleWidget}
                />
              </div>
            ) : null}
            <form onSubmit={onSubmit} className="px-5 pt-2 pb-5">
              {error ? <p className="mb-2 text-sm text-[#ffd7d1]">{error}</p> : null}
              <div className="mx-auto flex w-full max-w-3xl items-end gap-2 rounded-[28px] bg-[#f6f1e6] px-3 py-2">
                <textarea
                  ref={inputRef}
                  value={draft}
                  required
                  maxLength={2000}
                  rows={1}
                  placeholder="Type a message..."
                  className="max-h-32 min-h-11 flex-1 resize-none bg-transparent px-2 py-2.5 text-sm text-[#2b2433] outline-none placeholder:text-[#8d8478]"
                  onChange={(event) => setDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault()
                      event.currentTarget.form?.requestSubmit()
                    }
                  }}
                />
                <button
                  type="submit"
                  disabled={pending || !draft.trim()}
                  className="mb-1 flex size-10 shrink-0 items-center justify-center rounded-full bg-[#2a2436] text-[#f6f1e6] disabled:opacity-40"
                  aria-label="Send"
                >
                  <ArrowUp className="size-4" />
                </button>
              </div>
            </form>
          </section>
        </div>
      ) : null}
    </>
  )
}

"use client"

import { useActionState, useEffect } from "react"
import { useRouter } from "next/navigation"

import { applyToDrive } from "@/actions/student/placements/apply"
import type { FormState } from "@/actions/form-state"
import { EmptyState } from "@/components/dashboard/states"
import { useRecordEditor } from "@/components/records/editor-context"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import type { RecordCard, RecordTone } from "@/actions/records/types"
import { cn } from "@/lib/utils"

const initialApply: FormState = { error: null, success: null }

const tones: Record<RecordTone, string> = {
  neutral: "bg-background text-muted-foreground",
  good: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200",
  wait: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200",
  alert: "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-200",
  info: "bg-sky-100 text-sky-900 dark:bg-sky-950 dark:text-sky-200",
}

export function RecordList({
  cards,
  empty,
  selectable = false,
}: {
  cards: RecordCard[]
  empty: string
  selectable?: boolean
}) {
  const editor = useRecordEditor()
  const clickable = selectable && editor.editable

  if (cards.length === 0) {
    return <EmptyState title="Nothing to show" description={empty} />
  }

  return (
    <ul className="overflow-hidden rounded-[28px] bg-panel">
      {cards.map((card) => (
        <li key={card.id} className="border-b border-background last:border-b-0">
          <RecordRow
            card={card}
            clickable={clickable}
            onOpen={clickable ? () => editor.openId(card.id) : undefined}
          />
        </li>
      ))}
    </ul>
  )
}

function RecordRow({
  card,
  clickable,
  onOpen,
}: {
  card: RecordCard
  clickable: boolean
  onOpen?: () => void
}) {
  const body = (
    <>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-sm font-semibold">{card.title}</h2>
              {card.subtitle ? (
                <p className="mt-0.5 text-sm text-muted-foreground">{card.subtitle}</p>
              ) : null}
            </div>
            {card.badge ? (
              <span
                className={cn(
                  "shrink-0 rounded-full px-2.5 py-1 text-xs font-medium",
                  tones[card.tone],
                )}
              >
                {card.badge}
              </span>
            ) : null}
          </div>
          {card.detail ? (
            <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{card.detail}</p>
          ) : null}
          {card.meta ? <p className="mt-2 text-xs text-muted-foreground">{card.meta}</p> : null}
          {card.applyDriveId ? <ApplyButton driveId={card.applyDriveId} /> : null}
    </>
  )

  if (!clickable || !onOpen) {
    return <div className="px-4 py-4 sm:px-5">{body}</div>
  }

  return (
    <button
      type="button"
      onClick={onOpen}
      className="w-full px-4 py-4 text-left hover:bg-background/60 sm:px-5"
    >
      {body}
    </button>
  )
}

function ApplyButton({ driveId }: { driveId: string }) {
  const router = useRouter()
  const [state, action, pending] = useActionState(applyToDrive, initialApply)

  useEffect(() => {
    if (state.success) router.refresh()
  }, [router, state.success])

  return (
    <form action={action} className="mt-3" onClick={(event) => event.stopPropagation()}>
      <input type="hidden" name="driveId" value={driveId} />
      {state.error ? (
        <Alert variant="destructive" className="mb-2">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}
      {state.success ? (
        <p className="text-sm text-muted-foreground">{state.success}</p>
      ) : (
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Sending…" : "Apply"}
        </Button>
      )}
    </form>
  )
}

export function RecordSkeleton() {
  return (
    <div className="space-y-5">
      <div>
        <Skeleton className="h-8 w-48" />
        <Skeleton className="mt-2 h-4 w-72" />
      </div>
      <Skeleton className="h-28 w-full rounded-[28px]" />
      <Skeleton className="h-64 w-full rounded-[28px]" />
    </div>
  )
}

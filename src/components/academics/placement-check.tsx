"use client"

import { useState } from "react"
import { useActionState } from "react"
import { Loader2Icon } from "lucide-react"

import { checkPlacementFit, type PlacementCheckState } from "@/actions/ai/placement"
import { FormFeedback } from "@/components/academics/feedback"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"

const initialState: PlacementCheckState = { error: null, result: null }

export function PlacementCheck() {
  const [state, action, pending] = useActionState(checkPlacementFit, initialState)
  const [open, setOpen] = useState(false)
  const result = state.result
  return (
    <section>
      <form
        action={action}
        onSubmit={() => {
          setOpen(true)
        }}
      >
        <Button type="submit" disabled={pending}>
          AI Check
        </Button>
      </form>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{pending ? "AI is generating" : "Matching drives"}</DialogTitle>
            <DialogDescription>
              {pending
                ? "Reading your resume and scoring open drives."
                : "Open campus drives ranked for your resume and typed skills."}
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[calc(min(85vh,40rem)-6.5rem)] overflow-y-auto px-5 pt-4 pb-5">
            {pending ? <GeneratingState /> : null}
            {!pending && state.error ? <FormFeedback state={{ error: state.error, success: null }} /> : null}
            {!pending && !state.error && result && result.matches.length === 0 ? (
              <p className="rounded-2xl bg-panel px-4 py-8 text-center text-sm text-muted-foreground">
                {result.notice ?? "Drives appear here when they share a skill or the fit score is 40 or above."}
              </p>
            ) : null}
            {!pending && !state.error && result && result.matches.length > 0 ? (
              <div className="space-y-3">
                {result.notice ? <p className="text-sm text-muted-foreground">{result.notice}</p> : null}
                <ul className="space-y-3">
                  {result.matches.map((match) => (
                    <li key={match.id} className="space-y-3 rounded-2xl border border-border bg-panel p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{match.companyName}</p>
                          <p className="text-sm text-muted-foreground">{match.roleTitle}</p>
                        </div>
                        {match.highChance ? <Badge>High chance</Badge> : <Badge variant="outline">Possible fit</Badge>}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Badge variant="secondary">
                          Fit {match.modelScore === null ? "unavailable" : `${match.modelScore}%`}
                        </Badge>
                        <Badge variant="outline">Overlap {match.overlapPercent}%</Badge>
                      </div>
                      <div className="space-y-2">
                        <SkillRow label="Shared" skills={match.shared} />
                        <SkillRow label="Still required" skills={match.missing} />
                      </div>
                      {match.reason ? <p className="text-sm leading-relaxed">{match.reason}</p> : null}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </section>
  )
}

function GeneratingState() {
  return (
    <div className="space-y-4" role="status" aria-live="polite">
      <div className="flex items-center gap-2 text-sm font-medium">
        <Loader2Icon className="size-4 animate-spin" />
        AI is generating
      </div>
      <div className="space-y-3">
        <Skeleton className="h-24 rounded-2xl" />
        <Skeleton className="h-24 rounded-2xl" />
      </div>
    </div>
  )
}

function SkillRow({ label, skills }: { label: string; skills: string[] }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      {skills.length === 0 ? (
        <span className="text-xs text-muted-foreground">None</span>
      ) : (
        skills.map((skill) => (
          <Badge key={skill} variant="ghost" className="bg-background">
            {skill}
          </Badge>
        ))
      )}
    </div>
  )
}

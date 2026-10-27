"use client"

import { answerInterview, startInterview, writeInterviewReport, type InterviewDrive, type InterviewSessionView } from "@/actions/ai/interview"
import { explainPlacementMatch } from "@/actions/ai/placement"
import { FormFeedback, useFormAction } from "@/components/academics/feedback"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { groupInterviewTurns } from "@/lib/ai/interview-report"

export function StartInterviewForm({ drives }: { drives: InterviewDrive[] }) {
  const [state, action, pending] = useFormAction(startInterview)
  return (
    <form action={action} className="max-w-2xl space-y-4 rounded-[28px] bg-panel p-4">
      <label className="block space-y-2 text-sm font-medium">
        Open drive
        <select name="driveId" defaultValue="" className="h-8 w-full rounded-lg border border-input bg-background px-2 text-sm">
          <option value="">Type a role instead</option>
          {drives.map((drive) => (
            <option key={drive.id} value={drive.id}>
              {drive.label}
            </option>
          ))}
        </select>
      </label>
      <label className="block space-y-2 text-sm font-medium">
        Role, if you did not pick a drive
        <Input name="roleTitle" maxLength={160} />
      </label>
      <FormFeedback state={state} />
      <Button type="submit" disabled={pending}>
        {pending ? "Starting…" : "Start interview"}
      </Button>
    </form>
  )
}

export function AnswerInterviewForm({ session }: { session: InterviewSessionView }) {
  const [state, action, pending] = useFormAction(answerInterview)
  const current = groupInterviewTurns(session.turns).pending
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="sessionId" value={session.id} />
      {current ? <p className="text-sm font-medium">{current.prompt}</p> : null}
      <Textarea name="answer" required maxLength={4000} placeholder="Your answer" />
      <FormFeedback state={state} />
      <Button type="submit" disabled={pending}>
        {pending ? "Submitting…" : "Submit answer"}
      </Button>
    </form>
  )
}

export function WriteReportForm({ sessionId }: { sessionId: string }) {
  const [state, action, pending] = useFormAction(writeInterviewReport)
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="sessionId" value={sessionId} />
      <FormFeedback state={state} />
      <Button type="submit" disabled={pending}>
        {pending ? "Writing…" : "Write report"}
      </Button>
    </form>
  )
}

export function ExplainMatchButton({ driveId }: { driveId: string }) {
  const [state, action, pending] = useFormAction(explainPlacementMatch)
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="driveId" value={driveId} />
      <Button type="submit" variant="outline" disabled={pending}>
        {pending ? "Thinking…" : "Why this fits"}
      </Button>
      {state.success ? <p className="text-sm">{state.success}</p> : null}
      {state.error ? <FormFeedback state={state} /> : null}
    </form>
  )
}

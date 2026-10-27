import { loadInterviewDesk, type InterviewSessionView } from "@/actions/ai/interview"
import { AnswerInterviewForm, StartInterviewForm, WriteReportForm } from "@/components/academics/ai-forms"
import { InterviewReportView, InterviewTranscript } from "@/components/academics/interview-transcript"
import { PageHeader } from "@/components/dashboard/stat-card"
import { EmptyState } from "@/components/dashboard/states"
import { groupInterviewTurns } from "@/lib/ai/interview-report"

export async function InterviewScreen() {
  const desk = await loadInterviewDesk()
  const active = desk.sessions.find((session) => session.status === "in_progress" || session.status === "awaiting_report") ?? null
  const finished = desk.sessions.filter((session) => session.status === "completed")
  return (
    <div className="space-y-6">
      <PageHeader
        title="Interview"
        description="Five questions, with at most one follow-up after each answer. Your answers stay on this page, and a report is written after the last one."
      />
      {active ? (
        <section className="space-y-4 rounded-[28px] bg-panel p-4">
          <div className="space-y-1">
            <h2 className="text-sm font-medium">{active.roleTitle}</h2>
            <p className="text-sm text-muted-foreground">{progressLabel(active)}</p>
          </div>
          <InterviewTranscript turns={active.turns} report={null} />
          {active.status === "in_progress" ? <AnswerInterviewForm session={active} /> : <WriteReportForm sessionId={active.id} />}
        </section>
      ) : (
        <StartInterviewForm drives={desk.drives} />
      )}
      {finished.length === 0 ? (
        <EmptyState title="No finished interviews" description="A completed session shows its score and feedback here." />
      ) : (
        <ul className="space-y-4">
          {finished.map((session) => (
            <li key={session.id}>
              <InterviewReportView
                roleTitle={session.roleTitle}
                createdAt={session.createdAt}
                score={session.score}
                feedback={session.feedback}
                report={session.report}
                turns={session.turns}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function progressLabel(session: InterviewSessionView) {
  if (session.status === "awaiting_report") return "Your answers are saved."
  const pending = groupInterviewTurns(session.turns).pending
  if (pending?.kind === "follow_up") return `Follow-up on question ${pending.main} of 5`
  const current = pending?.main ?? session.mainCount
  return `Question ${current} of 5`
}

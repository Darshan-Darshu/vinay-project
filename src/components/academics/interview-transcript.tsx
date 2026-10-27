import type { InterviewTurnView } from "@/actions/ai/interview"
import { commentFor, groupInterviewTurns, type InterviewReport } from "@/lib/ai/interview-report"
import { formatDateTime } from "@/lib/format"

export function InterviewTranscript({
  turns,
  report,
}: {
  turns: InterviewTurnView[]
  report: InterviewReport | null
}) {
  const { exchanges } = groupInterviewTurns(turns)
  if (exchanges.length === 0) return null
  return (
    <ol className="space-y-3">
      {exchanges.map((exchange) => (
        <QuestionBlock
          key={exchange.main}
          main={exchange.main}
          question={exchange.question}
          answer={exchange.answer}
          followUp={exchange.followUp}
          followUpAnswer={exchange.followUpAnswer}
          comment={report ? commentFor(report, exchange.main) : ""}
        />
      ))}
    </ol>
  )
}

export function InterviewReportView({
  roleTitle,
  createdAt,
  score,
  feedback,
  report,
  turns,
}: {
  roleTitle: string
  createdAt: string
  score: number | null
  feedback: string
  report: InterviewReport | null
  turns: InterviewTurnView[]
}) {
  const shownScore = report?.score ?? score ?? 0
  return (
    <article className="rounded-[28px] bg-panel p-5 sm:p-6">
      <header className="flex items-start justify-between gap-6">
        <div>
          <h2 className="text-base font-semibold text-navy">{roleTitle}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{formatDateTime(createdAt)}</p>
        </div>
        <p className="text-right">
          <span className="block text-xs text-muted-foreground">Score</span>
          <span className="text-3xl font-semibold tracking-tight text-navy">{shownScore}</span>
          <span className="mt-0.5 block text-xs text-muted-foreground">out of 100</span>
        </p>
      </header>
      {report ? (
        <>
          <p className="mt-5 max-w-3xl text-sm leading-6">{report.summary}</p>
          <div className="mt-5 grid gap-3 md:grid-cols-3">
            <ReportList title="Strengths" items={report.strengths} />
            <ReportList title="Gaps" items={report.gaps} />
            <ReportList title="What to practice next" items={report.nextSteps} />
          </div>
          <div className="mt-5">
            <InterviewTranscript turns={turns} report={report} />
          </div>
        </>
      ) : (
        <div className="mt-5 space-y-4">
          {feedback ? <p className="max-w-3xl text-sm leading-6">{feedback}</p> : null}
          <InterviewTranscript turns={turns} report={null} />
        </div>
      )}
    </article>
  )
}

function QuestionBlock({
  main,
  question,
  answer,
  followUp,
  followUpAnswer,
  comment,
}: {
  main: number
  question: string
  answer: string
  followUp: string
  followUpAnswer: string
  comment: string
}) {
  return (
    <li className="rounded-2xl bg-background px-4 py-4">
      <div className="flex gap-3">
        <p className="w-6 shrink-0 text-sm font-semibold text-navy">{String(main).padStart(2, "0")}</p>
        <div className="min-w-0 space-y-3">
          <p className="text-sm font-medium leading-6 text-navy">{question}</p>
          <Answer label="Your answer" text={answer} />
          {followUp ? (
            <>
              <p className="text-sm leading-6">{followUp}</p>
              <Answer label="Your follow-up answer" text={followUpAnswer} />
            </>
          ) : null}
          {comment ? (
            <div className="border-t border-border pt-3">
              <p className="text-xs text-muted-foreground">Comment</p>
              <p className="mt-1 text-sm leading-6">{comment}</p>
            </div>
          ) : null}
        </div>
      </div>
    </li>
  )
}

function Answer({ label, text }: { label: string; text: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm leading-6">{text}</p>
    </div>
  )
}

function ReportList({ title, items }: { title: string; items: string[] }) {
  return (
    <section className="rounded-2xl bg-background px-4 py-4">
      <h3 className="text-sm font-medium text-navy">{title}</h3>
      <ul className="mt-2 space-y-2 text-sm leading-6 text-muted-foreground">
        {items.map((item, index) => (
          <li key={`${title}-${index}`}>{item}</li>
        ))}
      </ul>
    </section>
  )
}

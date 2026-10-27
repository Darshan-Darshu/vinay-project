import Link from "next/link"

import { loadQuestionDesk } from "@/actions/academics/questions"
import { loadPaper, loadPaperDesk } from "@/actions/academics/papers"
import { loadStaffMaterials, loadStudentMaterials } from "@/actions/academics/materials"
import { loadStudentPaper, loadTests } from "@/actions/academics/attempts"
import { GenerateDraftsForm } from "@/components/academics/generate-form"
import { DeleteQuestionButton, QuestionForm } from "@/components/academics/question-form"
import {
  AddQuestionForm,
  AttemptActions,
  DeleteMaterialButton,
  MaterialForm,
  PaperCreateForm,
  PublishPaperButton,
  RemoveQuestionButton,
} from "@/components/academics/paper-forms"
import { PageHeader } from "@/components/dashboard/stat-card"
import { EmptyState } from "@/components/dashboard/states"
import { formatDateTime } from "@/lib/format"
import type { AppRole } from "@/lib/permissions/roles"

export async function QuestionScreen({
  role,
  questionId,
}: {
  role: Extract<AppRole, "admin" | "teacher">
  questionId?: string
}) {
  const desk = await loadQuestionDesk()
  const editing = desk.questions.find((question) => question.id === questionId) ?? null
  return (
    <div className="space-y-6">
      <PageHeader
        title="Questions"
        description="Multiple choice and true or false questions for subjects you teach. A published paper freezes the questions on it."
      />
      {desk.subjects.length === 0 ? (
        <EmptyState title="No subjects yet" description="The office has not assigned subjects yet." />
      ) : (
        <>
          <GenerateDraftsForm subjects={desk.subjects} />
          <QuestionForm key={editing?.id ?? "new"} subjects={desk.subjects} question={editing} />
        </>
      )}
      {desk.questions.length === 0 ? (
        <EmptyState title="No questions yet" description="Saved questions appear here." />
      ) : (
        <ul className="space-y-3">
          {desk.questions.map((question) => (
            <li key={question.id} className="rounded-[28px] bg-panel p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">{question.stem}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {question.subjectName} · {question.marks} marks · {question.questionType === "mcq" ? "Multiple choice" : "True or false"}
                    {question.source === "ai" ? " · AI draft" : ""}
                    {question.frozen ? " · On a published paper" : ""}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Link className="text-sm underline" href={`/${role}/questions?question=${question.id}`}>
                    Edit
                  </Link>
                  {question.frozen ? null : <DeleteQuestionButton id={question.id} />}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export async function PaperListScreen({ role }: { role: Extract<AppRole, "admin" | "teacher"> }) {
  const desk = await loadPaperDesk()
  return (
    <div className="space-y-6">
      <PageHeader
        title="Papers"
        description="Build a draft from one subject, then publish it for every active student in that course."
      />
      {desk.subjects.length === 0 ? (
        <EmptyState title="No subjects yet" description="The office has not assigned subjects yet." />
      ) : (
        <PaperCreateForm subjects={desk.subjects} />
      )}
      {desk.papers.length === 0 ? (
        <EmptyState title="No papers yet" description="Draft papers appear here." />
      ) : (
        <ul className="space-y-3">
          {desk.papers.map((paper) => (
            <li key={paper.id}>
              <Link href={`/${role}/papers/${paper.id}`} className="block rounded-[28px] bg-panel p-4 hover:bg-muted">
                <p className="text-sm font-medium">{paper.title}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {paper.subjectName} · {paper.status === "published" ? "Published" : "Draft"} · {paper.questionCount} questions ·{" "}
                  {formatDateTime(paper.opensAt)} to {formatDateTime(paper.closesAt)}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export async function PaperDetailScreen({ role, paperId }: { role: Extract<AppRole, "admin" | "teacher">; paperId: string }) {
  const desk = await loadPaper(paperId)
  if (!desk) return null
  const draft = desk.paper.status === "draft"
  return (
    <div className="space-y-6">
      <PageHeader
        title={desk.paper.title}
        description={`${desk.paper.subjectName} · ${desk.paper.durationMinutes} minutes · ${formatDateTime(desk.paper.opensAt)} to ${formatDateTime(desk.paper.closesAt)}`}
      />
      <Link className="text-sm underline" href={`/${role}/papers`}>
        All papers
      </Link>
      {draft ? <AddQuestionForm paperId={desk.paper.id} questions={desk.available} /> : null}
      {desk.questions.length === 0 ? (
        <EmptyState title="No questions on this paper" description="Add at least one question before publishing." />
      ) : (
        <ol className="space-y-3">
          {desk.questions.map((question, index) => (
            <li key={question.id} className="rounded-[28px] bg-panel p-4">
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm font-medium">
                  {index + 1}. {question.stem}
                </p>
                {draft ? <RemoveQuestionButton paperId={desk.paper.id} questionId={question.id} /> : null}
              </div>
              <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                {question.options.map((option) => (
                  <li key={option.label}>
                    {option.label}. {option.body}
                    {option.isCorrect ? " · Correct" : ""}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
      )}
      {draft ? <PublishPaperButton paperId={desk.paper.id} /> : <p className="text-sm text-muted-foreground">This paper is published, so its questions stay frozen.</p>}
    </div>
  )
}

export async function MaterialScreen({ role }: { role: Extract<AppRole, "admin" | "teacher"> | "student" }) {
  if (role === "student") {
    const desk = await loadStudentMaterials()
    return (
      <div className="space-y-6">
        <PageHeader title="Materials" description="Notes and links for subjects in your course." />
        <MaterialList
          enrolled={desk.enrolled}
          materials={desk.materials}
          empty="No materials have been uploaded for your course."
        />
      </div>
    )
  }
  const desk = await loadStaffMaterials()
  return (
    <div className="space-y-6">
      <PageHeader
        title="Materials"
        description="Upload a PDF or save a link for a subject you teach. The approval flag is stored for a later search feature."
      />
      {desk.subjects.length === 0 ? (
        <EmptyState title="No subjects yet" description="The office has not assigned subjects yet." />
      ) : (
        <MaterialForm subjects={desk.subjects} />
      )}
      <MaterialList enrolled materials={desk.materials} empty="Uploaded materials appear here." staff />
    </div>
  )
}

function MaterialList({
  enrolled,
  materials,
  empty,
  staff = false,
}: {
  enrolled: boolean
  materials: { id: string; title: string; subjectName: string; kind: "pdf" | "link"; href: string; approvedForRag: boolean }[]
  empty: string
  staff?: boolean
}) {
  if (!enrolled) return <EmptyState title="Waiting for enrollment" description="Your course will appear here after enrollment." />
  if (materials.length === 0) return <EmptyState title="Nothing to show" description={empty} />
  return (
    <ul className="space-y-3">
      {materials.map((material) => (
        <li key={material.id} className="flex flex-wrap items-center justify-between gap-3 rounded-[28px] bg-panel p-4">
          <div>
            <p className="text-sm font-medium">{material.title}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {material.subjectName} · {material.kind === "pdf" ? "PDF" : "Link"}
              {material.approvedForRag ? " · Marked for later search" : ""}
            </p>
          </div>
          <div className="flex gap-3">
            {material.href ? (
              <a className="text-sm underline" href={material.href} target="_blank" rel="noreferrer">
                Open
              </a>
            ) : null}
            {staff ? <DeleteMaterialButton id={material.id} /> : null}
          </div>
        </li>
      ))}
    </ul>
  )
}

export async function TestListScreen() {
  const desk = await loadTests()
  return (
    <div className="space-y-6">
      <PageHeader title="Tests" description="Published papers for your course. You can take each paper once." />
      {!desk.enrolled ? (
        <EmptyState title="Waiting for enrollment" description="Your course will appear here after enrollment." />
      ) : desk.tests.length === 0 ? (
        <EmptyState title="No tests yet" description="Published papers for your course will appear here." />
      ) : (
        <ul className="space-y-3">
          {desk.tests.map((test) => (
            <li key={test.id}>
              <Link href={`/student/tests/${test.id}`} className="block rounded-[28px] bg-panel p-4 hover:bg-muted">
                <p className="text-sm font-medium">{test.title}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {test.subjectName} · {test.durationMinutes} minutes · {formatDateTime(test.opensAt)} to {formatDateTime(test.closesAt)}
                  {test.attemptStatus === "submitted" && test.score !== null ? ` · Score ${test.score}/${test.maxScore}` : ""}
                  {test.attemptStatus === "in_progress" ? " · In progress" : ""}
                  {test.attemptStatus === "expired" ? " · Expired" : ""}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export async function TestDetailScreen({ paperId }: { paperId: string }) {
  const result = await loadStudentPaper(paperId)
  if (!result.paper) {
    return (
      <div className="space-y-4">
        <PageHeader title="Test" description="This paper is not available." />
        <EmptyState title="Paper unavailable" description={result.error ?? "This paper is not open."} />
        <Link className="text-sm underline" href="/student/tests">
          All tests
        </Link>
      </div>
    )
  }
  const paper = result.paper
  const now = Date.now()
  const opens = Date.parse(paper.opensAt)
  const closes = Date.parse(paper.closesAt)
  const open = now >= opens && now < closes
  return (
    <div className="space-y-6">
      <PageHeader
        title={paper.title}
        description={`${paper.subjectName} · ${paper.durationMinutes} minutes · ${formatDateTime(paper.opensAt)} to ${formatDateTime(paper.closesAt)}`}
      />
      <Link className="text-sm underline" href="/student/tests">
        All tests
      </Link>
      {paper.attemptStatus === "submitted" ? (
        <p className="text-sm font-medium">
          Score {paper.score ?? 0}/{paper.maxScore}
        </p>
      ) : null}
      {paper.attemptStatus === "expired" ? (
        <EmptyState title="Attempt expired" description="The paper closed before this attempt was submitted." />
      ) : null}
      {!paper.attemptStatus && !open && now < opens ? (
        <EmptyState title="Not open yet" description={`This paper opens on ${formatDateTime(paper.opensAt)}.`} />
      ) : null}
      {!paper.attemptStatus && now >= closes ? (
        <EmptyState title="Paper closed" description="The window for this paper has ended." />
      ) : null}
      {paper.attemptStatus === "in_progress" || paper.attemptStatus === "submitted" ? (
        <AttemptActions
          paperId={paper.id}
          attemptId={paper.attemptId}
          questions={paper.questions}
          review={paper.attemptStatus === "submitted"}
        />
      ) : null}
      {!paper.attemptStatus && open ? <AttemptActions paperId={paper.id} attemptId={null} questions={[]} review={false} /> : null}
    </div>
  )
}

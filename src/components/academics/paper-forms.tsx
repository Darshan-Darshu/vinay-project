"use client"

import { saveAttempt, startAttempt } from "@/actions/academics/attempts"
import { deleteMaterial, saveMaterial } from "@/actions/academics/materials"
import { addPaperQuestion, createPaper, publishPaper, removePaperQuestion } from "@/actions/academics/papers"
import { saveResume } from "@/actions/academics/resume"
import type { SubjectChoice } from "@/actions/academics/shared"
import { FormFeedback, useFormAction } from "@/components/academics/feedback"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export function PaperCreateForm({ subjects }: { subjects: SubjectChoice[] }) {
  const [state, action, pending] = useFormAction(createPaper)
  return (
    <form action={action} className="max-w-2xl space-y-4 rounded-[28px] bg-panel p-4">
      <label className="block space-y-2 text-sm font-medium">
        Subject
        <select
          name="subjectId"
          defaultValue={subjects[0]?.id ?? ""}
          required
          className="h-8 w-full rounded-lg border border-input bg-background px-2 text-sm"
        >
          {subjects.map((subject) => (
            <option key={subject.id} value={subject.id}>
              {subject.name}
              {subject.courseName ? ` · ${subject.courseName}` : ""}
            </option>
          ))}
        </select>
      </label>
      <label className="block space-y-2 text-sm font-medium">
        Title
        <Input name="title" required maxLength={160} />
      </label>
      <label className="block space-y-2 text-sm font-medium">
        Suggested minutes
        <Input name="durationMinutes" type="number" min={1} max={300} defaultValue={30} required />
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block space-y-2 text-sm font-medium">
          Opens
          <Input name="opensAt" type="datetime-local" required />
        </label>
        <label className="block space-y-2 text-sm font-medium">
          Closes
          <Input name="closesAt" type="datetime-local" required />
        </label>
      </div>
      <FormFeedback state={state} />
      <Button type="submit" disabled={pending || subjects.length === 0}>
        {pending ? "Saving…" : "Save draft"}
      </Button>
    </form>
  )
}

export function AddQuestionForm({
  paperId,
  questions,
}: {
  paperId: string
  questions: { id: string; stem: string }[]
}) {
  const [state, action, pending] = useFormAction(addPaperQuestion)
  if (questions.length === 0) return <p className="text-sm text-muted-foreground">Every question in this subject is already on the paper.</p>
  return (
    <form action={action} className="flex flex-col gap-3 sm:flex-row sm:items-end">
      <input type="hidden" name="paperId" value={paperId} />
      <label className="block min-w-0 flex-1 space-y-2 text-sm font-medium">
        Add a question
        <select name="questionId" className="h-8 w-full rounded-lg border border-input bg-background px-2 text-sm" required>
          {questions.map((question) => (
            <option key={question.id} value={question.id}>
              {question.stem}
            </option>
          ))}
        </select>
      </label>
      <Button type="submit" disabled={pending}>
        {pending ? "Adding…" : "Add"}
      </Button>
      <FormFeedback state={state} />
    </form>
  )
}

export function RemoveQuestionButton({ paperId, questionId }: { paperId: string; questionId: string }) {
  const [state, action, pending] = useFormAction(removePaperQuestion)
  return (
    <form action={action}>
      <input type="hidden" name="paperId" value={paperId} />
      <input type="hidden" name="questionId" value={questionId} />
      <Button type="submit" variant="outline" disabled={pending}>
        Remove
      </Button>
      <FormFeedback state={state} />
    </form>
  )
}

export function PublishPaperButton({ paperId }: { paperId: string }) {
  const [state, action, pending] = useFormAction(publishPaper)
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="paperId" value={paperId} />
      <Button type="submit" disabled={pending}>
        {pending ? "Publishing…" : "Publish paper"}
      </Button>
      <FormFeedback state={state} />
    </form>
  )
}

export function MaterialForm({ subjects }: { subjects: SubjectChoice[] }) {
  const [state, action, pending] = useFormAction(saveMaterial)
  return (
    <form action={action} className="max-w-2xl space-y-4 rounded-[28px] bg-panel p-4">
      <label className="block space-y-2 text-sm font-medium">
        Subject
        <select name="subjectId" required className="h-8 w-full rounded-lg border border-input bg-background px-2 text-sm">
          {subjects.map((subject) => (
            <option key={subject.id} value={subject.id}>
              {subject.name}
              {subject.courseName ? ` · ${subject.courseName}` : ""}
            </option>
          ))}
        </select>
      </label>
      <label className="block space-y-2 text-sm font-medium">
        Title
        <Input name="title" required maxLength={160} />
      </label>
      <label className="block space-y-2 text-sm font-medium">
        Kind
        <select name="kind" defaultValue="pdf" className="h-8 w-full rounded-lg border border-input bg-background px-2 text-sm">
          <option value="pdf">PDF</option>
          <option value="link">Link</option>
        </select>
      </label>
      <label className="block space-y-2 text-sm font-medium">
        PDF
        <Input name="file" type="file" accept="application/pdf" />
      </label>
      <label className="block space-y-2 text-sm font-medium">
        Link
        <Input name="externalUrl" type="url" placeholder="https://" />
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="approvedForRag" value="true" />
        Mark for later search. This does not make the file searchable yet.
      </label>
      <FormFeedback state={state} />
      <Button type="submit" disabled={pending || subjects.length === 0}>
        {pending ? "Saving…" : "Save material"}
      </Button>
    </form>
  )
}

export function DeleteMaterialButton({ id }: { id: string }) {
  const [state, action, pending] = useFormAction(deleteMaterial)
  return (
    <form action={action}>
      <input type="hidden" name="id" value={id} />
      <Button type="submit" variant="outline" disabled={pending}>
        Remove
      </Button>
      <FormFeedback state={state} />
    </form>
  )
}

export function ResumeForm({ fileName, skills, href }: { fileName: string; skills: string; href: string }) {
  const [state, action, pending] = useFormAction(saveResume)
  return (
    <form action={action} className="max-w-lg space-y-4">
      <div className="space-y-2">
        <Label htmlFor="resume">Resume PDF</Label>
        <Input id="resume" name="resume" type="file" accept="application/pdf" />
        {fileName ? (
          <p className="text-sm text-muted-foreground">
            Current file: {href ? <a className="underline" href={href}>{fileName}</a> : fileName}. Uploading a new PDF replaces it.
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">PDF only, up to 5 MB.</p>
        )}
      </div>
      <div className="space-y-2">
        <Label htmlFor="skills">Skills</Label>
        <Input id="skills" name="skills" defaultValue={skills} placeholder="java, sql, communication" />
        <p className="text-sm text-muted-foreground">Separate skills with commas. Leave this blank if you have none to list yet.</p>
      </div>
      <FormFeedback state={state} />
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save resume"}
      </Button>
    </form>
  )
}

export function AttemptActions({
  paperId,
  attemptId,
  questions,
  review,
}: {
  paperId: string
  attemptId: string | null
  questions: {
    id: string
    stem: string
    marks: number
    explanation: string | null
    selectedOptionId: string | null
    options: { id: string; label: string; body: string; isCorrect: boolean | null }[]
  }[]
  review: boolean
}) {
  const [startState, startAction, startPending] = useFormAction(startAttempt)
  const [saveState, saveAction, savePending] = useFormAction(saveAttempt)

  if (!attemptId) {
    return (
      <form action={startAction}>
        <input type="hidden" name="paperId" value={paperId} />
        <Button type="submit" disabled={startPending}>
          {startPending ? "Starting…" : "Start attempt"}
        </Button>
        <FormFeedback state={startState} />
      </form>
    )
  }

  return (
    <form action={saveAction} className="space-y-6">
      <input type="hidden" name="attemptId" value={attemptId} />
      <input type="hidden" name="paperId" value={paperId} />
      {questions.map((question, index) => (
        <fieldset key={question.id} className="space-y-2 rounded-[28px] bg-panel p-4" disabled={review}>
          <input type="hidden" name="questionId" value={question.id} />
          <legend className="text-sm font-medium">
            {index + 1}. {question.stem} <span className="text-muted-foreground">({question.marks} marks)</span>
          </legend>
          {question.options.map((option) => (
            <label key={option.id} className="flex items-start gap-2 text-sm">
              <input
                type="radio"
                name={`option-${question.id}`}
                value={option.id}
                defaultChecked={question.selectedOptionId === option.id}
              />
              <span>
                {option.label}. {option.body}
                {review && option.isCorrect ? " · Correct" : ""}
                {review && question.selectedOptionId === option.id && option.isCorrect === false ? " · Your answer" : ""}
              </span>
            </label>
          ))}
          {review && question.explanation ? (
            <p className="text-sm text-muted-foreground">{question.explanation}</p>
          ) : null}
        </fieldset>
      ))}
      {review ? null : (
        <div className="flex gap-2">
          <Button type="submit" name="intent" value="save" variant="outline" disabled={savePending}>
            Save progress
          </Button>
          <Button type="submit" name="intent" value="submit" disabled={savePending}>
            {savePending ? "Saving…" : "Submit"}
          </Button>
        </div>
      )}
      <FormFeedback state={saveState} />
    </form>
  )
}

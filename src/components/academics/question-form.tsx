"use client"

import type { ReactNode } from "react"

import { deleteQuestion, saveQuestion, type QuestionView } from "@/actions/academics/questions"
import type { SubjectChoice } from "@/actions/academics/shared"
import { FormFeedback, useFormAction } from "@/components/academics/feedback"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

export function QuestionForm({
  subjects,
  question,
}: {
  subjects: SubjectChoice[]
  question: QuestionView | null
}) {
  const [state, action, pending] = useFormAction(saveQuestion)
  const frozen = question?.frozen ?? false

  return (
    <form action={action} className="max-w-2xl space-y-4 rounded-[28px] bg-panel p-4">
      {question ? <input type="hidden" name="id" value={question.id} /> : null}
      <Field label="Subject">
        <select
          name="subjectId"
          defaultValue={question?.subjectId ?? subjects[0]?.id ?? ""}
          disabled={frozen || subjects.length === 0}
          className="h-8 w-full rounded-lg border border-input bg-background px-2 text-sm"
          required
        >
          {subjects.map((subject) => (
            <option key={subject.id} value={subject.id}>
              {subject.name}
              {subject.courseName ? ` · ${subject.courseName}` : ""}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Topic">
        <Input name="topic" defaultValue={question?.topic ?? ""} maxLength={120} disabled={frozen} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Type">
          <select
            name="questionType"
            defaultValue={question?.questionType ?? "mcq"}
            disabled={frozen}
            className="h-8 w-full rounded-lg border border-input bg-background px-2 text-sm"
          >
            <option value="mcq">Multiple choice</option>
            <option value="true_false">True or false</option>
          </select>
        </Field>
        <Field label="Difficulty">
          <select
            name="difficulty"
            defaultValue={question?.difficulty ?? "medium"}
            disabled={frozen}
            className="h-8 w-full rounded-lg border border-input bg-background px-2 text-sm"
          >
            <option value="easy">Easy</option>
            <option value="medium">Medium</option>
            <option value="hard">Hard</option>
          </select>
        </Field>
        <Field label="Marks">
          <Input name="marks" type="number" min={1} max={100} defaultValue={question?.marks ?? 1} disabled={frozen} required />
        </Field>
      </div>
      <Field label="Question">
        <Textarea name="stem" defaultValue={question?.stem ?? ""} required maxLength={4000} disabled={frozen} />
      </Field>
      <fieldset className="space-y-2" disabled={frozen}>
        <legend className="text-sm font-medium">Options</legend>
        <p className="text-sm text-muted-foreground">
          Mark one correct answer. True or false uses the first two choices as True and False.
        </p>
        {["A", "B", "C", "D"].map((label, index) => (
          <div key={label} className="flex items-center gap-2">
            <input
              type="radio"
              name="correct"
              value={String(index)}
              defaultChecked={question ? question.options[index]?.isCorrect === true : index === 0}
              required
            />
            <Label className="w-4">{label}</Label>
            <Input
              name={`option${index}`}
              defaultValue={question?.options[index]?.body ?? (index < 2 ? "" : "")}
              placeholder={index < 2 ? "Required" : "Optional"}
              maxLength={1000}
            />
          </div>
        ))}
      </fieldset>
      <Field label="Explanation">
        <Textarea name="explanation" defaultValue={question?.explanation ?? ""} maxLength={4000} disabled={frozen} />
      </Field>
      <FormFeedback state={state} />
      {frozen ? (
        <p className="text-sm text-muted-foreground">This question is on a published paper, so it stays as it was published.</p>
      ) : (
        <Button type="submit" disabled={pending || subjects.length === 0}>
          {pending ? "Saving…" : "Save question"}
        </Button>
      )}
    </form>
  )
}

export function DeleteQuestionButton({ id }: { id: string }) {
  const [state, action, pending] = useFormAction(deleteQuestion)
  return (
    <form action={action}>
      <input type="hidden" name="id" value={id} />
      <Button type="submit" variant="destructive" disabled={pending}>
        {pending ? "Deleting…" : "Delete"}
      </Button>
      <FormFeedback state={state} />
    </form>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block space-y-2 text-sm font-medium">
      {label}
      {children}
    </label>
  )
}

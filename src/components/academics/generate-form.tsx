"use client"

import { generateQuestionDrafts } from "@/actions/ai/questions"
import type { SubjectChoice } from "@/actions/academics/shared"
import { FormFeedback, useFormAction } from "@/components/academics/feedback"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

export function GenerateDraftsForm({ subjects }: { subjects: SubjectChoice[] }) {
  const [state, action, pending] = useFormAction(generateQuestionDrafts)
  return (
    <form action={action} className="max-w-2xl space-y-4 rounded-[28px] bg-panel p-4">
      <h2 className="text-sm font-medium">Generate drafts</h2>
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
        Topic
        <Input name="topic" required maxLength={120} />
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block space-y-2 text-sm font-medium">
          How many
          <Input name="count" type="number" min={1} max={10} defaultValue={5} required />
        </label>
        <label className="block space-y-2 text-sm font-medium">
          Difficulty
          <select name="difficulty" defaultValue="medium" className="h-8 w-full rounded-lg border border-input bg-background px-2 text-sm">
            <option value="easy">Easy</option>
            <option value="medium">Medium</option>
            <option value="hard">Hard</option>
          </select>
        </label>
      </div>
      <FormFeedback state={state} />
      <Button type="submit" disabled={pending || subjects.length === 0}>
        {pending ? "Generating…" : "Generate drafts"}
      </Button>
    </form>
  )
}

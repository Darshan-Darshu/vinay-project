"use client"

import { saveExamMarks } from "@/actions/ai/exam-marks"
import { FormFeedback, useFormAction } from "@/components/academics/feedback"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

export function ExamMarksForm() {
  const [state, action, pending] = useFormAction(saveExamMarks)
  return (
    <form action={action} className="max-w-2xl space-y-4 rounded-[28px] bg-panel p-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block space-y-2 text-sm font-medium">
          Roll number
          <Input name="rollNumber" required />
        </label>
        <label className="block space-y-2 text-sm font-medium">
          Subject code
          <Input name="subjectCode" required />
        </label>
        <label className="block space-y-2 text-sm font-medium">
          Exam name
          <Input name="examName" required />
        </label>
        <label className="block space-y-2 text-sm font-medium">
          Score
          <Input name="score" type="number" min={0} max={100} required />
        </label>
        <label className="block space-y-2 text-sm font-medium">
          Maximum
          <Input name="maximum" type="number" min={1} max={100} required />
        </label>
      </div>
      <label className="block space-y-2 text-sm font-medium">
        Or upload a CSV
        <Input name="csv" type="file" accept=".csv,text/csv" />
      </label>
      <FormFeedback state={state} />
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save exam marks"}
      </Button>
    </form>
  )
}

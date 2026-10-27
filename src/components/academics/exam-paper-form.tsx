"use client"

import { useState } from "react"
import { Minus, Plus } from "lucide-react"

import { generateExamPaper } from "@/actions/ai/exam-papers"
import { deleteExamPaper } from "@/actions/academics/exam-papers"
import type { SubjectChoice } from "@/actions/academics/shared"
import { FormFeedback, useFormAction } from "@/components/academics/feedback"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  canGenerateExamPaper,
  examPaperBands,
  examPaperMaxQuestions,
  examPaperQuestionCount,
  examPaperTotal,
  type ExamPaperCounts,
} from "@/lib/ai/exam-paper"
import { cn } from "@/lib/utils"

const emptyCounts: ExamPaperCounts = { one: 0, two: 0, five: 0, twenty: 0 }

export function ExamPaperForm({ subjects }: { subjects: SubjectChoice[] }) {
  const [state, action, pending] = useFormAction(generateExamPaper)
  const [counts, setCounts] = useState<ExamPaperCounts>(emptyCounts)
  const [difficulty, setDifficulty] = useState<"easy" | "medium" | "hard">("medium")
  const total = examPaperTotal(counts)
  const questionCount = examPaperQuestionCount(counts)
  const ready = canGenerateExamPaper(counts)

  function step(key: keyof ExamPaperCounts, delta: number) {
    setCounts((current) => {
      const band = examPaperBands.find((item) => item.key === key)
      if (!band) return current
      const nextValue = current[key] + delta
      if (nextValue < 0 || nextValue > band.limit) return current
      const next = { ...current, [key]: nextValue }
      if (examPaperQuestionCount(next) > examPaperMaxQuestions) return current
      return next
    })
  }

  return (
    <form action={action} className="max-w-2xl space-y-4 rounded-[28px] bg-panel p-4">
      <h2 className="text-sm font-medium">Generate a paper</h2>
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
        Topics
        <textarea
          name="topics"
          required
          maxLength={500}
          rows={3}
          placeholder="normalization, SQL joins"
          className="w-full rounded-lg border border-input bg-background px-2 py-1.5 text-sm"
        />
      </label>
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Difficulty</legend>
        <div className="grid grid-cols-3 gap-2">
          {(["easy", "medium", "hard"] as const).map((level) => (
            <button
              key={level}
              type="button"
              aria-pressed={difficulty === level}
              onClick={() => setDifficulty(level)}
              className={cn(
                "h-10 rounded-xl border text-sm font-medium capitalize",
                difficulty === level ? "border-primary bg-primary text-primary-foreground" : "border-input bg-background",
              )}
            >
              {level}
            </button>
          ))}
        </div>
        <input type="hidden" name="difficulty" value={difficulty} />
      </fieldset>
      <div className="grid gap-3 sm:grid-cols-2">
        {examPaperBands.map((band) => {
          const atFloor = counts[band.key] === 0
          const atCap = counts[band.key] >= band.limit || questionCount >= examPaperMaxQuestions
          return (
            <div key={band.key} className="rounded-2xl border border-input bg-background p-3">
              <p className="text-sm font-medium">{band.label}</p>
              <div className="mt-3 flex items-center justify-between">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  aria-label={`Fewer ${band.label} questions`}
                  disabled={atFloor}
                  onClick={() => step(band.key, -1)}
                >
                  <Minus />
                </Button>
                <span className="text-lg font-semibold tabular-nums">{counts[band.key]}</span>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  aria-label={`More ${band.label} questions`}
                  disabled={atCap}
                  onClick={() => step(band.key, 1)}
                >
                  <Plus />
                </Button>
              </div>
              <input type="hidden" name={band.key} value={counts[band.key]} />
            </div>
          )
        })}
      </div>
      <p className="text-sm">
        <span className="text-2xl font-semibold tabular-nums">{total}</span> {total === 1 ? "mark" : "marks"}
        <span className="text-muted-foreground"> · {questionCount} of {examPaperMaxQuestions} questions</span>
      </p>
      <FormFeedback state={state} />
      <Button type="submit" disabled={pending || !ready || subjects.length === 0}>
        {pending ? "Generating…" : "Generate paper"}
      </Button>
    </form>
  )
}

export function PrintPaperButton() {
  return (
    <Button type="button" variant="outline" className="print:hidden" onClick={() => window.print()}>
      Print
    </Button>
  )
}

export function DeleteExamPaperButton({ paperId }: { paperId: string }) {
  const [state, action, pending] = useFormAction(deleteExamPaper)
  return (
    <form action={action} className="print:hidden">
      <input type="hidden" name="paperId" value={paperId} />
      <Button type="submit" variant="outline" disabled={pending}>
        {pending ? "Deleting…" : "Delete paper"}
      </Button>
      <FormFeedback state={state} />
    </form>
  )
}

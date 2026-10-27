import { loadExamMarks } from "@/actions/ai/exam-marks"
import { ExamMarksForm } from "@/components/academics/exam-marks-form"
import { PageHeader } from "@/components/dashboard/stat-card"
import { EmptyState } from "@/components/dashboard/states"

export async function ExamMarksScreen() {
  const marks = await loadExamMarks()
  return (
    <div className="space-y-6">
      <PageHeader title="Exam marks" description="Enter one row or upload a CSV. Quiz scores stay automatic." />
      <ExamMarksForm />
      {marks.length === 0 ? (
        <EmptyState title="No exam marks yet" description="Saved rows appear here." />
      ) : (
        <ul className="space-y-3">
          {marks.map((mark) => (
            <li key={mark.id} className="rounded-[28px] bg-panel p-4 text-sm">
              {mark.rollNumber} · {mark.subjectCode} · {mark.examName} · {mark.score}/{mark.maximum}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

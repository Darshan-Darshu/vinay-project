import Link from "next/link"

import { loadExamPaper, loadExamPaperDesk } from "@/actions/academics/exam-papers"
import { DeleteExamPaperButton, ExamPaperForm, PrintPaperButton } from "@/components/academics/exam-paper-form"
import { PageHeader } from "@/components/dashboard/stat-card"
import { EmptyState } from "@/components/dashboard/states"
import type { SectionMark } from "@/lib/ai/exam-paper"
import type { AppRole } from "@/lib/permissions/roles"

const sectionLabels: Record<SectionMark, string> = {
  1: "Section A · 1 mark each",
  2: "Section B · 2 marks each",
  5: "Section C · 5 marks each",
  20: "Section D · 20 marks each",
}

const sectionOrder: SectionMark[] = [1, 2, 5, 20]

export async function ExamPaperListScreen({ role }: { role: Extract<AppRole, "admin" | "teacher"> }) {
  const desk = await loadExamPaperDesk()
  return (
    <div className="space-y-6">
      <PageHeader
        title="Exam papers"
        description="Set how many questions of each mark, then generate a written paper. Students do not see it."
      />
      {desk.subjects.length === 0 ? (
        <EmptyState title="No subjects yet" description="The office has not assigned subjects yet." />
      ) : (
        <ExamPaperForm subjects={desk.subjects} />
      )}
      {desk.papers.length === 0 ? (
        <EmptyState title="No exam papers yet" description="Generated papers appear here." />
      ) : (
        <ul className="space-y-3">
          {desk.papers.map((paper) => (
            <li key={paper.id}>
              <Link href={`/${role}/exam-papers/${paper.id}`} className="block rounded-[28px] bg-panel p-4 hover:bg-muted">
                <p className="text-sm font-medium">{paper.title}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {paper.subjectName} · {capitalize(paper.difficulty)} · {marksLabel(paper.totalMarks)} · {paper.questionCount} questions
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export async function ExamPaperDetailScreen({
  role,
  paperId,
}: {
  role: Extract<AppRole, "admin" | "teacher">
  paperId: string
}) {
  const paper = await loadExamPaper(paperId)
  if (!paper) return null
  const sections = sectionOrder.flatMap((marks) => {
    const questions = paper.questions.filter((question) => question.sectionMarks === marks)
    return questions.length === 0 ? [] : [{ marks, questions }]
  })

  return (
    <div className="space-y-6">
      <PageHeader
        title={paper.title}
        description={`${paper.subjectName} · ${capitalize(paper.difficulty)} · ${marksLabel(paper.totalMarks)}`}
      />
      <p className="text-sm text-muted-foreground">{paper.topics}</p>
      <div className="flex flex-wrap items-center gap-3 print:hidden">
        <Link className="text-sm underline" href={`/${role}/exam-papers`}>
          All exam papers
        </Link>
        <PrintPaperButton />
        <DeleteExamPaperButton paperId={paper.id} />
      </div>
      {sections.map((section) => (
        <section key={section.marks} className="space-y-3">
          <h2 className="text-sm font-medium">{sectionLabels[section.marks]}</h2>
          <ol className="space-y-3">
            {section.questions.map((question, index) => (
              <li key={question.ordinal} className="rounded-[28px] bg-panel p-4 text-sm">
                {index + 1}. {question.stem}
              </li>
            ))}
          </ol>
        </section>
      ))}
    </div>
  )
}

function marksLabel(total: number) {
  return `${total} ${total === 1 ? "mark" : "marks"}`
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

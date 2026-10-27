"use server"

import { fail, field, ok, refreshAcademic, staffContext } from "@/actions/academics/shared"
import type { FormState } from "@/actions/form-state"
import { parseExamCsv, parseExamMark } from "@/lib/ai/exam-marks"
import { isRecord, QueryError } from "@/lib/db/errors"
import { revalidatePath } from "next/cache"

export type ExamMarkView = {
  id: string
  rollNumber: string
  subjectCode: string
  subjectName: string
  examName: string
  score: number
  maximum: number
}

export async function loadExamMarks() {
  const { supabase } = await staffContext()
  const marks = await supabase
    .from("exam_marks")
    .select("id, exam_name, score, maximum, students(roll_number), subjects(code, name)")
    .order("exam_name")
  if (marks.error) throw new QueryError()
  return (marks.data ?? []).flatMap(toMark)
}

export async function saveExamMarks(_previous: FormState, formData: FormData): Promise<FormState> {
  await staffContext()
  const file = formData.get("csv")
  const rows = file instanceof File && file.size > 0
    ? parseExamCsv(await file.text())
    : [parseExamMark({
        rollNumber: field(formData, "rollNumber"),
        subjectCode: field(formData, "subjectCode"),
        examName: field(formData, "examName"),
        score: Number(field(formData, "score")),
        maximum: Number(field(formData, "maximum")),
      })].filter((row) => row !== null)
  if (!rows || rows.length === 0) return fail("Check the exam marks and try again.")

  const { supabase } = await staffContext()
  const saved = await supabase.rpc("save_exam_marks", { rows })
  if (saved.error) return fail("Check the exam marks and try again.")
  refreshAcademic()
  revalidatePath("/admin/exam-marks")
  revalidatePath("/teacher/exam-marks")
  return ok("Exam marks saved.")
}

function toMark(value: unknown): ExamMarkView[] {
  if (!isRecord(value) || typeof value.id !== "string" || typeof value.exam_name !== "string") return []
  if (typeof value.score !== "number" || typeof value.maximum !== "number") return []
  const student = isRecord(value.students) ? value.students : null
  const subject = isRecord(value.subjects) ? value.subjects : null
  if (!student || !subject || typeof student.roll_number !== "string" || typeof subject.code !== "string" || typeof subject.name !== "string") {
    return []
  }
  return [{
    id: value.id,
    rollNumber: student.roll_number,
    subjectCode: subject.code,
    subjectName: subject.name,
    examName: value.exam_name,
    score: value.score,
    maximum: value.maximum,
  }]
}

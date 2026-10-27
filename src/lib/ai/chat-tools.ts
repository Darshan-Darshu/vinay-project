import "server-only"

import {
  saveAcademicYear,
  saveCourse,
  saveDepartment,
  saveSemester,
  saveSubject,
} from "@/actions/admin/records/save-catalog"
import { saveAnnouncement, saveEvent } from "@/actions/admin/records/save-campus"
import { saveAdmission, saveStudent, saveTeacher, setAdmissionStatus, enrollAdmission } from "@/actions/admin/records/save-people"
import { savePlacementDrive, setPlacementApplicationStatus } from "@/actions/admin/records/save-placements"
import { updateCollegeSettings } from "@/actions/admin/settings/updateQueries"
import { saveMaterial } from "@/actions/academics/materials"
import { saveQuestion } from "@/actions/academics/questions"
import { saveResume } from "@/actions/academics/resume"
import { updateProfile } from "@/actions/account/profile/updateQueries"
import { applyToDrive } from "@/actions/student/placements/apply"
import {
  getCollegeSettings,
  listCourses,
  listDepartments,
  listPublicAnnouncements,
  listPublicEvents,
} from "@/actions/college/catalog/getQueries"
import { getAdminOffice } from "@/actions/admin/dashboard/getQueries"
import { saveExamMarks } from "@/actions/ai/exam-marks"
import { prepareStoredPdf, searchPassages } from "@/actions/ai/passages"
import type { FormState } from "@/actions/form-state"
import { createClient } from "@/lib/supabase/server"
import type { AppRole } from "@/lib/permissions/roles"

const empty: FormState = { error: null, success: null }

export async function readCampus() {
  const [settings, departments, courses, events, announcements] = await Promise.all([
    getCollegeSettings(),
    listDepartments(),
    listCourses(),
    listPublicEvents(),
    listPublicAnnouncements(),
  ])
  return JSON.stringify({
    settings,
    departments: departments.slice(0, 20),
    courses: courses.slice(0, 20),
    events: events.slice(0, 20),
    announcements: announcements.slice(0, 20),
  })
}

export async function readOfficeCounts() {
  const office = await getAdminOffice()
  return JSON.stringify({
    students: office.students,
    teachers: office.teachers,
    departments: office.departments,
    newAdmissions: office.newAdmissions,
    openDrives: office.openDrives,
    pendingApplications: office.pendingApplications,
    activeCourses: office.activeCourses,
  })
}

export async function readOwnScores() {
  const supabase = await createClient()
  const scores = await supabase.rpc("own_quiz_scores")
  return JSON.stringify(scores.data ?? [])
}

export async function readTaughtClass() {
  const supabase = await createClient()
  const [students, scores, marks] = await Promise.all([
    supabase.from("students").select("roll_number, profiles(full_name)").is("deleted_at", null).limit(20),
    supabase.rpc("taught_quiz_scores"),
    supabase.from("exam_marks").select("exam_name, score, maximum, students(roll_number), subjects(code)").limit(20),
  ])
  return JSON.stringify({
    students: students.data ?? [],
    scores: scores.data ?? [],
    examMarks: marks.data ?? [],
  })
}

export async function readNotes(query: string, role: AppRole) {
  const passages = await searchPassages(query, role)
  return JSON.stringify(passages)
}

export async function saveManualQuestion(fields: Record<string, string>) {
  const form = new FormData()
  for (const [key, value] of Object.entries(fields)) form.set(key, value)
  return text(await saveQuestion(empty, form))
}

export async function saveLink(fields: Record<string, string>) {
  const form = new FormData()
  form.set("kind", "link")
  form.set("approvedForRag", "false")
  for (const [key, value] of Object.entries(fields)) form.set(key, value)
  return text(await saveMaterial(empty, form))
}

export async function preparePdf(materialId: string) {
  const prepared = await prepareStoredPdf(materialId)
  return prepared ? "Passages saved." : "We couldn't generate a response right now. Please try again."
}

export async function saveMarks(csv: string) {
  const form = new FormData()
  form.set("csvText", csv)
  const file = new File([csv], "marks.csv", { type: "text/csv" })
  form.set("csv", file)
  return text(await saveExamMarks(empty, form))
}

export async function saveOwnProfile(fullName: string, phone: string) {
  const form = new FormData()
  form.set("fullName", fullName)
  form.set("phone", phone)
  return text(await updateProfile(empty, form))
}

export async function saveOwnSkills(skills: string) {
  const form = new FormData()
  form.set("skills", skills)
  return text(await saveResume(empty, form))
}

export async function applyDrive(driveId: string) {
  const form = new FormData()
  form.set("driveId", driveId)
  return text(await applyToDrive(empty, form))
}

export async function saveAdminRecord(kind: string, fields: Record<string, string>) {
  const form = toForm(fields)
  const action = adminActions[kind]
  if (!action) return "That record cannot be changed from the assistant."
  return text(await action(empty, form))
}

const adminActions: Record<string, (previous: FormState, formData: FormData) => Promise<FormState>> = {
  department: saveDepartment,
  course: saveCourse,
  subject: saveSubject,
  academicYear: saveAcademicYear,
  semester: saveSemester,
  teacher: saveTeacher,
  student: saveStudent,
  admission: saveAdmission,
  admissionStatus: setAdmissionStatus,
  enrollAdmission,
  announcement: saveAnnouncement,
  event: saveEvent,
  placement: savePlacementDrive,
  applicationStatus: setPlacementApplicationStatus,
  collegeSettings: updateCollegeSettings,
  profile: updateProfile,
}

function toForm(fields: Record<string, string>) {
  const form = new FormData()
  for (const [key, value] of Object.entries(fields)) {
    if (key === "subjectIds") {
      for (const id of value.split(",").map((item) => item.trim()).filter(Boolean)) form.append(key, id)
    } else if (value.length > 0) {
      form.set(key, value)
    }
  }
  return form
}

function text(state: FormState) {
  return state.error ?? state.success ?? "Saved."
}

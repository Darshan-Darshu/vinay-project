export function allowStep(used: number, limit: number) {
  return used < limit
}

export const guestToolNames = [
  "read_admissions_info",
  "list_departments",
  "list_courses",
  "read_course",
  "list_subjects",
  "list_academic_years",
  "list_semesters",
  "offer_application_form",
  "read_college_profile",
  "list_events",
  "list_announcements",
  "search_college",
  "ask_admissions",
  "ask_college",
] as const

const writeToolNames = new Set([
  "save_exam_marks",
  "save_question",
  "save_link_material",
  "prepare_pdf",
  "save_record",
  "update_profile",
  "update_skills",
  "apply_drive",
])

export function guestToolListIsSafe(names: readonly string[]) {
  return names.every((name) => !writeToolNames.has(name) && !name.includes("student") && !name.includes("quiz"))
}

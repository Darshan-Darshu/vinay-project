export type OfficeTask = {
  id: string
  title: string
  detail: string
  href: string
  urgent: boolean
}

export type ReadinessCheck = {
  label: string
  done: boolean
}

export type AdmissionPipeline = {
  applied: number
  underReview: number
  approved: number
  rejected: number
  completed: number
}

const placeholderAbout = "Update this introduction from Admin settings after you sign in."
const placeholderAdmissions = "Admission steps, eligibility, and important dates will be published here."

export function isCollegeProfileReady(settings: {
  name: string
  about: string
  address: string
  phone: string
  email: string
  admissionsInfo: string
} | null): boolean {
  if (!settings) return false
  return (
    settings.name.trim().length > 0 &&
    settings.name.trim().toLowerCase() !== "college" &&
    settings.about.trim().length > 0 &&
    settings.about.trim() !== placeholderAbout &&
    settings.address.trim().length > 0 &&
    settings.phone.trim().length > 0 &&
    settings.email.trim().length > 0 &&
    settings.admissionsInfo.trim().length > 0 &&
    settings.admissionsInfo.trim() !== placeholderAdmissions
  )
}

export function buildReadiness(input: {
  profileReady: boolean
  departments: number
  courses: number
  subjects: number
  hasCurrentYear: boolean
}): ReadinessCheck[] {
  return [
    { label: "College profile published", done: input.profileReady },
    { label: "Current academic year", done: input.hasCurrentYear },
    { label: "At least one department", done: input.departments > 0 },
    { label: "At least one course", done: input.courses > 0 },
    { label: "Subjects on the catalog", done: input.subjects > 0 },
  ]
}

export function readinessPercent(checks: ReadinessCheck[]): number {
  if (checks.length === 0) return 0
  const done = checks.filter((check) => check.done).length
  return Math.round((done / checks.length) * 100)
}

export function buildOfficeTasks(input: {
  profileReady: boolean
  departments: number
  courses: number
  subjects: number
  hasCurrentYear: boolean
  pipeline: AdmissionPipeline
  draftEvents: number
  pendingApplications: number
}): OfficeTask[] {
  const tasks: OfficeTask[] = []
  const waiting = input.pipeline.applied + input.pipeline.underReview

  if (!input.profileReady) {
    tasks.push({
      id: "profile",
      title: "Publish the college profile",
      detail: "The landing page uses the name, about text, contact details, and admissions note.",
      href: "/admin/settings",
      urgent: true,
    })
  }
  if (!input.hasCurrentYear) {
    tasks.push({
      id: "year",
      title: "Mark the current academic year",
      detail: "Students and teachers need one open year before a semester can be assigned.",
      href: "/admin/academic-years",
      urgent: true,
    })
  }
  if (input.departments === 0) {
    tasks.push({
      id: "departments",
      title: "Add the first department",
      detail: "Courses, subjects, and admissions all belong to a department.",
      href: "/admin/departments",
      urgent: true,
    })
  }
  if (input.departments > 0 && input.courses === 0) {
    tasks.push({
      id: "courses",
      title: "Add a course",
      detail: "A course is what an applicant joins and what a student is enrolled in.",
      href: "/admin/courses",
      urgent: true,
    })
  }
  if (input.courses > 0 && input.subjects === 0) {
    tasks.push({
      id: "subjects",
      title: "Add subjects",
      detail: "Teachers and students cannot see a timetable until subjects exist.",
      href: "/admin/subjects",
      urgent: false,
    })
  }
  if (waiting > 0) {
    tasks.push({
      id: "admissions",
      title: `Review ${waiting} admission ${waiting === 1 ? "application" : "applications"}`,
      detail: "Applied and under-review files are waiting on the office. Approved files can become student accounts.",
      href: "/admin/admissions",
      urgent: true,
    })
  }
  if (input.pendingApplications > 0) {
    const count = input.pendingApplications
    tasks.push({
      id: "placements",
      title: `Review ${count} placement ${count === 1 ? "application" : "applications"}`,
      detail: "Students have applied to a company visit and are waiting on the office.",
      href: "/admin/placements",
      urgent: true,
    })
  }
  if (input.draftEvents > 0) {
    tasks.push({
      id: "events",
      title: `Publish ${input.draftEvents} draft ${input.draftEvents === 1 ? "event" : "events"}`,
      detail: "Draft events stay off the landing page and the student portal until they are published.",
      href: "/admin/events",
      urgent: false,
    })
  }
  if (tasks.length === 0) {
    tasks.push({
      id: "clear",
      title: "No office work is waiting",
      detail: "Profile, catalog, and the admissions queue are clear. New applications will show up here.",
      href: "/admin",
      urgent: false,
    })
  }
  return tasks
}

export function pipelineTotal(pipeline: AdmissionPipeline): number {
  return (
    pipeline.applied +
    pipeline.underReview +
    pipeline.approved +
    pipeline.rejected +
    pipeline.completed
  )
}

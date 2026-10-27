export type NamedOption = {
  id: string
  name: string
  inactive?: boolean
}

export type CourseOption = NamedOption & {
  departmentId: string
  durationSemesters: number
}

export type SemesterOption = {
  id: string
  courseId: string
  academicYearId: string
  number: number
  label: string
  inactive?: boolean
}

export type SubjectOption = NamedOption & {
  courseName: string
}

export type EditorOptions = {
  departments: NamedOption[]
  courses: CourseOption[]
  years: NamedOption[]
  semesters: SemesterOption[]
  subjects: SubjectOption[]
}

export type DepartmentValues = {
  id: string
  name: string
  code: string
  description: string
  isActive: boolean
}

export type CourseValues = {
  id: string
  departmentId: string
  name: string
  code: string
  durationSemesters: number
  description: string
  isActive: boolean
}

export type SubjectValues = {
  id: string
  departmentId: string
  courseId: string
  semesterNumber: number
  name: string
  code: string
  credits: number
  isActive: boolean
}

export type AcademicYearValues = {
  id: string
  name: string
  startsOn: string
  endsOn: string
  isCurrent: boolean
}

export type SemesterValues = {
  id: string
  courseId: string
  academicYearId: string
  number: number
  isActive: boolean
}

export type TeacherValues = {
  id: string
  fullName: string
  email: string
  phone: string
  departmentId: string
  employeeCode: string
  designation: string
  isActive: boolean
  subjectIds: string[]
}

export type StudentValues = {
  id: string
  fullName: string
  email: string
  rollNumber: string
  departmentId: string
  courseId: string
  semesterId: string
  isActive: boolean
}

export type AdmissionValues = {
  id: string
  fullName: string
  email: string
  phone: string
  departmentId: string
  courseId: string
  semesterId: string
  notes: string
  status: string
}

export type AnnouncementValues = {
  id: string
  title: string
  body: string
  audience: string
  departmentId: string
  priority: string
  publishAt: string
  expiresAt: string
  status: string
}

export type PlacementApplicant = {
  id: string
  studentName: string
  rollNumber: string
  courseName: string
  departmentName: string
  status: string
}

export type PlacementValues = {
  id: string
  companyName: string
  roleTitle: string
  description: string
  packageText: string
  location: string
  jobType: string
  eligibility: string
  requiredSkills: string
  departmentId: string
  courseId: string
  applyBy: string
  visitAt: string
  venue: string
  status: string
  applicants: PlacementApplicant[]
}

export type EventValues = {
  id: string
  title: string
  description: string
  eventType: string
  startsAt: string
  endsAt: string
  venue: string
  status: string
  isPublic: boolean
}

export type EditorRecord =
  | { kind: "department"; values: DepartmentValues }
  | { kind: "course"; values: CourseValues }
  | { kind: "subject"; values: SubjectValues }
  | { kind: "academic-year"; values: AcademicYearValues }
  | { kind: "semester"; values: SemesterValues }
  | { kind: "teacher"; values: TeacherValues }
  | { kind: "student"; values: StudentValues }
  | { kind: "admission"; values: AdmissionValues }
  | { kind: "announcement"; values: AnnouncementValues }
  | { kind: "event"; values: EventValues }
  | { kind: "sports"; values: EventValues }
  | { kind: "placement"; values: PlacementValues }

export type EditorLoad =
  | { error: string; record: null; options: null }
  | { error: null; record: EditorRecord | null; options: EditorOptions }

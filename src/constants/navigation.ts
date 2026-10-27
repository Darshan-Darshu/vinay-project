import type { AppRole } from "@/lib/permissions/roles"

export type NavItem = {
  href: string
  label: string
}

export const adminNav: NavItem[] = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/admissions", label: "Admissions" },
  { href: "/admin/students", label: "Students" },
  { href: "/admin/teachers", label: "Teachers" },
  { href: "/admin/departments", label: "Departments" },
  { href: "/admin/courses", label: "Courses" },
  { href: "/admin/subjects", label: "Subjects" },
  { href: "/admin/questions", label: "Questions" },
  { href: "/admin/papers", label: "Papers" },
  { href: "/admin/exam-papers", label: "Exam papers" },
  { href: "/admin/materials", label: "Materials" },
  { href: "/admin/exam-marks", label: "Exam marks" },
  { href: "/admin/academic-years", label: "Academic Years" },
  { href: "/admin/semesters", label: "Semesters" },
  { href: "/admin/announcements", label: "Announcements" },
  { href: "/admin/events", label: "Events" },
  { href: "/admin/sports", label: "Sports" },
  { href: "/admin/placements", label: "Placements" },
  { href: "/admin/settings", label: "Settings" },
  { href: "/admin/profile", label: "Profile" },
]

export const teacherNav: NavItem[] = [
  { href: "/teacher", label: "Dashboard" },
  { href: "/teacher/subjects", label: "My Subjects" },
  { href: "/teacher/questions", label: "Questions" },
  { href: "/teacher/papers", label: "Papers" },
  { href: "/teacher/exam-papers", label: "Exam papers" },
  { href: "/teacher/materials", label: "Materials" },
  { href: "/teacher/exam-marks", label: "Exam marks" },
  { href: "/teacher/students", label: "Students" },
  { href: "/teacher/announcements", label: "Announcements" },
  { href: "/teacher/profile", label: "Profile" },
]

export const studentNav: NavItem[] = [
  { href: "/student", label: "Dashboard" },
  { href: "/student/subjects", label: "My Subjects" },
  { href: "/student/tests", label: "Tests" },
  { href: "/student/interview", label: "Interview" },
  { href: "/student/materials", label: "Materials" },
  { href: "/student/placement", label: "Placements" },
  { href: "/student/events", label: "Events" },
  { href: "/student/announcements", label: "Announcements" },
  { href: "/student/profile", label: "Profile" },
]

export function navForRole(role: AppRole): NavItem[] {
  switch (role) {
    case "admin":
      return adminNav
    case "teacher":
      return teacherNav
    case "student":
      return studentNav
  }
}

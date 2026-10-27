import "server-only"

import { listAnnouncementCards, listCampusEventCards, listSportsCards, listStudentEventCards } from "@/actions/records/campus"
import { listPlacementDriveCards, listStudentPlacementCards } from "@/actions/records/placements"
import {
  listAssignedSubjectCards,
  listCourseCards,
  listCourseSubjectCards,
  listDepartmentCards,
  listSemesterCards,
  listSubjectCards,
  listYearCards,
} from "@/actions/records/catalog"
import { listAdmissionCards, listStudentCards, listTeacherCards } from "@/actions/records/people"
import type { Directory, RecordFacet } from "@/actions/records/types"

const activityFacets: RecordFacet[] = [
  { value: "", label: "All" },
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
]

const admissionFacets: RecordFacet[] = [
  { value: "", label: "All" },
  { value: "applied", label: "Applied" },
  { value: "under_review", label: "In review" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "completed", label: "Enrolled" },
]

const publishFacets: RecordFacet[] = [
  { value: "", label: "All" },
  { value: "published", label: "Published" },
  { value: "draft", label: "Draft" },
]

const placementFacets: RecordFacet[] = [
  { value: "", label: "All" },
  { value: "draft", label: "Draft" },
  { value: "open", label: "Open" },
  { value: "closed", label: "Closed" },
]

const yearFacets: RecordFacet[] = [
  { value: "", label: "All" },
  { value: "current", label: "Current" },
  { value: "other", label: "Other" },
]

export const adminDirectories: Record<string, Directory> = {
  admissions: {
    title: "Admissions",
    description: "Applications from the first enquiry through enrollment.",
    empty: "No applications match this search.",
    noun: "application",
    facets: admissionFacets,
    editor: "admission",
    load: listAdmissionCards,
  },
  students: {
    title: "Students",
    description: "Students enrolled at the college, with roll number and course.",
    empty: "No students match this search.",
    noun: "student",
    facets: activityFacets,
    editor: "student",
    canCreate: false,
    load: listStudentCards,
  },
  teachers: {
    title: "Teachers",
    description: "Teaching staff, their department, and employee code.",
    empty: "No teachers match this search.",
    noun: "teacher",
    facets: activityFacets,
    editor: "teacher",
    load: listTeacherCards,
  },
  departments: {
    title: "Departments",
    description: "Academic departments used by courses, subjects, and people.",
    empty: "No departments match this search.",
    noun: "department",
    facets: activityFacets,
    editor: "department",
    load: listDepartmentCards,
  },
  courses: {
    title: "Courses",
    description: "Programmes offered by each department.",
    empty: "No courses match this search.",
    noun: "course",
    facets: activityFacets,
    editor: "course",
    load: listCourseCards,
  },
  subjects: {
    title: "Subjects",
    description: "Subjects taught in each course and semester.",
    empty: "No subjects match this search.",
    noun: "subject",
    facets: activityFacets,
    editor: "subject",
    load: listSubjectCards,
  },
  "academic-years": {
    title: "Academic years",
    description: "The years the college uses to organise semesters.",
    empty: "No academic years match this search.",
    noun: "academic year",
    facets: yearFacets,
    editor: "academic-year",
    load: listYearCards,
  },
  semesters: {
    title: "Semesters",
    description: "A semester ties a course to an academic year.",
    empty: "No semesters match this search.",
    noun: "semester",
    facets: activityFacets,
    editor: "semester",
    load: listSemesterCards,
  },
  announcements: {
    title: "Announcements",
    description: "Notices for the campus, including drafts that are not published yet.",
    empty: "No announcements match this search.",
    noun: "announcement",
    facets: publishFacets,
    editor: "announcement",
    load: listAnnouncementCards,
  },
  events: {
    title: "Events",
    description: "Workshops, fests, and other campus events. Sports and placements have their own screens.",
    empty: "No events match this search.",
    noun: "event",
    facets: publishFacets,
    editor: "event",
    load: listCampusEventCards,
  },
  sports: {
    title: "Sports",
    description: "Sports fixtures stored with the rest of the campus calendar.",
    empty: "No sports fixtures match this search.",
    noun: "sports fixture",
    facets: publishFacets,
    editor: "sports",
    load: listSportsCards,
  },
  placements: {
    title: "Placements",
    description: "Companies visiting campus, and the students who applied.",
    empty: "No companies match this search.",
    noun: "company",
    facets: placementFacets,
    editor: "placement",
    load: listPlacementDriveCards,
  },
}

export const teacherDirectories: Record<string, Directory> = {
  subjects: {
    title: "My subjects",
    description: "Subjects the office has assigned to you.",
    empty: "The office has not assigned subjects yet.",
    noun: "subject",
    load: listAssignedSubjectCards,
  },
  students: {
    title: "Students",
    description: "Students whose course includes a subject you teach.",
    empty: "No students are in your assigned subjects yet.",
    noun: "student",
    load: listStudentCards,
  },
  announcements: {
    title: "Announcements",
    description: "Notices published for teachers and for the whole campus.",
    empty: "No announcements match this search.",
    noun: "announcement",
    load: listAnnouncementCards,
  },
}

export const studentDirectories: Record<string, Directory> = {
  subjects: {
    title: "My subjects",
    description: "Subjects in your course.",
    empty: "Your course will appear here after enrollment.",
    noun: "subject",
    load: listCourseSubjectCards,
  },
  events: {
    title: "Events",
    description: "Workshops, fests, and sports fixtures the college has published.",
    empty: "No events are on the calendar.",
    noun: "event",
    load: listStudentEventCards,
  },
  announcements: {
    title: "Announcements",
    description: "Notices published for students and for the whole campus.",
    empty: "No announcements match this search.",
    noun: "announcement",
    load: listAnnouncementCards,
  },
  placement: {
    title: "Placements",
    description: "Companies visiting campus that you can apply to.",
    empty: "No companies are open for applications.",
    noun: "company",
    load: listStudentPlacementCards,
  },
}

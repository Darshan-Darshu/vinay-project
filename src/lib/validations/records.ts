import { z } from "zod"

import { normalizeSkills } from "@/lib/academics/skills"

const email = z
  .string()
  .trim()
  .regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, "Enter a valid email.")

const optionalUuid = z.union([z.literal(""), z.uuid()]).transform((value) => value || null)

const requiredUuid = z.uuid()

const optionalId = z.union([z.literal(""), z.uuid()])

export const departmentSchema = z.object({
  id: optionalId,
  name: z.string().trim().min(1).max(120),
  code: z.string().trim().min(1).max(32),
  description: z.string().trim().max(4000),
  isActive: z.boolean(),
})

export const courseSchema = z.object({
  id: optionalId,
  departmentId: requiredUuid,
  name: z.string().trim().min(1).max(120),
  code: z.string().trim().min(1).max(32),
  durationSemesters: z.coerce.number().int().min(1).max(12),
  description: z.string().trim().max(4000),
  isActive: z.boolean(),
})

export const subjectSchema = z.object({
  id: optionalId,
  departmentId: requiredUuid,
  courseId: requiredUuid,
  semesterNumber: z.coerce.number().int().min(1).max(12),
  name: z.string().trim().min(1).max(120),
  code: z.string().trim().min(1).max(32),
  credits: z.coerce.number().int().min(0).max(99),
  isActive: z.boolean(),
})

export const academicYearSchema = z
  .object({
    id: optionalId,
    name: z.string().trim().min(1).max(40),
    startsOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    endsOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    isCurrent: z.boolean(),
  })
  .refine((value) => value.endsOn >= value.startsOn)

export const semesterSchema = z.object({
  id: optionalId,
  courseId: requiredUuid,
  academicYearId: requiredUuid,
  number: z.coerce.number().int().min(1).max(12),
  isActive: z.boolean(),
})

export const teacherCreateSchema = z.object({
  fullName: z.string().trim().min(1).max(120),
  email,
  phone: z.string().trim().max(30),
  password: z.string().min(6).max(72),
  departmentId: optionalUuid,
  employeeCode: z.string().trim().max(40).transform((value) => value || null),
  designation: z.string().trim().max(80),
  isActive: z.boolean(),
  subjectIds: z.array(z.uuid()),
})

export const teacherUpdateSchema = z.object({
  id: requiredUuid,
  fullName: z.string().trim().min(1).max(120),
  phone: z.string().trim().max(30),
  departmentId: optionalUuid,
  employeeCode: z.string().trim().max(40).transform((value) => value || null),
  designation: z.string().trim().max(80),
  isActive: z.boolean(),
  subjectIds: z.array(z.uuid()),
})

export const studentUpdateSchema = z.object({
  id: requiredUuid,
  rollNumber: z.string().trim().min(1).max(40),
  departmentId: optionalUuid,
  courseId: optionalUuid,
  semesterId: optionalUuid,
  isActive: z.boolean(),
})

export const admissionSchema = z.object({
  id: optionalId,
  fullName: z.string().trim().min(1).max(120),
  email,
  phone: z.string().trim().max(30),
  departmentId: requiredUuid,
  courseId: requiredUuid,
  semesterId: optionalUuid,
  notes: z.string().trim().max(4000),
})

export const admissionNotesSchema = z.object({
  id: requiredUuid,
  notes: z.string().trim().max(4000),
})

export const admissionStatusSchema = z.object({
  id: requiredUuid,
  status: z.enum(["under_review", "approved", "rejected"]),
})

export const enrollSchema = z.object({
  id: requiredUuid,
  rollNumber: z.string().trim().min(1).max(40),
  password: z.string().min(6).max(72),
})

export const announcementSchema = z
  .object({
    id: optionalId,
    title: z.string().trim().min(1).max(160),
    body: z.string().trim().max(8000),
    audience: z.enum(["everyone", "students", "teachers", "admins"]),
    departmentId: optionalUuid,
    priority: z.enum(["low", "normal", "high"]),
    publishAt: z.string().trim().min(1),
    expiresAt: z.string().trim(),
    status: z.enum(["draft", "published"]),
  })
  .superRefine((value, ctx) => {
    if (Number.isNaN(Date.parse(value.publishAt))) {
      ctx.addIssue({ code: "custom", path: ["publishAt"] })
    }
    if (value.expiresAt && Number.isNaN(Date.parse(value.expiresAt))) {
      ctx.addIssue({ code: "custom", path: ["expiresAt"] })
    }
    if (
      value.expiresAt &&
      !Number.isNaN(Date.parse(value.publishAt)) &&
      Date.parse(value.expiresAt) < Date.parse(value.publishAt)
    ) {
      ctx.addIssue({ code: "custom", path: ["expiresAt"] })
    }
  })
  .transform((value) => ({
    ...value,
    publishAt: new Date(value.publishAt).toISOString(),
    expiresAt: value.expiresAt ? new Date(value.expiresAt).toISOString() : null,
  }))

const eventTypes = [
  "technical",
  "cultural",
  "workshop",
  "seminar",
  "hackathon",
  "fest",
  "sports",
] as const

export const eventSchema = z
  .object({
    id: optionalId,
    title: z.string().trim().min(1).max(160),
    description: z.string().trim().max(8000),
    eventType: z.enum(eventTypes),
    startsAt: z.string().trim().min(1),
    endsAt: z.string().trim(),
    venue: z.string().trim().max(160),
    status: z.enum(["draft", "published", "cancelled", "completed"]),
    isPublic: z.boolean(),
  })
  .superRefine((value, ctx) => {
    if (Number.isNaN(Date.parse(value.startsAt))) {
      ctx.addIssue({ code: "custom", path: ["startsAt"] })
    }
    if (value.endsAt && Number.isNaN(Date.parse(value.endsAt))) {
      ctx.addIssue({ code: "custom", path: ["endsAt"] })
    }
    if (
      value.endsAt &&
      !Number.isNaN(Date.parse(value.startsAt)) &&
      Date.parse(value.endsAt) < Date.parse(value.startsAt)
    ) {
      ctx.addIssue({ code: "custom", path: ["endsAt"] })
    }
  })
  .transform((value) => ({
    ...value,
    startsAt: new Date(value.startsAt).toISOString(),
    endsAt: value.endsAt ? new Date(value.endsAt).toISOString() : null,
  }))

export const placementDriveSchema = z
  .object({
    id: optionalId,
    companyName: z.string().trim().min(1).max(160),
    roleTitle: z.string().trim().min(1).max(160),
    description: z.string().trim().max(8000),
    packageText: z.string().trim().max(80),
    location: z.string().trim().max(160),
    jobType: z.enum(["full_time", "internship"]),
    eligibility: z.string().trim().max(2000),
    requiredSkills: z.string().trim().max(2000),
    departmentId: optionalUuid,
    courseId: optionalUuid,
    applyBy: z.string().trim().min(1),
    visitAt: z.string().trim(),
    venue: z.string().trim().max(160),
    status: z.enum(["draft", "open", "closed"]),
  })
  .superRefine((value, ctx) => {
    if (Number.isNaN(Date.parse(value.applyBy))) {
      ctx.addIssue({ code: "custom", path: ["applyBy"] })
    }
    if (value.visitAt && Number.isNaN(Date.parse(value.visitAt))) {
      ctx.addIssue({ code: "custom", path: ["visitAt"] })
    }
  })
  .transform((value) => ({
    ...value,
    applyBy: new Date(value.applyBy).toISOString(),
    visitAt: value.visitAt ? new Date(value.visitAt).toISOString() : null,
    requiredSkills: normalizeSkills(value.requiredSkills),
  }))

export const placementApplicationStatusSchema = z.object({
  id: requiredUuid,
  status: z.enum(["applied", "shortlisted", "selected", "not_selected"]),
})

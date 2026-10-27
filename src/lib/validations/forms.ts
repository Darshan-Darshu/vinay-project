import { z } from "zod"

const email = z
  .string()
  .trim()
  .regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, "Enter a valid email.")

export const signInSchema = z.object({
  email,
  password: z.string().min(6, "Password must be at least 6 characters."),
  next: z.string().optional(),
})

export const profileSchema = z.object({
  fullName: z.string().trim().min(1, "Name is required.").max(120),
  phone: z.string().trim().max(30),
})

export const collegeSettingsSchema = z.object({
  name: z.string().trim().min(1, "College name is required.").max(120),
  about: z.string().trim().max(4000),
  address: z.string().trim().max(300),
  phone: z.string().trim().max(40),
  email: z.union([z.literal(""), email]),
  admissionsInfo: z.string().trim().max(4000),
})

"use server"

import { revalidatePath } from "next/cache"

import { fail, field } from "@/actions/admin/records/shared"
import type { FormState } from "@/actions/form-state"
import { loadApplicationCatalog } from "@/lib/ai/guest-reads"
import { createAdminClient } from "@/lib/supabase/admin"
import { admissionSchema } from "@/lib/validations/records"

const received = "Application received. The office will review it."
const alreadyIn = "An application for that email is already in."
const unavailable = "Applications can't be submitted right now."

export async function loadGuestApplicationOptions() {
  return loadApplicationCatalog()
}

export async function submitGuestAdmission(_previous: FormState, formData: FormData): Promise<FormState> {
  const parsed = admissionSchema.safeParse({
    id: "",
    fullName: field(formData, "fullName"),
    email: field(formData, "email"),
    phone: field(formData, "phone"),
    departmentId: field(formData, "departmentId"),
    courseId: field(formData, "courseId"),
    semesterId: "",
    notes: field(formData, "notes"),
  })
  if (!parsed.success) return fail("Check the form and try again.")

  let admin: ReturnType<typeof createAdminClient>
  try {
    admin = createAdminClient()
  } catch (error) {
    console.error(error)
    return fail(unavailable)
  }

  const department = await admin
    .from("departments")
    .select("id")
    .eq("id", parsed.data.departmentId)
    .eq("is_active", true)
    .is("deleted_at", null)
    .maybeSingle()
  if (department.error || !department.data) return fail("Choose a department that still exists.")

  const course = await admin
    .from("courses")
    .select("id, department_id")
    .eq("id", parsed.data.courseId)
    .eq("is_active", true)
    .is("deleted_at", null)
    .maybeSingle()
  if (course.error || !course.data || course.data.department_id !== parsed.data.departmentId) {
    return fail("Choose a course from that department.")
  }

  const open = await admin
    .from("admissions")
    .select("id, email")
    .in("status", ["applied", "under_review"])
    .is("deleted_at", null)
    .ilike("email", likeExact(parsed.data.email))
    .limit(1)
  if (open.error) return fail(unavailable)
  if ((open.data ?? []).length > 0) return fail(alreadyIn)

  const inserted = await admin.from("admissions").insert({
    full_name: parsed.data.fullName,
    email: parsed.data.email,
    phone: parsed.data.phone || null,
    department_id: parsed.data.departmentId,
    course_id: parsed.data.courseId,
    semester_id: null,
    notes: parsed.data.notes,
    status: "applied",
  }).select("id").maybeSingle()
  if (inserted.error || !inserted.data) return fail(unavailable)

  revalidatePath("/admin/admissions")
  return { error: null, success: received }
}

function likeExact(value: string) {
  return value.replaceAll("\\", "\\\\").replaceAll("%", "\\%").replaceAll("_", "\\_")
}

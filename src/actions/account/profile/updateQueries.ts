"use server"

import { revalidatePath } from "next/cache"

import type { FormState } from "@/actions/form-state"
import { requireUser } from "@/lib/auth/session"
import { homeForRole } from "@/lib/permissions/roles"
import { createClient } from "@/lib/supabase/server"
import { profileSchema } from "@/lib/validations/forms"

export async function updateProfile(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const profile = await requireUser()
  const parsed = profileSchema.safeParse({
    fullName: formData.get("fullName"),
    phone: formData.get("phone"),
  })

  if (!parsed.success) {
    return { error: "Check the name and phone number.", success: null }
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from("profiles")
    .update({
      full_name: parsed.data.fullName,
      phone: parsed.data.phone === "" ? null : parsed.data.phone,
    })
    .eq("id", profile.id)

  if (error) {
    return {
      error: "We couldn't save your profile. Please try again.",
      success: null,
    }
  }

  revalidatePath(homeForRole(profile.role))
  revalidatePath(`${homeForRole(profile.role)}/profile`)
  return { error: null, success: "Profile saved." }
}

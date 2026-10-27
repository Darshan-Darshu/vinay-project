"use server"

import { revalidatePath, updateTag } from "next/cache"

import { cacheTags } from "@/actions/cache-tags"
import type { FormState } from "@/actions/form-state"
import { requireRole } from "@/lib/auth/session"
import { createClient } from "@/lib/supabase/server"
import { collegeSettingsSchema } from "@/lib/validations/forms"
import { reindexPublicCollege } from "@/lib/ai/pinecone-college"

export async function updateCollegeSettings(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const profile = await requireRole("admin")
  const parsed = collegeSettingsSchema.safeParse({
    name: formData.get("name"),
    about: formData.get("about"),
    address: formData.get("address"),
    phone: formData.get("phone"),
    email: formData.get("email"),
    admissionsInfo: formData.get("admissionsInfo"),
  })

  if (!parsed.success) {
    return { error: "Check the college settings and try again.", success: null }
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from("college_settings")
    .update({
      name: parsed.data.name,
      about: parsed.data.about,
      address: parsed.data.address,
      phone: parsed.data.phone,
      email: parsed.data.email,
      admissions_info: parsed.data.admissionsInfo,
    })
    .eq("id", true)

  if (error) {
    return {
      error: "We couldn't save college settings. Please try again.",
      success: null,
    }
  }

  await supabase.from("activity_logs").insert({
    actor_id: profile.id,
    action: "college_settings.update",
    entity_type: "college_settings",
    summary: "Updated college settings",
  })

  updateTag(cacheTags.collegeSettings)
  revalidatePath("/")
  revalidatePath("/guest")
  revalidatePath("/admin")
  revalidatePath("/admin/settings")
  await reindexPublicCollege()
  return { error: null, success: "College settings saved." }
}

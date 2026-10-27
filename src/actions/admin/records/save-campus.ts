"use server"

import { cacheTags } from "@/actions/cache-tags"
import type { FormState } from "@/actions/form-state"
import {
  adminContext,
  checkForm,
  fail,
  field,
  flagged,
  logActivity,
  ok,
  refreshRecords,
  saveFailed,
  writeError,
} from "@/actions/admin/records/shared"
import { indexCollegeRecord } from "@/lib/ai/pinecone-college"
import { announcementSchema, eventSchema } from "@/lib/validations/records"

export async function saveAnnouncement(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = announcementSchema.safeParse({
    id: field(formData, "id"),
    title: field(formData, "title"),
    body: field(formData, "body"),
    audience: field(formData, "audience"),
    departmentId: field(formData, "departmentId"),
    priority: field(formData, "priority"),
    publishAt: field(formData, "publishAt"),
    expiresAt: field(formData, "expiresAt"),
    status: field(formData, "status"),
  })
  if (!parsed.success) return fail(checkForm)

  const { profile, supabase } = await adminContext()
  if (parsed.data.departmentId) {
    const department = await supabase
      .from("departments")
      .select("id")
      .eq("id", parsed.data.departmentId)
      .is("deleted_at", null)
      .maybeSingle()
    if (department.error || !department.data) return fail("Choose a department that still exists.")
  }

  const row = {
    title: parsed.data.title,
    body: parsed.data.body,
    audience: parsed.data.audience,
    department_id: parsed.data.departmentId,
    priority: parsed.data.priority,
    publish_at: parsed.data.publishAt,
    expires_at: parsed.data.expiresAt,
    status: parsed.data.status,
  }
  const id = parsed.data.id
  const result = id
    ? await supabase.from("announcements").update(row).eq("id", id).is("deleted_at", null).select("id").maybeSingle()
    : await supabase
        .from("announcements")
        .insert({ ...row, author_id: profile.id })
        .select("id")
        .maybeSingle()

  if (result.error || !result.data) return fail(writeError(result.error) ?? saveFailed)
  await logActivity(
    supabase,
    profile.id,
    id ? "announcement.update" : "announcement.create",
    "announcement",
    result.data.id,
    id ? `Updated announcement ${row.title}` : `Posted announcement ${row.title}`,
  )
  refreshRecords(
    ["/admin/announcements", "/teacher/announcements", "/student/announcements", "/", "/guest"],
    [cacheTags.announcements],
  )
  const expiresAt = parsed.data.expiresAt ? new Date(parsed.data.expiresAt).getTime() : null
  await indexCollegeRecord({
    source: "announcement",
    recordId: result.data.id,
    title: row.title,
    text: row.body,
    published: row.status === "published" && row.audience === "everyone" && (expiresAt === null || expiresAt > Date.now()),
  })
  return ok("Announcement saved.")
}

export async function saveEvent(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = eventSchema.safeParse({
    id: field(formData, "id"),
    title: field(formData, "title"),
    description: field(formData, "description"),
    eventType: field(formData, "eventType"),
    startsAt: field(formData, "startsAt"),
    endsAt: field(formData, "endsAt"),
    venue: field(formData, "venue"),
    status: field(formData, "status"),
    isPublic: flagged(formData, "isPublic"),
  })
  if (!parsed.success) return fail(checkForm)

  const { profile, supabase } = await adminContext()
  if (parsed.data.id) {
    const existing = await supabase
      .from("events")
      .select("id, event_type")
      .eq("id", parsed.data.id)
      .is("deleted_at", null)
      .maybeSingle()
    if (existing.error || !existing.data) return fail("That event could not be found.")
    if (existing.data.event_type === "placement") {
      return fail("Placement events stay on the placements screen.")
    }
    if (existing.data.event_type === "sports" && parsed.data.eventType !== "sports") {
      return fail("This fixture stays on the sports screen.")
    }
    if (existing.data.event_type !== "sports" && parsed.data.eventType === "sports") {
      return fail("Sports fixtures are created from the sports screen.")
    }
  }

  const row = {
    title: parsed.data.title,
    description: parsed.data.description,
    event_type: parsed.data.eventType,
    starts_at: parsed.data.startsAt,
    ends_at: parsed.data.endsAt,
    venue: parsed.data.venue,
    status: parsed.data.status,
    is_public: parsed.data.isPublic,
  }
  const id = parsed.data.id
  const result = id
    ? await supabase.from("events").update(row).eq("id", id).is("deleted_at", null).select("id").maybeSingle()
    : await supabase.from("events").insert(row).select("id").maybeSingle()

  if (result.error || !result.data) return fail(writeError(result.error) ?? saveFailed)
  const sports = row.event_type === "sports"
  await logActivity(
    supabase,
    profile.id,
    id ? "event.update" : "event.create",
    "event",
    result.data.id,
    id ? `Updated ${sports ? "sports fixture" : "event"} ${row.title}` : `Posted ${sports ? "sports fixture" : "event"} ${row.title}`,
  )
  refreshRecords(
    ["/admin/events", "/admin/sports", "/student/events", "/", "/guest", "/guest/events"],
    [cacheTags.publicEvents],
  )
  await indexCollegeRecord({
    source: "event",
    recordId: result.data.id,
    title: row.title,
    text: row.description,
    published: row.status === "published" && row.is_public,
  })
  return ok(sports ? "Sports fixture saved." : "Event saved.")
}

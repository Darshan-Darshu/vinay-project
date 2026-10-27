import "server-only"

import { createClient } from "@/lib/supabase/server"

export type AiFeature =
  | "question_drafts"
  | "exam_paper"
  | "interview_turn"
  | "interview_feedback"
  | "placement_reason"
  | "placement_resume"
  | "placement_match"
  | "chat_student"
  | "chat_teacher"
  | "chat_admin"
  | "chat_student_studies"
  | "chat_student_campus"
  | "chat_student_materials"
  | "chat_student_events"
  | "chat_student_announcements"
  | "chat_teacher_class"
  | "chat_teacher_teaching"
  | "chat_teacher_subjects"
  | "chat_teacher_students"
  | "chat_teacher_announcements"
  | "chat_teacher_campus"
  | "chat_admin_records"
  | "chat_admin_academics"
  | "chat_admin_campus"
  | "chat_admin_admissions"
  | "chat_admin_students"
  | "chat_admin_teachers"
  | "chat_admin_departments"
  | "chat_admin_courses"
  | "chat_admin_subjects"
  | "chat_admin_announcements"
  | "chat_admin_events"
  | "chat_admin_placements"
  | "material_passages"

export async function recordUsage(input: {
  profileId: string
  role: string
  model: string
  feature: AiFeature
  latencyMs: number
  promptTokens: number | null
  completionTokens: number | null
  status: "ok" | "error"
}) {
  const supabase = await createClient()
  await supabase.from("ai_usage_logs").insert({
    profile_id: input.profileId,
    role: input.role,
    model: input.model,
    feature: input.feature,
    latency_ms: input.latencyMs,
    prompt_tokens: input.promptTokens,
    completion_tokens: input.completionTokens,
    status: input.status,
  })
}

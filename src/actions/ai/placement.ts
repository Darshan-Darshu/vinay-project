"use server"

import { z } from "zod"

import { fail, field, studentContext } from "@/actions/academics/shared"
import type { FormState } from "@/actions/form-state"
import { generationFailed } from "@/lib/ai/errors"
import { generateJson } from "@/lib/ai/model"
import { runPlacementCheck, type PlacementCheckState } from "@/lib/ai/placement-agents"
import { citedSkillsAllowed, rankSkillMatches, type SkillMatch } from "@/lib/ai/placement-match"
import { recordUsage } from "@/lib/ai/usage"
import { isRecord, QueryError } from "@/lib/db/errors"

const reasonSchema = z.object({
  reason: z.string(),
  citedSkills: z.array(z.string()),
})

export type PlacementMatchView = SkillMatch

export type { PlacementCheckState }

export async function checkPlacementFit(
  _previous: PlacementCheckState,
  _formData: FormData,
): Promise<PlacementCheckState> {
  const { profile, supabase } = await studentContext()
  return runPlacementCheck(profile, supabase)
}

export async function loadSkillMatches(): Promise<
  { enrolled: false } | { enrolled: true; skills: string[]; matches: PlacementMatchView[] }
> {
  const { profile, supabase } = await studentContext()
  const student = await supabase
    .from("students")
    .select("id")
    .eq("profile_id", profile.id)
    .is("deleted_at", null)
    .maybeSingle()
  if (student.error) throw new QueryError()
  if (!isRecord(student.data) || typeof student.data.id !== "string") return { enrolled: false }
  const resume = await supabase.from("student_resumes").select("skills").eq("student_id", student.data.id).maybeSingle()
  if (resume.error) throw new QueryError()
  const skills = isRecord(resume.data) && Array.isArray(resume.data.skills)
    ? resume.data.skills.filter((skill): skill is string => typeof skill === "string")
    : []
  if (skills.length === 0) return { enrolled: true, skills: [], matches: [] }
  const drives = await supabase
    .from("placement_drives")
    .select("id, company_name, role_title, required_skills")
    .eq("status", "open")
    .is("deleted_at", null)
  if (drives.error) throw new QueryError()
  const matches = rankSkillMatches(
    skills,
    (drives.data ?? []).flatMap((row) => {
      if (!isRecord(row) || typeof row.id !== "string" || typeof row.company_name !== "string" || typeof row.role_title !== "string") {
        return []
      }
      const required = Array.isArray(row.required_skills)
        ? row.required_skills.filter((skill): skill is string => typeof skill === "string")
        : []
      return [{ id: row.id, companyName: row.company_name, roleTitle: row.role_title, requiredSkills: required }]
    }),
  )
  return { enrolled: true, skills, matches }
}

export async function explainPlacementMatch(_previous: FormState, formData: FormData): Promise<FormState> {
  const driveId = field(formData, "driveId")
  if (!driveId) return fail(generationFailed)
  const loaded = await loadSkillMatches()
  if (!loaded.enrolled || loaded.skills.length === 0) return fail(generationFailed)
  const match = loaded.matches.find((item) => item.id === driveId)
  if (!match) return fail(generationFailed)

  const { profile } = await studentContext()
  const generated = await generateJson(
    reasonSchema,
    "Explain a placement match in one or two sentences. Cite only skills from the two lists you are given. Do not invent skills.",
    `Role: ${match.roleTitle}\nStudent skills: ${loaded.skills.join(", ")}\nRequired skills: ${match.requiredSkills.join(", ")}`,
  )
  if (!generated) return fail(generationFailed)
  if (!generated.object) {
    await recordUsage({
      profileId: profile.id,
      role: profile.role,
      model: generated.modelName,
      feature: "placement_reason",
      latencyMs: generated.latencyMs,
      promptTokens: generated.promptTokens,
      completionTokens: generated.completionTokens,
      status: "error",
    })
    return fail(generationFailed)
  }
  const allowed = citedSkillsAllowed(generated.object.citedSkills, loaded.skills, match.requiredSkills)
  await recordUsage({
    profileId: profile.id,
    role: profile.role,
    model: generated.modelName,
    feature: "placement_reason",
    latencyMs: generated.latencyMs,
    promptTokens: generated.promptTokens,
    completionTokens: generated.completionTokens,
    status: allowed ? "ok" : "error",
  })
  if (!allowed) return { error: null, success: null }
  return { error: null, success: generated.object.reason }
}

import "server-only"

import { z } from "zod"

import { generationFailed } from "@/lib/ai/errors"
import { generateJson } from "@/lib/ai/model"
import { extractPdfText } from "@/lib/ai/pdf-text"
import {
  combineSkills,
  joinPlacementMatches,
  limitSkills,
  type ModelDriveScore,
  type PlacementCheckMatch,
  type SkillDrive,
} from "@/lib/ai/placement-match"
import { recordUsage } from "@/lib/ai/usage"
import { isRecord, QueryError } from "@/lib/db/errors"
import type { AppRole } from "@/lib/permissions/roles"
import { createClient } from "@/lib/supabase/server"

const resumeTextLimit = 12_000
const descriptionLimit = 400

const needsInput = "Add skills on your profile or upload a PDF resume."
const pdfUnread = "The PDF had no readable text. Typed skills were used."
const resumeUnread = "The resume could not be read. Typed skills were used."
const scoreUnavailable = "The fit score could not be generated. Skill overlap is shown."
const noOpenDrives = "No open drives right now."

const resumeSchema = z.object({
  extractedSkills: z.array(z.string()),
  summary: z.string(),
})

const matchSchema = z.object({
  matches: z.array(
    z.object({
      driveId: z.string(),
      modelScore: z.number().int().min(0).max(100),
      reason: z.string(),
      citedSkills: z.array(z.string()),
    }),
  ),
})

export type PlacementCheckResult = {
  notice: string | null
  typedSkills: string[]
  extractedSkills: string[]
  matches: PlacementCheckMatch[]
}

export type PlacementCheckState = {
  error: string | null
  result: PlacementCheckResult | null
}

type CampusClient = Awaited<ReturnType<typeof createClient>>
type ProfileRef = { id: string; role: AppRole }
type ResumeRead = {
  extractedSkills: string[]
  summary: string
  readable: boolean
  modelFailed: boolean
}
type OpenDrive = SkillDrive & {
  description: string
  eligibility: string
  packageText: string
  location: string
}

export async function runPlacementCheck(profile: ProfileRef, supabase: CampusClient): Promise<PlacementCheckState> {
  const loaded = await loadStudentResume(supabase, profile.id)
  if (!loaded.enrolled) return { error: "Your enrollment is not on file yet.", result: null }

  const typedSkills = skillsAgent(loaded.skills)
  const [resume, drives] = await Promise.all([
    resumeAgent(supabase, profile, loaded.storagePath),
    jobFetchAgent(supabase),
  ])

  if (typedSkills.length === 0 && !resume.readable) {
    return { error: needsInput, result: null }
  }
  if (typedSkills.length === 0 && resume.extractedSkills.length === 0 && resume.summary.length === 0) {
    return { error: generationFailed, result: null }
  }

  const extractedSkills = resume.extractedSkills
  const skills = combineSkills(typedSkills, extractedSkills)
  const resumeNotice = !resume.readable && loaded.storagePath ? pdfUnread : resume.modelFailed ? resumeUnread : null
  if (drives.length === 0) {
    return {
      error: null,
      result: {
        notice: joinNotice([resumeNotice, noOpenDrives]),
        typedSkills,
        extractedSkills,
        matches: [],
      },
    }
  }

  const modelRows = await matchAgent(profile, skills, resume.summary, drives)
  return {
    error: null,
    result: {
      notice: joinNotice([resumeNotice, modelRows === null ? scoreUnavailable : null]),
      typedSkills,
      extractedSkills,
      matches: joinPlacementMatches(skills, drives, modelRows),
    },
  }
}

async function loadStudentResume(supabase: CampusClient, profileId: string) {
  const student = await supabase
    .from("students")
    .select("id")
    .eq("profile_id", profileId)
    .is("deleted_at", null)
    .maybeSingle()
  if (student.error) throw new QueryError()
  if (!isRecord(student.data) || typeof student.data.id !== "string") return { enrolled: false as const }
  const resume = await supabase
    .from("student_resumes")
    .select("skills, storage_path")
    .eq("student_id", student.data.id)
    .maybeSingle()
  if (resume.error) throw new QueryError()
  const skills = isRecord(resume.data) && Array.isArray(resume.data.skills)
    ? resume.data.skills.filter((skill): skill is string => typeof skill === "string")
    : []
  const storagePath = isRecord(resume.data) && typeof resume.data.storage_path === "string" ? resume.data.storage_path : null
  return { enrolled: true as const, skills, storagePath }
}

function skillsAgent(skills: string[]) {
  return limitSkills(skills)
}

async function resumeAgent(supabase: CampusClient, profile: ProfileRef, storagePath: string | null): Promise<ResumeRead> {
  const empty = { extractedSkills: [], summary: "", readable: false, modelFailed: false }
  if (!storagePath) return empty
  const downloaded = await supabase.storage.from("resumes").download(storagePath)
  if (downloaded.error || !downloaded.data) return empty
  let text = ""
  try {
    text = clipText(await extractPdfText(new Uint8Array(await downloaded.data.arrayBuffer())), resumeTextLimit)
  } catch (error) {
    console.error(error)
    return empty
  }
  if (!text) return empty

  const generated = await generateJson(
    resumeSchema,
    "Extract skills and a short summary from resume text. Skills are short names such as java or sql. Do not invent employers or skills that are not in the text.",
    text,
  )
  if (!generated) return { extractedSkills: [], summary: "", readable: true, modelFailed: true }
  if (!generated.object) {
    await recordGenerated(profile, "placement_resume", generated, "error")
    return { extractedSkills: [], summary: "", readable: true, modelFailed: true }
  }
  await recordGenerated(profile, "placement_resume", generated, "ok")
  return {
    extractedSkills: limitSkills(generated.object.extractedSkills),
    summary: clipText(generated.object.summary, 600),
    readable: true,
    modelFailed: false,
  }
}

async function jobFetchAgent(supabase: CampusClient): Promise<OpenDrive[]> {
  const drives = await supabase
    .from("placement_drives")
    .select("id, company_name, role_title, description, package_text, location, eligibility, required_skills")
    .eq("status", "open")
    .is("deleted_at", null)
  if (drives.error) throw new QueryError()
  return (drives.data ?? []).flatMap((row) => {
    if (!isRecord(row) || typeof row.id !== "string" || typeof row.company_name !== "string" || typeof row.role_title !== "string") {
      return []
    }
    const required = Array.isArray(row.required_skills)
      ? row.required_skills.filter((skill): skill is string => typeof skill === "string")
      : []
    return [
      {
        id: row.id,
        companyName: row.company_name,
        roleTitle: row.role_title,
        requiredSkills: limitSkills(required),
        description: clipText(typeof row.description === "string" ? row.description : "", descriptionLimit),
        eligibility: typeof row.eligibility === "string" ? row.eligibility : "",
        packageText: typeof row.package_text === "string" ? row.package_text : "",
        location: typeof row.location === "string" ? row.location : "",
      },
    ]
  })
}

async function matchAgent(
  profile: ProfileRef,
  skills: string[],
  summary: string,
  drives: OpenDrive[],
): Promise<ModelDriveScore[] | null> {
  const generated = await generateJson(
    matchSchema,
    "Score each placement drive from 0 to 100. Cite only skills from the student list or that drive's required skills. Do not invent skills.",
    [
      `Student skills: ${skills.join(", ") || "None"}`,
      `Resume summary: ${summary || "None"}`,
      ...drives.map((drive) =>
        [
          `id: ${drive.id}`,
          `company: ${drive.companyName}`,
          `role: ${drive.roleTitle}`,
          `required: ${drive.requiredSkills.join(", ") || "None"}`,
          `eligibility: ${drive.eligibility || "None"}`,
          `package: ${drive.packageText || "None"}`,
          `location: ${drive.location || "None"}`,
          `description: ${drive.description || "None"}`,
        ].join("\n"),
      ),
    ].join("\n\n"),
  )
  if (!generated) return null
  if (!generated.object) {
    await recordGenerated(profile, "placement_match", generated, "error")
    return null
  }
  await recordGenerated(profile, "placement_match", generated, "ok")
  return generated.object.matches.map((match) => ({
    driveId: match.driveId,
    modelScore: match.modelScore,
    reason: clipText(match.reason, 280),
    citedSkills: limitSkills(match.citedSkills),
  }))
}

async function recordGenerated(
  profile: ProfileRef,
  feature: "placement_resume" | "placement_match",
  generated: { modelName: string; latencyMs: number; promptTokens: number | null; completionTokens: number | null },
  status: "ok" | "error",
) {
  await recordUsage({
    profileId: profile.id,
    role: profile.role,
    model: generated.modelName,
    feature,
    latencyMs: generated.latencyMs,
    promptTokens: generated.promptTokens,
    completionTokens: generated.completionTokens,
    status,
  })
}

function clipText(value: string, max: number) {
  const trimmed = value.trim()
  return trimmed.length <= max ? trimmed : trimmed.slice(0, max)
}

function joinNotice(parts: Array<string | null>) {
  const text = parts.filter((part): part is string => part !== null && part.length > 0).join(" ")
  return text.length > 0 ? text : null
}

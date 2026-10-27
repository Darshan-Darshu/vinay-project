export type SkillDrive = {
  id: string
  companyName: string
  roleTitle: string
  requiredSkills: string[]
}

export type SkillMatch = SkillDrive & {
  shared: string[]
  missing: string[]
  overlap: number
}

export type DriveOverlap = {
  shared: string[]
  missing: string[]
  overlapPercent: number
}

export type ModelDriveScore = {
  driveId: string
  modelScore: number
  reason: string
  citedSkills: string[]
}

export type PlacementCheckMatch = {
  id: string
  companyName: string
  roleTitle: string
  shared: string[]
  missing: string[]
  overlapPercent: number
  modelScore: number | null
  highChance: boolean
  reason: string | null
}

export function rankSkillMatches(skills: string[], drives: SkillDrive[]): SkillMatch[] {
  const owned = new Set(skills.map(normalize))
  return drives
    .flatMap((drive) => {
      const required = unique(drive.requiredSkills)
      const shared = required.filter((skill) => owned.has(skill))
      if (shared.length === 0) return []
      const missing = required.filter((skill) => !owned.has(skill))
      return [{ ...drive, shared, missing, overlap: shared.length }]
    })
    .sort((left, right) => right.overlap - left.overlap || left.companyName.localeCompare(right.companyName))
}

export function driveOverlap(skills: string[], requiredSkills: string[]): DriveOverlap {
  const owned = new Set(unique(skills))
  const required = unique(requiredSkills)
  const shared = required.filter((skill) => owned.has(skill))
  const missing = required.filter((skill) => !owned.has(skill))
  const overlapPercent = required.length === 0 ? 0 : Math.round((shared.length / required.length) * 100)
  return { shared, missing, overlapPercent }
}

export function isHighChance(modelScore: number | null) {
  return modelScore !== null && modelScore >= 70
}

export function joinPlacementMatches(
  skills: string[],
  drives: SkillDrive[],
  modelRows: ModelDriveScore[] | null,
): PlacementCheckMatch[] {
  const byDrive = new Map<string, ModelDriveScore>()
  for (const row of modelRows ?? []) {
    if (!byDrive.has(row.driveId)) byDrive.set(row.driveId, row)
  }
  return drives
    .flatMap((drive) => {
      const overlap = driveOverlap(skills, drive.requiredSkills)
      const row = modelRows === null ? undefined : byDrive.get(drive.id)
      const accepted = row !== undefined && citedSkillsAllowed(row.citedSkills, skills, drive.requiredSkills)
      const modelScore = accepted ? row.modelScore : null
      const visible = overlap.overlapPercent > 0 || (modelScore !== null && modelScore >= 40)
      if (!visible) return []
      return [
        {
          id: drive.id,
          companyName: drive.companyName,
          roleTitle: drive.roleTitle,
          shared: overlap.shared,
          missing: overlap.missing,
          overlapPercent: overlap.overlapPercent,
          modelScore,
          highChance: isHighChance(modelScore),
          reason: accepted ? row.reason : null,
        },
      ]
    })
    .sort((left, right) => {
      if (left.highChance !== right.highChance) return left.highChance ? -1 : 1
      const leftScore = left.modelScore ?? -1
      const rightScore = right.modelScore ?? -1
      if (leftScore !== rightScore) return rightScore - leftScore
      if (left.overlapPercent !== right.overlapPercent) return right.overlapPercent - left.overlapPercent
      return left.companyName.localeCompare(right.companyName)
    })
}

export function citedSkillsAllowed(cited: string[], studentSkills: string[], requiredSkills: string[]): boolean {
  const allowed = new Set([...studentSkills, ...requiredSkills].map(normalize))
  return cited.every((skill) => allowed.has(normalize(skill)))
}

export function limitSkills(skills: string[]) {
  return unique(skills).filter((skill) => skill.length <= 40).slice(0, 40)
}

export function combineSkills(typed: string[], extracted: string[]) {
  return limitSkills([...typed, ...extracted])
}

function unique(skills: string[]) {
  return [...new Set(skills.map(normalize).filter((skill) => skill.length > 0))]
}

function normalize(skill: string) {
  return skill.trim().toLowerCase()
}

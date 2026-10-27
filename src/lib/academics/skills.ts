export function normalizeSkills(input: string): string[] {
  const skills = new Set<string>()
  for (const part of input.split(",")) {
    const skill = part.trim().toLowerCase()
    if (skill) skills.add(skill)
  }
  return [...skills].sort()
}

export function formatSkills(skills: string[]): string {
  return [...skills].sort().join(", ")
}

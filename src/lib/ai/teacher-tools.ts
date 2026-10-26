export const teachingToolNames = ["save_question", "save_link_material", "prepare_pdf", "save_exam_marks"] as const

const allowed = new Set<string>(teachingToolNames)

export function teachingToolsAreSaves(names: readonly string[]) {
  return names.length === teachingToolNames.length && names.every((name) => allowed.has(name))
}

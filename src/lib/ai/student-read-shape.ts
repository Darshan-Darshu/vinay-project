export const listCap = 40
export const passageCap = 8
export const matchCap = 8

export function titleFilter(query: string | undefined) {
  const text = query?.trim().replace(/[%_]/g, "") ?? ""
  return text.length > 0 ? text : null
}

export function capList<T>(rows: T[], total: number) {
  return { rows: rows.slice(0, listCap), total }
}

export function capPassages<T>(passages: T[], total: number) {
  return { passages: passages.slice(0, passageCap), total, truncated: total > passageCap }
}

type Titled = { id: string; title: string }

export function resolveTitle<T extends Titled>(rows: T[], title: string) {
  const needle = title.trim().toLowerCase()
  if (!needle) return { status: "none" as const }
  const matches = rows.filter((row) => row.title.toLowerCase().includes(needle))
  const exact = matches.filter((row) => row.title.toLowerCase() === needle)
  const chosen = exact.length > 0 ? exact : matches
  if (chosen.length === 0) return { status: "none" as const }
  if (chosen.length === 1) return { status: "one" as const, row: chosen[0] }
  return { status: "many" as const, rows: chosen.slice(0, matchCap), total: chosen.length }
}

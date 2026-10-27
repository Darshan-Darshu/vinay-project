export function splitPassages(text: string): string[] {
  const paragraphs = text.split(/\n\s*\n/).map((part) => part.trim()).filter((part) => part.length > 0)
  const passages: string[] = []
  for (const paragraph of paragraphs) {
    if (paragraph.length <= 1200) {
      passages.push(paragraph)
      continue
    }
    for (let index = 0; index < paragraph.length; index += 1200) {
      passages.push(paragraph.slice(index, index + 1200))
    }
  }
  return passages
}

export function rankPassages(
  query: number[],
  passages: { id: string; embedding: number[]; provider: string }[],
  provider: string,
) {
  return passages
    .flatMap((passage) => {
      if (passage.provider !== provider) return []
      const score = cosine(query, passage.embedding)
      if (score === null) return []
      return [{ id: passage.id, score }]
    })
    .sort((left, right) => right.score - left.score || left.id.localeCompare(right.id))
    .slice(0, 5)
}

export function cosine(left: number[], right: number[]) {
  if (left.length === 0 || left.length !== right.length) return null
  let dot = 0
  let leftSquare = 0
  let rightSquare = 0
  for (let index = 0; index < left.length; index += 1) {
    dot += left[index] * right[index]
    leftSquare += left[index] * left[index]
    rightSquare += right[index] * right[index]
  }
  if (leftSquare === 0 || rightSquare === 0) return null
  return dot / Math.sqrt(leftSquare * rightSquare)
}

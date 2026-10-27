import "server-only"

import { extractText } from "unpdf"

export async function extractPdfText(bytes: Uint8Array) {
  const result = await extractText(bytes, { mergePages: true })
  return (result.text ?? "").trim()
}

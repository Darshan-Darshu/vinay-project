"use server"

import { fail, field, ok } from "@/actions/admin/records/shared"
import type { FormState } from "@/actions/form-state"
import { extractPdfText } from "@/lib/ai/pdf-text"
import { indexUploadedPdf } from "@/lib/ai/pinecone-college"

const pdfLimit = 5 * 1024 * 1024

export async function uploadCollegePdf(_previous: FormState, formData: FormData): Promise<FormState> {
  const title = field(formData, "title").trim()
  if (!title || title.length > 160) return fail("Enter a title for the PDF.")
  const file = formData.get("file")
  if (!(file instanceof File) || file.size === 0) return fail("Choose a PDF to upload.")
  if (file.size > pdfLimit || (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf"))) {
    return fail("Upload a PDF that is 5 MB or smaller.")
  }
  let text = ""
  try {
    text = (await extractPdfText(new Uint8Array(await file.arrayBuffer()))) ?? ""
  } catch (error) {
    console.error(error)
    return fail("That PDF could not be read.")
  }
  const indexed = await indexUploadedPdf(title, text)
  if ("error" in indexed) return fail(indexed.error)
  return ok(`Added ${indexed.passages} passages to college search.`)
}

"use server"

import { staffContext, studentContext } from "@/actions/academics/shared"
import { embedTexts } from "@/lib/ai/embed"
import { rankPassages, splitPassages } from "@/lib/ai/passages"
import { extractPdfText } from "@/lib/ai/pdf-text"
import { recordUsage } from "@/lib/ai/usage"
import { isRecord, QueryError } from "@/lib/db/errors"
import type { AppRole } from "@/lib/permissions/roles"

export async function prepareStoredPdf(materialId: string) {
  const { profile, supabase } = await staffContext()
  const material = await supabase
    .from("learning_materials")
    .select("id, storage_path, kind")
    .eq("id", materialId)
    .is("deleted_at", null)
    .maybeSingle()
  if (material.error || !isRecord(material.data) || material.data.kind !== "pdf" || typeof material.data.storage_path !== "string") {
    return false
  }
  const downloaded = await supabase.storage.from("materials").download(material.data.storage_path)
  if (downloaded.error) return false
  let text = ""
  try {
    text = await extractPdfText(new Uint8Array(await downloaded.data.arrayBuffer()))
  } catch (error) {
    console.error(error)
    return false
  }
  const passages = splitPassages(text)
  if (passages.length === 0) return false
  const embedded = await embedTexts(passages)
  if (!embedded) return false
  await recordUsage({
    profileId: profile.id,
    role: profile.role,
    model: embedded.modelName,
    feature: "material_passages",
    latencyMs: embedded.latencyMs,
    promptTokens: embedded.promptTokens,
    completionTokens: null,
    status: "ok",
  })
  const saved = await supabase.rpc("replace_material_passages", {
    target_material: materialId,
    target_provider: embedded.provider,
    passages: passages.map((content, ordinal) => ({
      ordinal,
      content,
      embedding: embedded.vectors[ordinal] ?? [],
    })),
  })
  return !saved.error
}

export async function searchPassages(query: string, role: AppRole) {
  if (query.trim().length === 0) return []
  if (role === "student") await studentContext()
  else await staffContext()
  const embedded = await embedTexts([query])
  if (!embedded) return []
  const { supabase, profile } = role === "student" ? await studentContext() : await staffContext()
  await recordUsage({
    profileId: profile.id,
    role: profile.role,
    model: embedded.modelName,
    feature: "material_passages",
    latencyMs: embedded.latencyMs,
    promptTokens: embedded.promptTokens,
    completionTokens: null,
    status: "ok",
  })
  const materials = await supabase
    .from("learning_materials")
    .select("id, title")
    .eq("approved_for_rag", true)
    .eq("kind", "pdf")
    .is("deleted_at", null)
  if (materials.error) throw new QueryError()
  const titles = new Map<string, string>()
  const ids: string[] = []
  for (const row of materials.data ?? []) {
    if (isRecord(row) && typeof row.id === "string" && typeof row.title === "string") {
      ids.push(row.id)
      titles.set(row.id, row.title)
    }
  }
  if (ids.length === 0) return []
  const stored = await supabase
    .from("material_passages")
    .select("id, material_id, content, provider, embedding")
    .in("material_id", ids)
    .eq("provider", embedded.provider)
  if (stored.error) throw new QueryError()
  const ranked = rankPassages(
    embedded.vectors[0] ?? [],
    (stored.data ?? []).flatMap((row) => {
      if (!isRecord(row) || typeof row.id !== "string" || typeof row.content !== "string" || typeof row.provider !== "string") return []
      if (!Array.isArray(row.embedding)) return []
      const vector = row.embedding.filter((item): item is number => typeof item === "number")
      if (vector.length !== row.embedding.length) return []
      return [{ id: row.id, embedding: vector, provider: row.provider, content: row.content, materialId: typeof row.material_id === "string" ? row.material_id : "" }]
    }),
    embedded.provider,
  )
  const byId = new Map((stored.data ?? []).flatMap((row) => {
    if (!isRecord(row) || typeof row.id !== "string" || typeof row.content !== "string") return []
    const title = typeof row.material_id === "string" ? titles.get(row.material_id) ?? "" : ""
    return [[row.id, { content: row.content, title }]]
  }))
  return ranked.flatMap((item) => {
    const passage = byId.get(item.id)
    return passage ? [{ title: passage.title, content: passage.content }] : []
  })
}

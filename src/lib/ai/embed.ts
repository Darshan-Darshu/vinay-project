import "server-only"

import { embed, embedMany } from "ai"
import { google } from "@ai-sdk/google"
import { openai } from "@ai-sdk/openai"

import { ollamaClient } from "@/lib/ai/model"

export function getEmbedding() {
  const provider = process.env.AI_PROVIDER
  if (provider === "gemini") {
    const key = process.env.GEMINI_API_KEY?.trim()
    if (!key) return null
    process.env.GOOGLE_GENERATIVE_AI_API_KEY = key
    return { model: google.embedding("gemini-embedding-001"), modelName: "gemini-embedding-001", provider: "gemini" as const }
  }
  if (provider === "openai") {
    if (!process.env.OPENAI_API_KEY?.trim()) return null
    return { model: openai.embedding("text-embedding-3-small"), modelName: "text-embedding-3-small", provider: "openai" as const }
  }
  if (provider === "ollama") {
    const modelName = process.env.OLLAMA_EMBED_MODEL?.trim() || "nomic-embed-text"
    return { model: ollamaClient().embedding(modelName), modelName, provider: "ollama" as const }
  }
  return null
}

export async function embedTexts(values: string[]) {
  const selected = getEmbedding()
  if (!selected || values.length === 0) return null
  const started = Date.now()
  try {
    const result = values.length === 1
      ? await embed({ model: selected.model, value: values[0] })
      : await embedMany({ model: selected.model, values })
    const vectors = "embedding" in result ? [result.embedding] : result.embeddings
    return {
      vectors,
      provider: selected.provider,
      modelName: selected.modelName,
      latencyMs: Date.now() - started,
      promptTokens: result.usage.tokens ?? null,
    }
  } catch (error) {
    console.error(error)
    return null
  }
}

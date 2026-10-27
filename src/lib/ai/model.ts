import "server-only";

import { generateObject, type LanguageModel } from "ai";
import { google } from "@ai-sdk/google";
import { openai } from "@ai-sdk/openai";
import { createOllama } from "ai-sdk-ollama";
import type { z } from "zod";

const defaultOllamaModel = "qwen2.5:14b";
const defaultGeminiModel = "gemini-3.5-flash-lite";

export function ollamaClient() {
  const baseURL =
    process.env.OLLAMA_BASE_URL?.trim() || "http://127.0.0.1:11434";
  return createOllama({ baseURL });
}

export const chatProviderOptions = {
  google: {
    thinkingConfig: { thinkingLevel: "minimal" as const },
  },
};

export function getModel(): { model: LanguageModel; modelName: string } | null {
  const provider = process.env.AI_PROVIDER;
  if (provider === "gemini") {
    const key = process.env.GEMINI_API_KEY?.trim();
    if (!key) return null;
    process.env.GOOGLE_GENERATIVE_AI_API_KEY = key;
    const modelName = process.env.GEMINI_MODEL?.trim() || defaultGeminiModel;
    return { model: google(modelName), modelName };
  }
  if (provider === "openai") {
    if (!process.env.OPENAI_API_KEY?.trim()) return null;
    return { model: openai("gpt-4.1-mini"), modelName: "gpt-4.1-mini" };
  }
  if (provider === "ollama") {
    const modelName = process.env.OLLAMA_MODEL?.trim() || defaultOllamaModel;
    return { model: ollamaClient()(modelName), modelName };
  }
  return null;
}

export async function generateJson<T>(
  schema: z.ZodType<T>,
  system: string,
  prompt: string,
) {
  const selected = getModel();
  if (!selected) return null;
  const started = Date.now();
  try {
    const result = await generateObject({
      model: selected.model,
      schema,
      system,
      prompt,
    });
    return {
      object: result.object,
      modelName: selected.modelName,
      latencyMs: Date.now() - started,
      promptTokens: result.usage.inputTokens ?? null,
      completionTokens: result.usage.outputTokens ?? null,
    };
  } catch (error) {
    console.error(error);
    return {
      object: null,
      modelName: selected.modelName,
      latencyMs: Date.now() - started,
      promptTokens: null,
      completionTokens: null,
    };
  }
}

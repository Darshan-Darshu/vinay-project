import "server-only"

import { isStepCount, ToolLoopAgent, tool, type LanguageModel } from "ai"
import { z } from "zod"

import { chatProviderOptions, getModel } from "@/lib/ai/model"
import {
  getStudentAnnouncement,
  getStudentEvent,
  getStudentMaterial,
  listStudentAnnouncements,
  listStudentEvents,
  listStudentMaterials,
  searchStudentNotes,
} from "@/lib/ai/student-reads"
import type { AiFeature } from "@/lib/ai/usage"
import { recordUsage } from "@/lib/ai/usage"
import type { AppRole } from "@/lib/permissions/roles"

const taskSchema = z.object({ task: z.string().min(1).max(2000) })
const querySchema = z.object({ query: z.string().optional() })
const recordSchema = z.object({ id: z.string().optional(), title: z.string().optional() })
const parentStepLimit = 4
const specialistStepLimit = 5
const maxSpecialistCalls = 2
const specialistFailed = "The records could not be loaded."

const specialistFeatures = {
  materials: "chat_student_materials",
  events: "chat_student_events",
  announcements: "chat_student_announcements",
} as const satisfies Record<string, AiFeature>

type Specialist = keyof typeof specialistFeatures
type Profile = { id: string; role: AppRole }

export async function runStudentTurn(
  history: { role: "user" | "assistant"; content: string }[],
  message: string,
  profile: Profile,
  onDelta: (delta: string) => void,
  abortSignal?: AbortSignal,
) {
  const selected = getModel()
  if (!selected) return null
  const started = Date.now()
  const calls = { count: 0 }
  try {
    const agent = new ToolLoopAgent({
      model: selected.model,
      providerOptions: chatProviderOptions,
      instructions: `You are the student assistant for one college. If the student is only greeting you, answer briefly without tools. For notes or a question about a PDF topic, call ask_materials. For events, call ask_events. For announcements, call ask_announcements. You may call two specialists when the question spans two of those. Then answer in Markdown from their summaries only. Do not invent dates, venues, announcement text, or quotations from notes. Quiz scores, profile edits, resume skills, and placement applications are not available in this chat. Say that and stop. A greeting does not need a tool.`,
      stopWhen: isStepCount(parentStepLimit),
      prepareStep: async ({ steps }) => {
        const used = steps.reduce((sum, step) => sum + (step.toolCalls?.length ?? 0), 0)
        if (used >= maxSpecialistCalls) return { activeTools: [] }
        return {}
      },
      tools: {
        ask_materials: askTool("materials", "Answer from this student's course notes and PDFs.", calls, profile, selected.model, selected.modelName, abortSignal),
        ask_events: askTool("events", "List campus events or read one event.", calls, profile, selected.model, selected.modelName, abortSignal),
        ask_announcements: askTool("announcements", "List current announcements or read one announcement.", calls, profile, selected.model, selected.modelName, abortSignal),
      },
    })
    const result = await agent.stream({
      messages: [...history, { role: "user", content: message }],
      abortSignal,
    })
    let text = ""
    for await (const delta of result.textStream) {
      if (delta) {
        text += delta
        onDelta(delta)
      }
    }
    if (abortSignal?.aborted) return text.trim() || null
    const usage = await result.totalUsage
    await recordUsage({
      profileId: profile.id,
      role: profile.role,
      model: selected.modelName,
      feature: "chat_student",
      latencyMs: Date.now() - started,
      promptTokens: usage.inputTokens ?? null,
      completionTokens: usage.outputTokens ?? null,
      status: text.trim() ? "ok" : "error",
    })
    return text.trim() || null
  } catch (error) {
    console.error(error)
    return null
  }
}

function askTool(
  specialist: Specialist,
  description: string,
  calls: { count: number },
  profile: Profile,
  model: LanguageModel,
  modelName: string,
  abortSignal: AbortSignal | undefined,
) {
  return tool({
    description,
    inputSchema: taskSchema,
    execute: async ({ task }, options) => {
      if (calls.count >= maxSpecialistCalls) return "Ask no more specialists this turn. Answer with the summaries you already have."
      calls.count += 1
      return runSpecialist(specialist, task, profile, model, modelName, options.abortSignal ?? abortSignal)
    },
  })
}

async function runSpecialist(
  specialist: Specialist,
  task: string,
  profile: Profile,
  model: LanguageModel,
  modelName: string,
  abortSignal: AbortSignal | undefined,
) {
  const started = Date.now()
  try {
    const result = await specialistAgent(specialist, model).generate({ prompt: task, abortSignal })
    const usage = await Promise.resolve(result.totalUsage)
    await recordUsage({
      profileId: profile.id,
      role: profile.role,
      model: modelName,
      feature: specialistFeatures[specialist],
      latencyMs: Date.now() - started,
      promptTokens: usage.inputTokens ?? null,
      completionTokens: usage.outputTokens ?? null,
      status: result.text.trim() ? "ok" : "error",
    })
    return result.text.trim() || specialistFailed
  } catch (error) {
    console.error(error)
    return specialistFailed
  }
}

function specialistAgent(specialist: Specialist, model: LanguageModel) {
  if (specialist === "materials") return materialsAgent(model)
  if (specialist === "events") return eventsAgent(model)
  return announcementsAgent(model)
}

function materialsAgent(model: LanguageModel) {
  return new ToolLoopAgent({
    model,
    providerOptions: chatProviderOptions,
    instructions: `You are the materials specialist for one student. Use search for a question about a topic. Use list when the student asks which notes exist. Use get for one material by id or title. Quote only passage text a tool returned, and name that material's title. If passages are not ready, say so. If a tool returns matches, name those titles and ask which one. If a tool returns error unavailable, say the notes could not be loaded. If search returns no passages, say no approved notes match that topic. Finish with a summary the router can show.`,
    stopWhen: isStepCount(specialistStepLimit),
    prepareStep: async ({ stepNumber }) => (stepNumber === 0 ? { toolChoice: "required" as const } : {}),
    tools: {
      search: tool({
        description: "Search approved PDF passages in this student's course.",
        inputSchema: z.object({ query: z.string().min(1) }),
        execute: async ({ query }) => searchStudentNotes(query),
      }),
      list: tool({
        description: "List materials on this student's course. Optionally filter by title.",
        inputSchema: querySchema,
        execute: async ({ query }) => listStudentMaterials(query),
      }),
      get: tool({
        description: "Read one material by id or title. Approved PDFs include up to eight passages.",
        inputSchema: recordSchema,
        execute: async (input) => getStudentMaterial(input),
      }),
    },
  })
}

function eventsAgent(model: LanguageModel) {
  return new ToolLoopAgent({
    model,
    providerOptions: chatProviderOptions,
    instructions: `You are the events specialist for one student. Use allinfo to list events and getevent for one event, including its description. Do not invent a date, venue, or description. An empty list means nothing is published for that request. If the total is higher than the rows returned, say there are more and ask for a title. If a tool returns matches, name those titles and ask which one. If a tool returns error unavailable, say the events could not be loaded. Finish with a summary the router can show.`,
    stopWhen: isStepCount(specialistStepLimit),
    prepareStep: async ({ stepNumber }) => (stepNumber === 0 ? { toolChoice: "required" as const } : {}),
    tools: {
      allinfo: tool({
        description: "List published events this student can read. Optionally filter by title.",
        inputSchema: querySchema,
        execute: async ({ query }) => listStudentEvents(query),
      }),
      getevent: tool({
        description: "Read one published event by id or title, including its description.",
        inputSchema: recordSchema,
        execute: async (input) => getStudentEvent(input),
      }),
    },
  })
}

function announcementsAgent(model: LanguageModel) {
  return new ToolLoopAgent({
    model,
    providerOptions: chatProviderOptions,
    instructions: `You are the announcements specialist for one student. Use allinfo to list current announcements and getannouncement for one announcement, including its body. Do not invent announcement text. An empty list means nothing is published for that request. If the total is higher than the rows returned, say there are more and ask for a title. If a tool returns matches, name those titles and ask which one. If a tool returns error unavailable, say the announcements could not be loaded. Finish with a summary the router can show.`,
    stopWhen: isStepCount(specialistStepLimit),
    prepareStep: async ({ stepNumber }) => (stepNumber === 0 ? { toolChoice: "required" as const } : {}),
    tools: {
      allinfo: tool({
        description: "List current announcements for everyone or students. Optionally filter by title.",
        inputSchema: querySchema,
        execute: async ({ query }) => listStudentAnnouncements(query),
      }),
      getannouncement: tool({
        description: "Read one current announcement by id or title, including its body.",
        inputSchema: recordSchema,
        execute: async (input) => getStudentAnnouncement(input),
      }),
    },
  })
}

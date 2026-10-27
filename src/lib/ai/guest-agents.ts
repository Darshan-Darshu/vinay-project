import "server-only"

import { isStepCount, ToolLoopAgent, tool, type LanguageModel } from "ai"
import { z } from "zod"

import { getModel } from "@/lib/ai/model"
import {
  admissionFormSignal,
  groundReply,
  unpublishedReply,
  wantsAdmissionForm,
} from "@/lib/ai/guest-college"
import {
  readAdmissionsBrief,
  readCollegeProfile,
  readGuestAnnouncements,
  readGuestCourse,
  readGuestCourses,
  readGuestDepartments,
  readGuestEvents,
  readGuestSemesters,
  readGuestSubjects,
  readGuestYears,
} from "@/lib/ai/guest-reads"
import { searchCollegePassages } from "@/lib/ai/pinecone-college"

const taskSchema = z.object({ task: z.string().min(1).max(2000) })
const courseFilter = {
  department: z.string().optional(),
  code: z.string().optional(),
  name: z.string().optional(),
}

export async function runGuestTurn(
  history: { role: "user" | "assistant"; content: string }[],
  message: string,
  onDelta: (delta: string) => void,
  onForm?: () => void,
  abortSignal?: AbortSignal,
) {
  const selected = getModel()
  if (!selected) return
  try {
    const result = await guestRouter(selected.model, onForm).stream({
      messages: [...history, { role: "user", content: message }],
      abortSignal,
    })
    for await (const delta of result.textStream) {
      if (delta) onDelta(delta)
    }
  } catch (error) {
    console.error(error)
  }
}

function guestRouter(model: LanguageModel, onForm?: () => void) {
  return new ToolLoopAgent({
    model,
    instructions: `You are the guest assistant for one college. If the visitor is only greeting you, answer briefly without tools. For any fact about admissions or the college, call a specialist first. Call ask_admissions for admissions, courses, and registration. Call ask_college for the campus, events, and announcements. You may call both. Then answer in Markdown: a short lead, then lists or headings when there are several courses, dates, or steps. Use only the specialist summaries. Do not invent fees, dates, contacts, or application status. Never write a link, "click here", or "fill out the application form". When the visitor should apply, the chat shows the application form on its own.`,
    stopWhen: isStepCount(4),
    tools: {
      ask_admissions: tool({
        description: "Ask the admissions specialist about published admissions, courses, and registration.",
        inputSchema: taskSchema,
        execute: async ({ task }, { abortSignal }) => runSpecialist("admissions", task, abortSignal, onForm),
      }),
      ask_college: tool({
        description: "Ask the college specialist about the campus, events, announcements, and published pages.",
        inputSchema: taskSchema,
        execute: async ({ task }, { abortSignal }) => runSpecialist("college", task, abortSignal, onForm),
      }),
    },
  })
}

function admissionsAgent(model: LanguageModel) {
  return new ToolLoopAgent({
    model,
    instructions: `You are the admissions specialist for one college. Use only your tools. Say that the office has not published an answer when a field is empty. Never invent an application status, a fee, or a deadline. When the visitor asks how to apply, wants to apply or register, or you would otherwise invite them to apply, call offer_application_form. Do not write a link, "click here", or "fill out the application form", and do not type their personal details. Finish with a summary the router can show.`,
    stopWhen: isStepCount(6),
    prepareStep: async ({ stepNumber }) => (stepNumber === 0 ? { toolChoice: "required" as const } : {}),
    tools: {
      read_admissions_info: tool({
        description: "Published admissions text and public contact details.",
        inputSchema: z.object({}),
        execute: async () => readAdmissionsBrief(),
      }),
      list_departments: tool({
        description: "Active departments. Optionally filter by name or code.",
        inputSchema: z.object({ name: z.string().optional() }),
        execute: async ({ name }) => readGuestDepartments(name),
      }),
      list_courses: tool({
        description: "Active courses. Optionally filter by department name or code, course code, or course name.",
        inputSchema: z.object(courseFilter),
        execute: async (filter) => readGuestCourses(filter),
      }),
      read_course: tool({
        description: "One active course by code or name.",
        inputSchema: z.object({ code: z.string().optional(), name: z.string().optional() }),
        execute: async (filter) => readGuestCourse(filter),
      }),
      list_subjects: tool({
        description: "Active subjects for a course code.",
        inputSchema: z.object({ courseCode: z.string() }),
        execute: async ({ courseCode }) => readGuestSubjects(courseCode),
      }),
      list_academic_years: tool({
        description: "Academic years.",
        inputSchema: z.object({}),
        execute: async () => readGuestYears(),
      }),
      list_semesters: tool({
        description: "Active semesters for a course code.",
        inputSchema: z.object({ courseCode: z.string() }),
        execute: async ({ courseCode }) => readGuestSemesters(courseCode),
      }),
      offer_application_form: tool({
        description: "Show the admission application form. This does not save an application.",
        inputSchema: z.object({}),
        execute: async () => admissionFormSignal,
      }),
    },
  })
}

function collegeAgent(model: LanguageModel) {
  return new ToolLoopAgent({
    model,
    instructions: `You are the college specialist for one college. Use only your tools. Search published pages before you answer a broad question. Quote a passage only when search_college returned that exact text. Say that the office has not published an answer when the tools are empty. Finish with a summary the router can show, and name the source title for each passage you use.`,
    stopWhen: isStepCount(6),
    prepareStep: async ({ stepNumber }) => (stepNumber === 0 ? { toolChoice: "required" as const } : {}),
    tools: {
      read_college_profile: tool({
        description: "Public college name, about text, and contact details.",
        inputSchema: z.object({}),
        execute: async () => readCollegeProfile(),
      }),
      list_departments: tool({
        description: "Active departments. Optionally filter by name or code.",
        inputSchema: z.object({ name: z.string().optional() }),
        execute: async ({ name }) => readGuestDepartments(name),
      }),
      list_courses: tool({
        description: "Active courses. Optionally filter by department name or code, course code, or course name.",
        inputSchema: z.object(courseFilter),
        execute: async (filter) => readGuestCourses(filter),
      }),
      list_events: tool({
        description: "Upcoming public events.",
        inputSchema: z.object({}),
        execute: async () => readGuestEvents(),
      }),
      list_announcements: tool({
        description: "Current public announcements.",
        inputSchema: z.object({}),
        execute: async () => readGuestAnnouncements(),
      }),
      search_college: tool({
        description: "Retrieve published college passages from the search index.",
        inputSchema: z.object({ query: z.string() }),
        execute: async ({ query }) => searchCollegePassages(query),
      }),
    },
  })
}

async function runSpecialist(
  kind: "admissions" | "college",
  task: string,
  abortSignal: AbortSignal | undefined,
  onForm?: () => void,
) {
  const selected = getModel()
  if (!selected) return unpublishedReply
  const toolResults: string[] = []
  try {
    const agent = kind === "admissions" ? admissionsAgent(selected.model) : collegeAgent(selected.model)
    const result = await agent.generate({
      prompt: task,
      abortSignal,
      onToolExecutionEnd: ({ toolOutput }) => {
        if (toolOutput.type !== "tool-result") return
        const output = toolOutput.output
        toolResults.push(typeof output === "string" ? output : JSON.stringify(output))
      },
    })
    if (wantsAdmissionForm(toolResults)) onForm?.()
    return groundReply(result.text, toolResults) || unpublishedReply
  } catch (error) {
    console.error(error)
    return unpublishedReply
  }
}

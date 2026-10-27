import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { groupInterviewTurns, interviewReportSchema } from "./interview-report.ts"

const report = {
  score: 82,
  summary: "Clear examples, with thin detail on tradeoffs.",
  questionComments: [1, 2, 3, 4, 5].map((main) => ({ main, comment: `Comment ${main}` })),
  strengths: ["Specific examples"],
  gaps: ["Skipped the tradeoff"],
  nextSteps: ["Practice a one-minute tradeoff answer"],
}

describe("interviewReportSchema", () => {
  it("accepts a score, five comments, and short lists", () => {
    assert.deepEqual(interviewReportSchema.parse(report).score, 82)
  })

  it("rejects a score outside 0 to 100", () => {
    assert.equal(interviewReportSchema.safeParse({ ...report, score: 101 }).success, false)
    assert.equal(interviewReportSchema.safeParse({ ...report, score: -1 }).success, false)
  })

  it("requires comments for mains 1 through 5", () => {
    const comments = report.questionComments.map((comment) => ({ ...comment }))
    comments[4] = { main: 4, comment: "Duplicate" }
    assert.equal(interviewReportSchema.safeParse({ ...report, questionComments: comments }).success, false)
    assert.equal(interviewReportSchema.safeParse({ ...report, questionComments: comments.slice(0, 4) }).success, false)
  })

  it("keeps each list between 1 and 4 items", () => {
    assert.equal(interviewReportSchema.safeParse({ ...report, strengths: [] }).success, false)
    assert.equal(
      interviewReportSchema.safeParse({
        ...report,
        nextSteps: ["One", "Two", "Three", "Four", "Five"],
      }).success,
      false,
    )
  })
})

describe("groupInterviewTurns", () => {
  it("keeps an unanswered question as the current prompt", () => {
    assert.deepEqual(
      groupInterviewTurns([
        { kind: "question", content: "Tell me about a project." },
        { kind: "answer", content: "I shipped a billing page." },
        { kind: "question", content: "What would you change?" },
      ]),
      {
        exchanges: [
          {
            main: 1,
            question: "Tell me about a project.",
            answer: "I shipped a billing page.",
            followUp: "",
            followUpAnswer: "",
          },
        ],
        pending: { main: 2, kind: "question", prompt: "What would you change?" },
      },
    )
  })

  it("attaches one follow-up and leaves the next question pending", () => {
    assert.deepEqual(
      groupInterviewTurns([
        { kind: "question", content: "Tell me about a project." },
        { kind: "answer", content: "I shipped a billing page." },
        { kind: "follow_up", content: "What broke?" },
        { kind: "answer", content: "The tax rounding." },
        { kind: "question", content: "How did you test it?" },
      ]),
      {
        exchanges: [
          {
            main: 1,
            question: "Tell me about a project.",
            answer: "I shipped a billing page.",
            followUp: "What broke?",
            followUpAnswer: "The tax rounding.",
          },
        ],
        pending: { main: 2, kind: "question", prompt: "How did you test it?" },
      },
    )
  })

  it("shows the main answer while a follow-up is still unanswered", () => {
    assert.deepEqual(
      groupInterviewTurns([
        { kind: "question", content: "Tell me about a project." },
        { kind: "answer", content: "I shipped a billing page." },
        { kind: "follow_up", content: "What broke?" },
      ]),
      {
        exchanges: [
          {
            main: 1,
            question: "Tell me about a project.",
            answer: "I shipped a billing page.",
            followUp: "",
            followUpAnswer: "",
          },
        ],
        pending: { main: 1, kind: "follow_up", prompt: "What broke?" },
      },
    )
  })
})

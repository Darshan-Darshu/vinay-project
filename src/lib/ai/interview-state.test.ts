import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { acceptInterviewTurn, interviewTurnSchema, type InterviewPhase } from "./interview-state.ts"

const open = (mainCount: number, followUpPending = false): InterviewPhase => ({
  mainCount,
  followUpPending,
  completed: false,
  awaitingReport: false,
})

describe("acceptInterviewTurn", () => {
  it("rejects a second follow-up", () => {
    assert.equal(
      acceptInterviewTurn(open(2, true), { kind: "follow_up", question: "Say more." }),
      null,
    )
  })

  it("rejects close before the fifth main question", () => {
    assert.equal(acceptInterviewTurn(open(3), { kind: "close" }), null)
  })

  it("rejects a scored result", () => {
    assert.equal(
      interviewTurnSchema.safeParse({ kind: "result", score: 80, feedback: "Clear answers." }).success,
      false,
    )
  })

  it("accepts the first question", () => {
    assert.deepEqual(acceptInterviewTurn(open(0), { kind: "question", question: "Tell me about a project." }), {
      mainCount: 1,
      followUpPending: false,
      completed: false,
      awaitingReport: false,
    })
  })

  it("waits for a report when the fifth question closes", () => {
    assert.deepEqual(acceptInterviewTurn(open(5), { kind: "close" }), {
      mainCount: 5,
      followUpPending: false,
      completed: false,
      awaitingReport: true,
    })
  })

  it("still allows one follow-up on the fifth question", () => {
    assert.deepEqual(acceptInterviewTurn(open(5), { kind: "follow_up", question: "Which part failed?" }), {
      mainCount: 5,
      followUpPending: true,
      completed: false,
      awaitingReport: false,
    })
  })

  it("closes after the fifth follow-up is answered", () => {
    assert.deepEqual(acceptInterviewTurn(open(5, true), { kind: "close" }), {
      mainCount: 5,
      followUpPending: false,
      completed: false,
      awaitingReport: true,
    })
  })
})

describe("interviewTurnSchema", () => {
  it("rejects a follow-up that has no question", () => {
    assert.equal(interviewTurnSchema.safeParse({ kind: "follow_up", question: "" }).success, false)
  })

  it("accepts a follow-up question and a close", () => {
    assert.equal(interviewTurnSchema.safeParse({ kind: "follow_up", question: "What did you change?" }).success, true)
    assert.deepEqual(interviewTurnSchema.safeParse({ kind: "close" }).data, { kind: "close" })
  })
})

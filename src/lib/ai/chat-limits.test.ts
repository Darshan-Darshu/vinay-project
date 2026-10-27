import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { allowStep, guestToolListIsSafe, guestToolNames } from "./chat-limits.ts"

describe("allowStep", () => {
  it("stops before a fifth parent call and a seventh tool call", () => {
    assert.equal(allowStep(4, 4), false)
    assert.equal(allowStep(3, 4), true)
    assert.equal(allowStep(6, 6), false)
    assert.equal(allowStep(5, 6), true)
  })
})

describe("guestToolListIsSafe", () => {
  it("has no write tool and no tool that reads a student row", () => {
    assert.equal(guestToolListIsSafe(guestToolNames), true)
    assert.equal(guestToolListIsSafe(["save_exam_marks"]), false)
    assert.equal(guestToolListIsSafe(["read_quiz_scores"]), false)
  })
})

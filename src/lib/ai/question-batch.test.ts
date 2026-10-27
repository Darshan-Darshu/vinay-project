import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { parseQuestionBatch } from "./question-batch.ts"

const valid = {
  questionType: "mcq",
  difficulty: "medium",
  marks: 2,
  stem: "What is a join?",
  explanation: "It combines rows.",
  options: [
    { body: "A combined row set", isCorrect: true },
    { body: "A deleted row", isCorrect: false },
  ],
}

describe("parseQuestionBatch", () => {
  it("accepts a valid batch", () => {
    const batch = parseQuestionBatch([valid])
    assert.equal(batch?.length, 1)
    assert.equal(batch?.[0]?.stem, "What is a join?")
  })

  it("returns null when any question is invalid", () => {
    assert.equal(
      parseQuestionBatch([
        valid,
        {
          ...valid,
          options: [
            { body: "A", isCorrect: true },
            { body: "B", isCorrect: true },
          ],
        },
      ]),
      null,
    )
  })

  it("returns null for an empty batch", () => {
    assert.equal(parseQuestionBatch([]), null)
  })
})

import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { scoreAnswers } from "./score.ts"
import { normalizeSkills } from "./skills.ts"

describe("scoreAnswers", () => {
  const questions = [
    { id: "q1", marks: 2, correctOptionId: "a" },
    { id: "q2", marks: 3, correctOptionId: "b" },
    { id: "q3", marks: 1, correctOptionId: "c" },
    { id: "q4", marks: 4, correctOptionId: "d" },
  ]

  it("stores the sum of the two correct questions", () => {
    const score = scoreAnswers(questions, [
      { questionId: "q1", optionId: "a" },
      { questionId: "q2", optionId: "wrong" },
      { questionId: "q3", optionId: "c" },
    ])
    assert.equal(score, 3)
  })

  it("scores an unanswered question as zero", () => {
    assert.equal(scoreAnswers(questions, []), 0)
  })
})

describe("normalizeSkills", () => {
  it("trims, lowercases, and de-duplicates skills", () => {
    assert.deepEqual(normalizeSkills(" Java, sql, Java , "), ["java", "sql"])
  })

  it("allows an empty list", () => {
    assert.deepEqual(normalizeSkills("  "), [])
  })
})

import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { rankPassages, splitPassages } from "./passages.ts"

describe("splitPassages", () => {
  it("keeps a short paragraph whole and splits a long one", () => {
    const long = "a".repeat(1201)
    assert.deepEqual(splitPassages(`Hello\n\n${long}`).map((passage) => passage.length), [5, 1200, 1])
  })
})

describe("rankPassages", () => {
  it("returns at most five passages from the current provider", () => {
    const passages = Array.from({ length: 6 }, (_, index) => ({
      id: `p${index}`,
      provider: index === 0 ? "openai" : "gemini",
      embedding: [index === 0 ? 0 : 1, 0],
    }))
    const ranked = rankPassages([1, 0], passages, "gemini")
    assert.equal(ranked.length, 5)
    assert.equal(ranked.some((passage) => passage.id === "p0"), false)
  })
})

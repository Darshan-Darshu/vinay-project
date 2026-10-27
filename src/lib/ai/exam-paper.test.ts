import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { canGenerateExamPaper, examPaperTotal, parseExamSection } from "./exam-paper.ts"

describe("parseExamSection", () => {
  it("accepts a section whose length matches the requested count", () => {
    const section = parseExamSection([{ stem: " Define a key. " }, { stem: "Name one normal form." }], 2)
    assert.deepEqual(section, ["Define a key.", "Name one normal form."])
  })

  it("returns null when the count does not match", () => {
    assert.equal(parseExamSection([{ stem: "Define a key." }], 2), null)
  })

  it("returns null when a stem is empty", () => {
    assert.equal(parseExamSection([{ stem: "Define a key." }, { stem: "   " }], 2), null)
  })
})

describe("examPaperTotal", () => {
  it("adds each band by its marks", () => {
    assert.equal(examPaperTotal({ one: 10, two: 5, five: 6, twenty: 2 }), 90)
  })

  it("blocks generate at zero questions and at 31 questions", () => {
    assert.equal(canGenerateExamPaper({ one: 0, two: 0, five: 0, twenty: 0 }), false)
    assert.equal(canGenerateExamPaper({ one: 20, two: 10, five: 1, twenty: 0 }), false)
    assert.equal(canGenerateExamPaper({ one: 10, two: 5, five: 6, twenty: 2 }), true)
  })
})

import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { capList, capPassages, resolveTitle, titleFilter } from "./student-read-shape.ts"

const notes = [
  { id: "1", title: "Algorithms" },
  { id: "2", title: "Algorithm design" },
  { id: "3", title: "Databases" },
]

describe("titleFilter", () => {
  it("drops blank text and like wildcards", () => {
    assert.equal(titleFilter("  "), null)
    assert.equal(titleFilter("algo%_"), "algo")
  })
})

describe("capList", () => {
  it("keeps the first 40 rows and the full total", () => {
    const rows = Array.from({ length: 50 }, (_, index) => index)
    const capped = capList(rows, 50)
    assert.equal(capped.rows.length, 40)
    assert.equal(capped.total, 50)
  })
})

describe("capPassages", () => {
  it("marks a material truncated after eight passages", () => {
    const passages = Array.from({ length: 10 }, (_, index) => index)
    const capped = capPassages(passages, 10)
    assert.equal(capped.passages.length, 8)
    assert.equal(capped.truncated, true)
  })
})

describe("resolveTitle", () => {
  it("returns one exact title, several partial titles, or none", () => {
    assert.deepEqual(resolveTitle(notes, "Databases"), { status: "one", row: notes[2] })
    const many = resolveTitle(notes, "algorithm")
    assert.equal(many.status, "many")
    if (many.status === "many") assert.equal(many.total, 2)
    assert.deepEqual(resolveTitle(notes, "chemistry"), { status: "none" })
  })
})

import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  capList,
  capWindow,
  marksFromRows,
  recordsUnavailable,
  resolveFields,
  scoresForRoll,
  studentFromRow,
  subjectFromLink,
  textFilter,
} from "./teacher-read-shape.ts"

const subjects = [
  { id: "1", code: "CS201", name: "Algorithms" },
  { id: "2", code: "CS202", name: "Algorithm design" },
  { id: "3", code: "CS301", name: "Databases" },
]

describe("textFilter", () => {
  it("drops blank text and like wildcards", () => {
    assert.equal(textFilter("  "), null)
    assert.equal(textFilter("cs%_"), "cs")
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

describe("capWindow", () => {
  it("keeps the first 20 scores and the full total", () => {
    const rows = Array.from({ length: 25 }, (_, index) => index)
    const capped = capWindow(rows, 25)
    assert.equal(capped.rows.length, 20)
    assert.equal(capped.total, 25)
  })
})

describe("resolveFields", () => {
  it("returns one exact code, several partial names, or none", () => {
    const fields = (row: (typeof subjects)[number]) => [row.name, row.code]
    assert.deepEqual(resolveFields(subjects, "CS301", fields), { status: "one", row: subjects[2] })
    const many = resolveFields(subjects, "algorithm", fields)
    assert.equal(many.status, "many")
    if (many.status === "many") assert.equal(many.total, 2)
    assert.deepEqual(resolveFields(subjects, "chemistry", fields), { status: "none" })
  })
})

describe("subjectFromLink", () => {
  it("keeps an active assigned subject and drops an inactive one", () => {
    const rows = subjectFromLink({
      subjects: {
        id: "s1",
        name: "Algorithms",
        code: "CS201",
        credits: 4,
        semester_number: 3,
        is_active: true,
        courses: { name: "BSc CS" },
      },
    })
    assert.deepEqual(rows, [{ id: "s1", code: "CS201", name: "Algorithms", credits: 4, semester: 3, course: "BSc CS" }])
    assert.deepEqual(subjectFromLink({ subjects: { id: "s2", name: "Old", code: "CS1", credits: 1, semester_number: 1, is_active: false, courses: { name: "BSc CS" } } }), [])
  })
})

describe("studentFromRow", () => {
  it("reads the student id, name, and roll number", () => {
    assert.deepEqual(studentFromRow({ id: "st1", roll_number: "24CS001", profiles: { full_name: "Ada" } }), [
      { id: "st1", name: "Ada", rollNumber: "24CS001" },
    ])
  })
})

describe("scoresForRoll", () => {
  it("keeps one student's scores and drops another roll number", () => {
    const scores = scoresForRoll([
      { rollNumber: "24CS001", title: "Quiz 1", score: 8, maxScore: 10, submittedAt: "2026-10-01T00:00:00Z" },
      { rollNumber: "24CS002", title: "Quiz 1", score: 1, maxScore: 10, submittedAt: "2026-10-01T00:00:00Z" },
    ], "24CS001")
    assert.equal(scores.total, 1)
    assert.deepEqual(scores.scores, [{ title: "Quiz 1", score: 8, maximum: 10, submittedAt: "2026-10-01T00:00:00Z" }])
  })
})

describe("marksFromRows", () => {
  it("reads exam name, subject code, score, and maximum", () => {
    const marks = marksFromRows([
      { exam_name: "Midterm", score: 40, maximum: 50, subjects: { code: "CS201" } },
    ], 1)
    assert.deepEqual(marks, { marks: [{ examName: "Midterm", subjectCode: "CS201", score: 40, maximum: 50 }], total: 1 })
  })
})

describe("recordsUnavailable", () => {
  it("is the query failure object", () => {
    assert.deepEqual(recordsUnavailable, { error: "unavailable" })
  })
})

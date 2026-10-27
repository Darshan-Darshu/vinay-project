import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { canReadAttempt, parseExamCsv, parseExamMark } from "./exam-marks.ts"

describe("parseExamMark", () => {
  it("accepts a score inside the maximum", () => {
    assert.deepEqual(parseExamMark({ rollNumber: "R1", subjectCode: "CS101", examName: "Midterm", score: 40, maximum: 50 }), {
      rollNumber: "R1",
      subjectCode: "CS101",
      examName: "Midterm",
      score: 40,
      maximum: 50,
    })
  })

  it("rejects a score above the maximum", () => {
    assert.equal(parseExamMark({ rollNumber: "R1", subjectCode: "CS101", examName: "Midterm", score: 60, maximum: 50 }), null)
  })
})

describe("parseExamCsv", () => {
  it("returns null when one row is bad", () => {
    const csv = ["roll_number,subject_code,exam_name,score,maximum", "R1,CS101,Midterm,40,50", "R2,CS101,Midterm,80,50"].join("\n")
    assert.equal(parseExamCsv(csv), null)
  })
})

describe("canReadAttempt", () => {
  it("returns nothing for another student's attempt", () => {
    assert.equal(canReadAttempt("student-a", "student-b"), false)
  })
})

import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { describe, it } from "node:test"

const source = readFileSync(new URL("../../actions/ai/interview.ts", import.meta.url), "utf8")

describe("answerInterview session lookup", () => {
  it("selects every column the session parser requires", () => {
    const defined = source.match(/const sessionSelect =\n\s+"([^"]+)"/)
    assert.ok(defined, "session columns should stay in one select")
    const body = source.slice(source.indexOf("export async function answerInterview"))
    assert.match(body, /sessionSelect/)
    for (const column of ["id", "role_title", "status", "created_at", "main_count", "follow_up_pending", "report"]) {
      assert.match(defined[1], new RegExp(`\\b${column}\\b`))
    }
  })

  it("saves the closing answer before asking for the report", () => {
    const start = source.indexOf("async function closeAndReport")
    assert.ok(start >= 0, "closeAndReport should save the last answer")
    const body = source.slice(start)
    const next = body.indexOf("\nasync function ", 1)
    const closeAndReport = next === -1 ? body : body.slice(0, next)
    const closeAt = closeAndReport.indexOf("close_interview")
    const reportAt = closeAndReport.indexOf("requestInterviewReport")
    assert.ok(closeAt >= 0)
    assert.ok(reportAt > closeAt)
  })
})

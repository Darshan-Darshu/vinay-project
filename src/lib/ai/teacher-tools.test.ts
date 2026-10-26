import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { teachingToolNames, teachingToolsAreSaves } from "./teacher-tools.ts"

describe("teachingToolsAreSaves", () => {
  it("allows only the four save tools", () => {
    assert.deepEqual(teachingToolNames, ["save_question", "save_link_material", "prepare_pdf", "save_exam_marks"])
    assert.equal(teachingToolsAreSaves(teachingToolNames), true)
    assert.equal(teachingToolsAreSaves(["save_question", "list"]), false)
    assert.equal(teachingToolsAreSaves(["get"]), false)
  })
})

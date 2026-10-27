import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { citedSkillsAllowed, driveOverlap, isHighChance, joinPlacementMatches, limitSkills, rankSkillMatches } from "./placement-match.ts"

const javaSql = { id: "drive-a", companyName: "Acorn", roleTitle: "Engineer", requiredSkills: ["java", "sql"] }
const javaOnly = { id: "drive-b", companyName: "Birch", roleTitle: "Engineer", requiredSkills: ["java"] }
const python = { id: "drive-c", companyName: "Cedar", roleTitle: "Engineer", requiredSkills: ["python"] }
const goOnly = { id: "drive-d", companyName: "Dale", roleTitle: "Engineer", requiredSkills: ["go"] }

describe("rankSkillMatches", () => {
  it("ranks a two-skill match above a one-skill match and drops a drive with no shared skill", () => {
    const ranked = rankSkillMatches(["java", "sql"], [javaOnly, python, javaSql])
    assert.deepEqual(
      ranked.map((drive) => drive.id),
      ["drive-a", "drive-b"],
    )
    assert.deepEqual(ranked[0]?.shared, ["java", "sql"])
    assert.deepEqual(ranked[0]?.missing, [])
    assert.deepEqual(ranked[1]?.missing, [])
  })
})

describe("citedSkillsAllowed", () => {
  it("rejects a cited skill that is not in the two lists", () => {
    assert.equal(citedSkillsAllowed(["python"], ["java"], ["sql"]), false)
    assert.equal(citedSkillsAllowed(["java"], ["java"], ["sql"]), true)
  })
})

describe("limitSkills", () => {
  it("lowercases, drops blanks and long skills, and keeps at most 40", () => {
    const long = "x".repeat(41)
    const many = Array.from({ length: 41 }, (_, index) => `skill${index}`)
    assert.deepEqual(limitSkills([" Java ", "", "java", long]), ["java"])
    assert.equal(limitSkills(many).length, 40)
  })
})

describe("driveOverlap", () => {
  it("rounds shared required skills into a percentage and treats an empty requirement as zero", () => {
    assert.deepEqual(driveOverlap(["Java", "sql"], ["java", "sql", "python"]), {
      shared: ["java", "sql"],
      missing: ["python"],
      overlapPercent: 67,
    })
    assert.deepEqual(driveOverlap(["java"], []), {
      shared: [],
      missing: [],
      overlapPercent: 0,
    })
  })
})

describe("isHighChance", () => {
  it("is true only at a fit score of 70 or above", () => {
    assert.equal(isHighChance(70), true)
    assert.equal(isHighChance(69), false)
    assert.equal(isHighChance(null), false)
  })
})

describe("joinPlacementMatches", () => {
  it("keeps overlap and drops the model fields when a cited skill is not allowed", () => {
    const joined = joinPlacementMatches(
      ["java"],
      [javaSql],
      [{ driveId: "drive-a", modelScore: 88, reason: "Invented python.", citedSkills: ["python"] }],
    )
    assert.equal(joined.length, 1)
    assert.equal(joined[0]?.overlapPercent, 50)
    assert.equal(joined[0]?.modelScore, null)
    assert.equal(joined[0]?.highChance, false)
    assert.equal(joined[0]?.reason, null)
  })

  it("shows a drive with no shared skill when the fit score is at least 40 and sorts high chance first", () => {
    const joined = joinPlacementMatches(
      ["java", "sql"],
      [python, javaOnly, javaSql, goOnly],
      [
        { driveId: "drive-c", modelScore: 40, reason: "Resume names this stack.", citedSkills: ["python"] },
        { driveId: "drive-d", modelScore: 39, reason: "Too weak.", citedSkills: ["go"] },
        { driveId: "drive-b", modelScore: 55, reason: "Java is listed.", citedSkills: ["java"] },
        { driveId: "drive-a", modelScore: 70, reason: "Both required skills are listed.", citedSkills: ["java", "sql"] },
        { driveId: "missing", modelScore: 99, reason: "Unknown drive.", citedSkills: ["java"] },
      ],
    )
    assert.deepEqual(
      joined.map((drive) => drive.id),
      ["drive-a", "drive-b", "drive-c"],
    )
    assert.equal(joined[0]?.highChance, true)
    assert.equal(joined[0]?.modelScore, 70)
    assert.equal(joined[0]?.reason, "Both required skills are listed.")
    assert.equal(joined[2]?.overlapPercent, 0)
    assert.equal(joined[2]?.highChance, false)
  })

  it("returns only shared-skill drives when the match agent returns nothing", () => {
    const joined = joinPlacementMatches(["java"], [python, javaOnly], null)
    assert.deepEqual(
      joined.map((drive) => [drive.id, drive.modelScore, drive.reason]),
      [["drive-b", null, null]],
    )
  })
})

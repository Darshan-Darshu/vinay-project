import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  actionSavers,
  adminVisibleReply,
  admissionDraft,
  admissionStatusRequest,
  applyAdmissionEdits,
  createReply,
  adminActions,
  claimDecision,
  commitProposal,
  isReadOrPropose,
  parentSpecialistTools,
  prepareProposal,
  runConfirmedProposal,
  specialistToolNames,
  takeSpecialistSlot,
  specialistMissedTools,
  takeToolSlot,
  type ProposalLookup,
} from "./admin-harness.ts"
import { admissionFormWidget, admissionListWidget, parseChatWidgets, publicProposalFields } from "./chat-widgets.ts"

const lookup: ProposalLookup = {
  async find(kind) {
    if (kind === "teacherEmail" || kind === "department" || kind === "admission") return null
    return null
  },
}

describe("admin tool allowlists", () => {
  it("gives the parent the nine specialists and keeps writes off specialist tools", () => {
    assert.equal(parentSpecialistTools.length, 9)
    assert.equal(new Set(parentSpecialistTools).size, 9)
    const names = Object.values(specialistToolNames).flat()
    assert.equal(names.every((name) => isReadOrPropose(name)), true)
    assert.equal(names.some((name) => name.includes("save") || name.includes("delete")), false)
    assert.deepEqual(Object.keys(actionSavers).sort(), [...adminActions].sort())
    assert.equal(Object.values(actionSavers).some((name) => name.toLowerCase().includes("delete")), false)
  })
})

describe("prepareProposal", () => {
  it("inserts nothing when the proposal is invalid", async () => {
    const prepared = await prepareProposal("department.create", { name: "", code: "CS" }, lookup)
    let inserts = 0
    const result = await commitProposal(prepared, async () => {
      inserts += 1
      return "11111111-1111-4111-8111-111111111111"
    })
    assert.equal(result.inserted, false)
    assert.equal(inserts, 0)
  })

  it("leaves the password out of a teacher-create summary", async () => {
    const prepared = await prepareProposal(
      "teacher.create",
      {
        fullName: "Ada Lovelace",
        email: "ada@college.edu",
        password: "s3cret-pass",
        employeeCode: "E1",
        designation: "Lecturer",
      },
      lookup,
    )
    assert.equal(prepared.ok, true)
    if (!prepared.ok) return
    assert.equal(prepared.summary.includes("s3cret-pass"), false)
    assert.equal(prepared.summary.includes("password"), true)
    assert.equal(prepared.payload.password, "s3cret-pass")
  })
})

describe("claimDecision", () => {
  const now = new Date("2026-10-23T12:00:00.000Z")
  const later = "2026-10-23T12:15:00.000Z"
  const earlier = "2026-10-23T11:00:00.000Z"

  it("refuses another user, an expired row, and a consumed row", () => {
    assert.equal(claimDecision(null, "admin", now), "missing")
    assert.equal(claimDecision({ profileId: "other", expiresAt: later, consumedAt: null }, "admin", now), "foreign")
    assert.equal(claimDecision({ profileId: "admin", expiresAt: earlier, consumedAt: null }, "admin", now), "expired")
    assert.equal(claimDecision({ profileId: "admin", expiresAt: later, consumedAt: earlier }, "admin", now), "consumed")
    assert.equal(claimDecision({ profileId: "admin", expiresAt: later, consumedAt: null }, "admin", now), "ok")
  })
})

describe("runConfirmedProposal", () => {
  it("saves once, releases a failed save, and does not save a consumed proposal", async () => {
    let saves = 0
    let releases = 0
    let strips = 0
    const saved = await runConfirmedProposal(
      { action: "department.create", payload: { code: "CS" } },
      {
        save: async () => {
          saves += 1
          return { error: null }
        },
        readBack: async () => "Department Computer Science (CS) is active.",
        release: async () => {
          releases += 1
        },
        strip: async () => {
          strips += 1
        },
      },
    )
    assert.equal(saved.error, null)
    assert.equal(saved.verified, "Department Computer Science (CS) is active.")
    assert.equal(saves, 1)
    assert.equal(strips, 1)
    assert.equal(releases, 0)

    const failed = await runConfirmedProposal(
      { action: "department.create", payload: { code: "CS" } },
      {
        save: async () => ({ error: "That department code is already in use." }),
        readBack: async () => "should not be read",
        release: async () => {
          releases += 1
        },
        strip: async () => {
          strips += 1
        },
      },
    )
    assert.equal(failed.error, "That department code is already in use.")
    assert.equal(releases, 1)
    assert.equal(strips, 1)

    const unverified = await runConfirmedProposal(
      { action: "department.create", payload: { code: "CS" } },
      {
        save: async () => ({ error: null }),
        readBack: async () => null,
        release: async () => {
          releases += 1
        },
        strip: async () => {
          strips += 1
        },
      },
    )
    assert.equal(unverified.verified, null)
    assert.equal(releases, 1)

    const second = claimDecision(
      { profileId: "admin", expiresAt: "2026-10-23T12:15:00.000Z", consumedAt: "2026-10-23T12:01:00.000Z" },
      "admin",
      new Date("2026-10-23T12:02:00.000Z"),
    )
    assert.equal(second, "consumed")
  })
})

describe("step caps", () => {
  it("stops before a fifth specialist call and a sixth tool call", () => {
    let specialists = 0
    for (let turn = 0; turn < 4; turn += 1) {
      const slot = takeSpecialistSlot(specialists)
      assert.equal(slot.allowed, true)
      specialists = slot.next
    }
    assert.equal(takeSpecialistSlot(specialists).allowed, false)

    let tools = 0
    for (let turn = 0; turn < 5; turn += 1) {
      const slot = takeToolSlot(tools)
      assert.equal(slot.allowed, true)
      tools = slot.next
    }
    assert.equal(takeToolSlot(tools).allowed, false)
    assert.equal(specialistMissedTools(0), true)
    assert.equal(specialistMissedTools(1), false)
  })
})

const dev = {
  id: "a6000000-0000-4000-8000-000000000005",
  fullName: "Dev Patel",
  email: "dev.patel@example.net",
  status: "rejected",
}

describe("admission status replies", () => {
  it("keeps the stored status when the model claims an update", () => {
    const request = admissionStatusRequest("Set the admission status for Dev Patel to completed")
    assert.deepEqual(request, { name: "Dev Patel", email: "", status: "completed" })
    assert.equal(admissionStatusRequest("Show the admission list"), null)
    const followed = admissionStatusRequest("cahnghe his status to approved", [
      { content: "Dev Patel is rejected in ECE." },
    ])
    assert.deepEqual(followed, { name: "Dev Patel", email: "", status: "approved" })
    assert.deepEqual(admissionStatusRequest("to approved", [{ content: "Change Dev Patel's status." }]), {
      name: "Dev Patel",
      email: "",
      status: "approved",
    })
    const payload = '{"total":1,"rows":[{"fullName":"Dev Patel","status":"rejected","departmentCode":"ECE","courseCode":"BT-ECE"}]}'
    const reply = adminVisibleReply(
      [payload],
      'The admission status for Dev Patel has been updated to "completed".',
    )
    assert.equal(reply, "- Dev Patel · rejected · ECE · BT-ECE")
    const listed = admissionListWidget(payload)
    assert.ok(listed)
    const visual = adminVisibleReply([payload], 'The admission status for Dev Patel has been updated to "completed".', listed ? [listed] : [])
    assert.equal(visual.includes("Dev Patel ·"), false)
    assert.match(visual, /Nothing was saved/)
    assert.equal(adminVisibleReply([payload], "Here are the applied admissions.", listed ? [listed] : []), "Here are the applied admissions.")
    const draft = admissionDraft("Create admission for Meera Shah, meera@example.com, +91 98450 22001, department ECE, course BT-ECE")
    assert.equal(draft?.ready, true)
    assert.match(createReply("create a department") ?? "", /confirm card/i)
  })

  it("refuses a completed status and stages the allowed next status", async () => {
    const devLookup: ProposalLookup = { async find() { return dev } }
    const refused = await prepareProposal("admission.status", { id: dev.id, status: "completed" }, devLookup)
    assert.equal(refused.ok, false)
    if (!refused.ok) assert.match(refused.error, /Nothing was changed/)
    const staged = await prepareProposal("admission.status", { id: dev.id, status: "under review" }, devLookup)
    assert.equal(staged.ok, true)
    if (staged.ok) assert.equal(staged.payload.status, "under_review")
  })
})

const departmentId = "a6000000-0000-4000-8000-000000000001"
const courseId = "a6000000-0000-4000-8000-000000000002"

describe("admission chat widgets", () => {
  const stored = {
    id: dev.id,
    fullName: "Dev Patel",
    email: "dev.patel@example.net",
    phone: "",
    departmentId,
    courseId,
    semesterId: "",
    notes: "",
  }

  it("keeps a list widget out of the bullet reply and a form free of the password", () => {
    const fields = publicProposalFields({ id: dev.id, rollNumber: "R1", password: "s3cret-pass" })
    const widget = admissionFormWidget({
      id: "11111111-1111-4111-8111-111111111111",
      specialist: "admissions",
      summary: "Enroll Dev Patel as roll R1. A password is included.",
      action: "admission.enroll",
      fields,
    })
    assert.ok(widget && widget.kind === "form")
    assert.equal(JSON.stringify(widget).includes("s3cret-pass"), false)
    const parsed = parseChatWidgets([{
      kind: "form",
      specialist: "admissions",
      proposalId: "11111111-1111-4111-8111-111111111111",
      mode: "enroll",
      summary: "Enroll Dev Patel as roll R1.",
      fields: { ...fields, password: "s3cret-pass" },
    }])
    assert.equal(JSON.stringify(parsed).includes("s3cret-pass"), false)
    assert.equal(parsed[0]?.kind === "form" ? parsed[0].fields.rollNumber : "", "R1")
  })

  it("validates edited admission fields and saves that payload once", async () => {
    const invalid = applyAdmissionEdits("admission.update", stored, { ...stored, email: "not-an-email" })
    assert.equal(invalid.ok, false)
    if (!invalid.ok) assert.equal(typeof invalid.fieldErrors.email, "string")

    const edited = applyAdmissionEdits("admission.update", stored, { ...stored, notes: "Waitlist" })
    assert.equal(edited.ok, true)
    if (!edited.ok) return
    assert.equal(edited.payload.notes, "Waitlist")

    const enrolled = applyAdmissionEdits("admission.enroll", { id: dev.id, rollNumber: "R1", password: "s3cret-pass" }, { rollNumber: "R2" })
    assert.equal(enrolled.ok, true)
    if (!enrolled.ok) return
    assert.equal(enrolled.payload.rollNumber, "R2")
    assert.equal(enrolled.payload.password, "s3cret-pass")

    let saves = 0
    const saved = await runConfirmedProposal(
      { action: "admission.update", payload: edited.payload },
      {
        save: async (_action, payload) => {
          saves += 1
          assert.equal(payload.notes, "Waitlist")
          return { error: null }
        },
        readBack: async () => "Application for Dev Patel is applied.",
        release: async () => {},
        strip: async () => {},
      },
    )
    assert.equal(saved.error, null)
    assert.equal(saves, 1)
    assert.equal(claimDecision(
      { profileId: "admin", expiresAt: "2026-10-23T12:15:00.000Z", consumedAt: "2026-10-23T12:01:00.000Z" },
      "admin",
      new Date("2026-10-23T12:02:00.000Z"),
    ), "consumed")
  })
})

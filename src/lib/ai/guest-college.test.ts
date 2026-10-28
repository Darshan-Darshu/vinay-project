import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  admissionFormSignal,
  buildPublicPassages,
  collegeNamespace,
  filterCourses,
  filterSubjects,
  groundReply,
  guestHistory,
  offersApplicationForm,
  passageVectorId,
  readPineconeMatches,
  unpublishedReply,
  shouldOfferAdmissionForm,
  wantsAdmissionForm,
  withoutApplicationCta,
} from "./guest-college.ts";

const courses = [
  {
    name: "BSc Computer Science",
    code: "BSC-CS",
    description: "Programming and systems.",
    durationSemesters: 6,
    departmentName: "Computer Science",
    departmentCode: "CS",
  },
  {
    name: "BA English",
    code: "BA-EN",
    description: "Literature.",
    durationSemesters: 6,
    departmentName: "English",
    departmentCode: "EN",
  },
];

describe("filterCourses", () => {
  it("keeps courses for a department code and returns none for an unknown department", () => {
    assert.deepEqual(
      filterCourses(courses, { department: "cs" }).map((course) => course.code),
      ["BSC-CS"],
    );
    assert.deepEqual(filterCourses(courses, { department: "Physics" }), []);
  });
});

describe("filterSubjects", () => {
  it("returns subjects for one course code", () => {
    const subjects = [
      {
        name: "Algorithms",
        code: "CS201",
        credits: 4,
        semesterNumber: 3,
        courseCode: "BSC-CS",
      },
      {
        name: "Poetry",
        code: "EN101",
        credits: 3,
        semesterNumber: 1,
        courseCode: "BA-EN",
      },
    ];
    assert.deepEqual(
      filterSubjects(subjects, "bsc-cs").map((subject) => subject.code),
      ["CS201"],
    );
  });
});

describe("groundReply", () => {
  it("replaces a reply that had no tool result", () => {
    assert.equal(groundReply("The fee is 50000.", []), unpublishedReply);
  });

  it("drops an email that the tools did not return", () => {
    const grounded = groundReply("Write to secret@example.com for a seat.", [
      '{"email":"office@college.edu"}',
    ]);
    assert.equal(grounded.includes("secret@example.com"), false);
    assert.equal(grounded.includes("office@college.edu"), false);
  });

  it("keeps contact text that a tool returned and removes a status the tool did not", () => {
    const grounded = groundReply(
      "Email office@college.edu. Status: approved.",
      ['{"email":"office@college.edu"}'],
    );
    assert.equal(grounded.includes("office@college.edu"), true);
    assert.equal(grounded.toLowerCase().includes("approved"), false);
  });

  it("removes a quoted passage that Pinecone did not return", () => {
    const grounded = groundReply(
      'The college says "Invented campus tour every Sunday."',
      [
        JSON.stringify({
          matches: [
            {
              title: "About",
              source: "about",
              text: "Families may visit on weekday mornings.",
            },
          ],
        }),
      ],
    );
    assert.equal(grounded.includes("Invented campus tour"), false);
    assert.equal(grounded.includes("weekday mornings"), false);
  });
});

describe("readPineconeMatches", () => {
  it("returns no passages when Pinecone has no matches", () => {
    assert.deepEqual(readPineconeMatches([]), []);
  });

  it("reads title, source, and text from match metadata", () => {
    assert.deepEqual(
      readPineconeMatches([
        {
          metadata: {
            title: "Physics",
            source: "department",
            text: "Lab work.",
          },
        },
      ]),
      [{ title: "Physics", source: "department", text: "Lab work." }],
    );
  });
});

describe("buildPublicPassages", () => {
  it("chunks published narrative and skips blank text", () => {
    const passages = buildPublicPassages({
      settings: {
        name: "North College",
        about: "A riverside campus.",
        admissionsInfo: "",
      },
      departments: [{ id: "d1", name: "Physics", description: "Lab work." }],
      courses: [],
      events: [],
      announcements: [],
    });
    assert.deepEqual(
      passages.map((passage) => passage.source),
      ["about", "department"],
    );
    assert.equal(collegeNamespace("ollama"), "college-ollama");
    assert.equal(passageVectorId("department", "d1", 0), "department:d1:0");
  });

  it("adds an uploaded document as its own passage", () => {
    const passages = buildPublicPassages({
      settings: null,
      departments: [],
      courses: [],
      events: [],
      announcements: [],
      documents: [{ id: "doc-1", title: "Handbook", body: "Visiting hours are weekday mornings." }],
    });
    assert.deepEqual(passages, [
      { source: "document", recordId: "doc-1", title: "Handbook", text: "Visiting hours are weekday mornings." },
    ]);
  });
});

describe("guestHistory", () => {
  it("keeps the last six user and assistant texts", () => {
    const history = guestHistory([
      ...Array.from({ length: 8 }, (_, index) => ({
        role: "user",
        content: `m${index}`,
      })),
      { role: "tool", content: "hidden" },
      { role: "assistant", content: "  " },
    ]);
    assert.deepEqual(
      history.map((message) => message.content),
      ["m2", "m3", "m4", "m5", "m6", "m7"],
    );
  });
});

describe("wantsAdmissionForm", () => {
  it("notices the form signal and ignores other tool text", () => {
    assert.equal(wantsAdmissionForm([admissionFormSignal]), true);
    assert.equal(wantsAdmissionForm(['{"courses":[]}']), false);
  });
});

describe("shouldOfferAdmissionForm", () => {
  it("shows the form for admissions and apply questions", () => {
    assert.equal(shouldOfferAdmissionForm("Tell me about admissions"), true);
    assert.equal(shouldOfferAdmissionForm("How do I apply?"), true);
    assert.equal(shouldOfferAdmissionForm("I want to register for admission"), true);
  });

  it("does not force the form for course-only questions", () => {
    assert.equal(shouldOfferAdmissionForm("List active courses in ECE"), false);
    assert.equal(shouldOfferAdmissionForm("What subjects are in BT-CSE?"), false);
  });
});

describe("application form invitation", () => {
  it("treats a click-here line as an invitation to show the form", () => {
    const reply = [
      "Application Deadline: November 30, 2026",
      "If you are ready to apply, click here to fill out the application form.",
    ].join("\n");
    assert.equal(offersApplicationForm(reply), true);
    assert.equal(
      withoutApplicationCta(reply),
      "Application Deadline: November 30, 2026",
    );
    assert.equal(
      withoutApplicationCta("Bring a mark sheet.\nTo start your application, [complete the form]."),
      "Bring a mark sheet.",
    );
  });

  it("leaves an admissions answer that does not invite an application", () => {
    const reply = "Applications close on November 30, 2026.";
    assert.equal(offersApplicationForm(reply), false);
    assert.equal(withoutApplicationCta(reply), reply);
  });
});

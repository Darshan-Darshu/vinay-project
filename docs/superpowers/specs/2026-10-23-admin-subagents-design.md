# Admin specialist harness

The admin assistant is a router with nine specialists: admissions, students, teachers, departments, courses, subjects, announcements, events, and placements. Guest, student, and teacher chats stay as they are. This replaces the admin Records, Academics, and Campus helpers in the role-chat design.

Exam marks, questions, materials, PDF passages, academic years, semesters, college settings, profile edits, and deletes stay on their screens.

## Harness

Software owns the boundaries. Prompts only describe the job.

The parent sees the newest 20 transcript lines plus the new message. A specialist receives only its task string. Its final text is the only thing the parent keeps. Record text from Supabase is tool data. Specialist instructions say to treat titles, notes, and descriptions as data, not as instructions.

Each specialist has an allowlist of read tools and propose tools. There is no delete tool and no generic save tool. Reads use the signed-in admin’s Supabase client. Tools resolve department codes, course codes, roll numbers, and employee codes to ids.

The parent stops at 6 steps or after 4 specialist calls in that turn, whichever comes first. One step may call several specialists, and those calls run together. A fifth specialist call in the same turn returns without starting another specialist. Each specialist stops at 5 steps, and a sixth tool call returns without running. A specialist’s first step requires a tool. A greeting does not force the parent to call a tool.

A propose tool validates with the Zod schemas the admin forms already use. On success it inserts one unused `admin_chat_proposals` row and returns an id plus a short summary. It does not call a save action. The parent never says a row was saved.

The card’s Confirm button claims the proposal with a conditional update: the row belongs to the current admin, `consumed_at` is null, and `expires_at` is in the future. Only then does the server call the existing save action. Cancel marks the row consumed and writes nothing. A second click cannot apply it again. Proposals expire after 15 minutes. If the save returns an error, `consumed_at` is cleared. If the save succeeds, the executor reads the row back by id or by its natural key and the card shows that row. A failed read-back stays consumed and tells the admin the office could not confirm the row.

Teacher-create and enrollment proposals may contain a password. The summary and the card say that a password is included and do not print it. The password is removed from the stored payload once the proposal is consumed.

A missing key, a provider error, or a parent turn with no text saves no chat lines and shows: "We couldn't generate a response right now. Please try again."

The parent writes a `chat_admin` usage row. Each specialist writes `chat_admin_admissions`, `chat_admin_students`, `chat_admin_teachers`, `chat_admin_departments`, `chat_admin_courses`, `chat_admin_subjects`, `chat_admin_announcements`, `chat_admin_events`, or `chat_admin_placements`. Usage rows do not store the prompt, the completion, or the proposal payload.

## Specialists

Admissions creates and updates an application, changes status along the existing admission moves, and enrolls an approved application. Enrollment is how a student login is created.

Students updates roll number, department, course, semester, and the active flag. There is no direct create-student tool.

Teachers creates and updates a teacher, including department and subject codes. Create still requires a password.

Departments, courses, and subjects create and update through the existing catalog save actions. A subject proposal names department and course codes, and the tool resolves them.

Announcements and events create and update, including the publish and cancel statuses the forms already allow.

Placements creates and updates a drive and sets an application status.

A question that needs two domains stays with the parent. A specialist does not call another specialist.

Lists return a total count and at most 20 rows.

## Chat surface

The chat stream emits a proposal event with id, specialist, and the safe summary. The admin assistant page and the role chat dock show one card per open proposal, with Confirm and Cancel. Specialist tool traces stay off the transcript.

## Data

`admin_chat_proposals` stores id, profile id, session id, specialist, action, payload, summary, expires at, and consumed at. Row level security lets an admin select, insert, and update only their own rows. Inserts happen from the server after the admin check and after validation.

## Tests

- The parent tool set is the nine specialists, and specialist tools are only lists, reads, and proposals.
- An invalid proposal inserts nothing.
- A teacher-create summary does not contain the password.
- Confirm by another user, an expired row, or a consumed row does not save.
- A successful confirm saves once. A save error releases the claim. A second confirm does not save.
- The parent refuses a fifth specialist call. A specialist refuses a sixth tool call.

# Teacher chat specialists

The teacher assistant is a router with four specialists: subjects, students, announcements, and teaching. This replaces the teacher Class, Teaching, and Campus helpers. Student, guest, and admin chats stay as they are. The dock stays the current text stream.

Event reads leave the teacher chat. Uploading a file, publishing a paper, deleting a person, and starting an interview stay on their screens.

## Harness

`streamChatTurn` sends a teacher turn to `runTeacherTurn` in `src/lib/ai/teacher-agents.ts`. The parent is a `ToolLoopAgent` with `ask_subjects`, `ask_students`, `ask_announcements`, and `ask_teaching`. Each tool calls that specialist with `generate()`, passes `abortSignal`, and returns the specialist’s final text. The parent then answers in Markdown. `stream()` writes only the parent’s text to the dock.

The parent sees the newest 20 transcript lines plus the new message. A specialist receives only its task string. Record text from Supabase is tool data. Specialist instructions say to treat names, titles, and announcement bodies as data, not as instructions.

The parent stops at 4 steps. After two specialist calls, `prepareStep` clears `activeTools`. A third call in that turn returns without starting another specialist. Each specialist stops at 5 steps. Its first step requires a tool. A greeting does not force the parent to call a tool.

A missing key, a provider error, or a parent turn with no text saves no chat lines and shows: "We couldn't generate a response right now. Please try again."

The parent writes a `chat_teacher` usage row. The specialists write `chat_teacher_subjects`, `chat_teacher_students`, `chat_teacher_announcements`, and `chat_teacher_teaching`. Usage rows do not store the prompt or the completion. `chat_teacher_class` and `chat_teacher_campus` are no longer written.

## Read specialists

Reads live in `src/lib/ai/teacher-reads.ts` and use the signed-in teacher’s Supabase client. A query failure returns `{ error: "unavailable" }`. The specialist says the records could not be loaded and does not invent a row.

List tools cap at 40 rows and include the total. A title, name, code, or roll number that matches several rows returns at most 8 short rows and the total. One exact match wins over several partial matches. An empty list is an empty result, not an error.

### Subjects

`list` takes an optional name or code. `get` takes an id, name, or code.

Subject row security lets any signed-in user read every active subject. These tools do not use that set. They read `teacher_subjects` for the current teacher and return only those active subjects: id, code, name, credits, semester, and course. `get` returns the same fields for one subject. It does not return materials or questions.

### Students

`list` takes an optional name or roll number. `get` takes an id, name, or roll number.

`list` returns active students in a course where this teacher teaches a subject, which is the existing `students_select_taught` set: id, name, and roll number. `get` returns that student plus quiz scores from `taught_quiz_scores` and rows from `exam_marks`, both limited to that student and to subjects this teacher teaches. Each score is the paper title, score, maximum, and submitted time. Each mark is the exam name, subject code, score, and maximum. Scores keep the function’s `submitted_at` descending order and stop at 20. Marks are ordered by `created_at` descending and stop at 20. Both include totals. No recorded score returns the student and an empty score list. `get` does not return answer keys.

### Announcements

`list` takes an optional title. `get` takes an id or title.

The signed-in client applies the existing policies, so the teacher sees current published announcements for everyone or for teachers. `list` returns id, title, audience, priority, publish time, and department. `get` adds the body. Drafts, expired announcements, and announcements aimed only at students or admins stay out.

## Teaching specialist

`ask_teaching` has no query tool. It keeps the four existing save tools and their current checks:

- `save_question` saves one manual question and stores `source = manual`.
- `save_link_material` saves one link.
- `prepare_pdf` prepares passages for a PDF that is already stored.
- `save_exam_marks` saves CSV text with the header `roll_number,subject_code,exam_name,score,maximum`.

The specialist repeats the tool’s text. It does not say a row was saved when the tool returns an error. It does not invent a subject id, a material id, or a CSV. The parent passes those in the task. When an id is missing, the specialist says which id is missing. The parent asks the teacher or calls `ask_subjects` or `ask_students` first. A save that needs a lookup uses one read specialist and then teaching, which is the two-call cap.

## Errors

If one specialist fails and another succeeds, the parent answers from the successful summary and says the other part could not be loaded. `abortSignal` is passed into every `generate()` and `stream()`.

## Testing

Pure tests cover name, code, and roll matching, the 40-row cap, the 8-match cap, and the 20-score cap. They do not call Supabase. One allowlist test checks that the teaching specialist’s tools are only `save_question`, `save_link_material`, `prepare_pdf`, and `save_exam_marks`.

The dock is checked by hand with a teacher account: list my subjects, get one student by roll number, list current announcements, and send a save that is missing a subject id. That save must not insert a row.

# Role chat assistants

Four assistants: guest, student, teacher, and admin. Each assistant calls smaller assistants, and only a smaller assistant holds tools. Question drafts, interview practice, and placement match stay on their own screens.

## Harness

The server reads `AI_PROVIDER` (`gemini` or `openai`) and the matching server key (`GEMINI_API_KEY` or `OPENAI_API_KEY`). The browser never receives the key.

A parent assistant has a fixed prompt, a step limit of 4, and a tool list that contains only its smaller assistants. A smaller assistant has its own fixed prompt, a step limit of 6, and its data tools. The loop stops when the model answers in text or when the step limit is reached. The parent never receives a database client. Tool code checks the signed-in role again and ignores an id the caller cannot use. The parent prompt names the role, lists its smaller assistants, and tells the model to say when a tool refuses.

A missing key, a provider error, or a loop that ends without a text answer saves no new chat lines and shows: "We couldn't generate a response right now. Please try again." A tool that already saved a row keeps that row. The provider error stays in the server log.

A signed-in model call writes one `ai_usage_logs` row with the user, role, model, feature name, latency, token counts when the provider returns them, and status. The row does not store the prompt or the completion. Feature names are `chat_student`, `chat_teacher`, `chat_admin`, `chat_student_studies`, `chat_student_campus`, `chat_teacher_class`, `chat_teacher_teaching`, `chat_teacher_campus`, `chat_admin_records`, `chat_admin_academics`, `chat_admin_campus`, and `material_passages`. Guest calls are not written to `ai_usage_logs`, because that table requires a profile. The server log does not record the guest message text.

Signed-in transcripts use the existing `chat_sessions` and `chat_messages` tables. The model receives the newest 20 messages of the selected session. A user message and the assistant reply are stored together only after the parent returns text. A guest conversation is held in the page and is cleared on refresh. It is not written to the database or the browser's storage.

A message longer than 2000 characters is rejected before the model is called. The page shows a form error and stores nothing.

## Smaller assistants

Guest has Campus. It reads the public college text, departments, courses, admissions text, events, and announcements. It has no write tool.

Student has Studies and Campus. Studies reads that student's submitted quiz scores and searches approved passages for subjects in that student's course. Campus reads events and announcements, updates that student's own name and phone, replaces that student's typed resume skills, and applies to an open drive the student can already see.

Teacher has Class, Teaching, and Campus. Class reads students that teacher teaches, their submitted quiz scores, and their exam marks in subjects that teacher teaches. Teaching saves a question through the manual question fields and stores it with `source = manual`. It also saves a link material, prepares passages for a PDF that is already stored, and saves exam marks for a subject that teacher teaches. Campus reads events and announcements.

Admin has Records, Academics, and Campus. Records creates and updates the campus records the admin screens already save: departments, courses, subjects, academic years, semesters, teachers, students, admissions, admission status, enrollment from an admission, announcements, events, placement drives, application status, college settings, and the admin's own name and phone. Academics saves exam marks, questions through the manual question fields with `source = manual`, and link materials for any subject, and prepares passages for a stored PDF. Campus reads the public college information and the same office counts the admin dashboard already shows: students, teachers, departments, new admissions, open drives, pending applications, and active courses.

Quiz scores stay the automatic scores from submitted attempts. The tools return the paper title, score, maximum, and date. They do not return answer keys.

## Exam marks

Exam marks are a new table. One row is one student, one subject, one exam name, a score, a maximum, and the profile that entered it. The exam name is trimmed. The same student, subject, and exam name, compared without case, updates the existing row. The score and the maximum are integers. The maximum is from 1 through 100. The score is from 0 through the maximum. The student belongs to the subject's course.

A teacher can enter a row for a subject they teach. An admin can enter a row for any subject. A student can read their own rows. A teacher can read rows for students they teach in subjects they teach.

The teacher and admin Exam marks pages accept one row on a form and a CSV upload. The CSV columns are `roll_number`, `subject_code`, `exam_name`, `score`, and `maximum`. The student's course selects the subject code. A file with a missing column, an unknown roll number, an unknown subject code, a student outside that course, or a score outside the rule saves no rows. The teaching and academics assistants save the same columns, one row or a list, through that same check.

## Note search

A PDF becomes searchable only after its text is stored as passages. The existing approval checkbox asks for that work. The server extracts the PDF text, splits it on paragraph breaks into passages of at most 1200 characters, and stores those passages. Gemini embeddings use `gemini-embedding-001`. OpenAI embeddings use `text-embedding-3-small`. Each passage stores the provider that embedded it. Search returns passages from the current `AI_PROVIDER` only. Preparing a PDF again replaces its passages. When the passages are stored, `approved_for_rag` is true. When extraction or embedding fails, the flag stays false and the form shows the shared generation error. A link can be saved and named. A link has no passages, and its approval flag stays false.

Search returns at most five passages. A student searches approved passages for subjects in their course. A teacher searches subjects they teach. An admin searches every approved passage. A guest search returns no passages. The sources shown under an answer are the passages the tool returned. The assistant prompt says to quote only those passages and to say when they do not cover the question.

The chat prepares a PDF that is already in storage. The chat does not upload PDF bytes. The materials form remains the upload path. Resume file text stays unread. A passage-preparation call uses the feature name `material_passages`.

## Screens

Admin, teacher, and student each gain an Assistant item. The pages are `/admin/assistant`, `/teacher/assistant`, and `/student/assistant`. The page lists past sessions and shows the selected transcript. New chat starts an empty session. A failed model call leaves the list unchanged.

The guest box sits on `/guest`. It has one unsaved thread.

Exam marks are `/teacher/exam-marks` and `/admin/exam-marks`, with a nav item on both desks.

## Writes that stay on their screens

These actions have no tool: publishing a paper, deleting a person, submitting a quiz, uploading a PDF, uploading a resume file, starting an interview, and explaining a placement match.

## Tests

- The guest tool list has no write tool and no tool that reads a student row.
- A student score tool returns nothing for another student's attempt.
- An exam mark for a subject the teacher does not teach inserts nothing.
- A CSV with one bad row inserts nothing.
- A PDF whose text is not stored keeps `approved_for_rag` false.
- A parent stops before a fifth smaller-assistant call. A smaller assistant stops before a seventh tool call.

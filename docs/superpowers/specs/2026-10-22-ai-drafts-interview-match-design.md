# AI drafts, interview practice, and placement match

Three model features. No portal chatbot, no tools, no subagents, and no search over uploaded notes.

## Shared model

The server reads `AI_PROVIDER` (`gemini` or `openai`) and the matching server key (`GEMINI_API_KEY` or `OPENAI_API_KEY`). The browser never receives the key. Each feature calls the Vercel AI SDK for JSON, validates that JSON, then saves. A missing key, a provider error, or JSON that fails validation saves nothing and shows: "We couldn't generate a response right now. Please try again." The provider error stays in the server log.

Each model call writes one `ai_usage_logs` row with the signed-in user, role, model, feature name, latency, token counts when the provider returns them, and status. The row does not store the prompt or the completion. Feature names are `question_drafts`, `interview_turn`, `interview_feedback`, and `placement_reason`.

## Question drafts

A teacher generates questions for a subject they teach. An admin may choose any subject. The form has a subject, a topic, a count from 1 to 10, and a difficulty of easy, medium, or hard. The model returns that many questions. Each question is multiple choice or true/false, has one correct option, marks from 1 to 100, a stem, and an explanation.

The server inserts the whole batch or nothing. Each saved row uses the existing question bank and is stored with `source = ai`. The browser cannot choose that source. Generated questions are not attached to a paper and are not published. The existing edit and delete actions still apply. A question on a published paper stays frozen.

The form sits above the manual question form on the current Questions page. Saved drafts appear in that list, labeled as AI drafts. There is no new nav item.

## Interview practice

A student practices on `/student/interview`, a new nav item. This is not the portal chatbot.

A session belongs to one student. It stores an optional placement drive, a role title, status (`in_progress` or `completed`), how many main questions have been asked (0 to 5), whether a follow-up is waiting for an answer, a score from 0 to 100, and written feedback. Turns store the question, the follow-up, and the answer in order. Only that student can read the session.

The student starts from an open drive they can already see, or by typing a role title when they do not pick a drive. A picked drive supplies the role title. One in-progress session is allowed. Finished sessions stay listed with the role, score, and date.

The model is asked for JSON of one kind: a follow-up, the next main question, or the final result. The server accepts only the kind the state allows:

- After an answer to main question 1, 2, 3, or 4, the model may ask one follow-up or move to the next main question.
- After the answer to that follow-up, the model must move to the next main question. A second follow-up is rejected.
- After the answer to main question 5, the model may ask one follow-up or return the result.
- After the answer to the fifth follow-up, the only accepted result is the score and feedback.

A score outside the integers 0 through 100 is rejected like any other invalid result. A rejected response does not insert a turn and does not change the session. The page shows the shared generation error. When the result is accepted, the session is completed and the page shows the score, the feedback, and the read-only transcript.

## Placement match

The existing placements page keeps the list students use to apply. Above it, "Fits your skills" lists open drives the student can already see, ranked by how many of their typed skills appear in the drive's required skills. A drive with no shared skill is left off this section and stays on the normal list. Equal overlaps are ordered by company name.

A student with no typed skills sees an empty state that points to the resume form on their profile. That empty state does not call the model. Resume file text is not read. `extracted_text` stays unused.

Each matched row shows the shared skills and the required skills the student did not list. "Why this fits" asks the model for JSON with a short reason and the skills it cited. The reason is shown and not saved. If any cited skill is outside the union of the two lists, the page shows the shared and missing skills and does not show the sentence. The prompt contains only that student's skills, that drive's required skills, and the role title.

## Tests

- A valid question batch becomes bank rows with `source = ai`. An invalid batch inserts nothing.
- The interview state rejects a second follow-up, and it rejects a score when fewer than five main answers are in. The session is unchanged.
- Overlap ranking places a two-skill match above a one-skill match and drops a drive with no shared skill.
- The explanation check rejects a cited skill that is not in the two lists given to the model.

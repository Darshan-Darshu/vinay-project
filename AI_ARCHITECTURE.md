# AI architecture

Phase 1 does not call a model and does not add provider SDKs. Navigation items named AI Assistant, AI Tutor, and AI Question Generator render a placeholder that names Phase 4.

Keys (`GEMINI_API_KEY`, `OPENAI_API_KEY`, `AI_PROVIDER`) are server environment variables. They are never `NEXT_PUBLIC_` and never sent to the browser.

## Layout (Phase 4)

```text
src/lib/ai/provider.ts          interface + factory from AI_PROVIDER
src/lib/ai/gemini.ts
src/lib/ai/openai.ts
src/lib/ai/prompts/             one module per feature
src/lib/ai/tools/               tool definitions and server executors
src/lib/ai/rag/                 chunk, embed, search
src/services/ai/                orchestration used by route handlers
```

`provider.ts` exposes:

- `generateText({ system, messages, tools })` for chat
- `generateObject({ schema, system, prompt })` for papers, tests, and scores the UI consumes

Both adapters implement that interface. The rest of the app imports the factory, not a vendor SDK. Default provider is whichever `AI_PROVIDER` selects (`gemini` or `openai`). Missing keys return the public error “We couldn't generate a response right now. Please try again.” Logs keep the provider error on the server only.

Prompts state role, objective, allowed context, allowed tools, restrictions, and output shape. Large prompt strings do not live in React components.

Structured features (question papers, mock tests, interview feedback) use schema-validated JSON. Free chat uses text. A paper is saved as `draft`. Nothing AI-generated is published automatically.

## Authorization

```text
User
  → Authentication (getUser)
  → Role from profiles
  → Permission check
  → Tool executor (server)
  → Authorized rows only
  → Model
  → Response
```

The model never opens a database connection. Tool executors ignore client-supplied ids for private records.

| Tool | Who | Id rule |
| --- | --- | --- |
| `get_student_profile` | student, teacher, admin | Student: forced to self. Teacher: student must be in an assigned class. Admin: any. |
| `get_student_marks` | same | same |
| `get_student_attendance` | same | same |
| `get_student_performance` | same | same |
| `get_class_performance` | teacher, admin | Teacher: own class id only |
| `get_admission_statistics` | admin | no student payload |
| `get_college_information` | guest and all roles | public columns only |
| `search_learning_material` | student, teacher, admin | approved chunks; guest gets none |
| `generate_questions` | teacher, admin | no student rows in the prompt |
| `generate_mock_test` | student | caller’s subject enrollment, or public syllabus text |

Guest tools are college information only. If a student asks for another student’s marks, the executor returns an authorization error and the model is not given those rows.

## RAG

```text
Upload (teacher) → extract text → chunk → embed → store
Student question → embed query → vector search (approved chunks) → model
```

The tutor prompt says: prefer the retrieved college passages; if they do not cover the question, say the college-provided material is insufficient. Do not invent a citation.

Embeddings use the same provider abstraction (`embed(text)`). `document_chunks.embedding` uses `pgvector`. Similarity search is a SQL function in `private`, called by the service, not by the model.

## Observability

`ai_usage_logs` records user id, role, model, feature name, latency, and token counts when the provider returns them. It does not store full conversations that contain marks or contact details. Chat history for the tutor lives in `chat_sessions` / `chat_messages` for the signed-in user only.

## Role behavior (prompts)

- **Guest** — admissions, courses, departments, facilities, from public settings and catalog tables.
- **Student** — tutor over approved materials, own marks and performance, mock-test suggestions, study plans.
- **Teacher** — questions, quizzes, lesson plans, assignments, class performance for assigned classes, concept explanations.
- **Admin** — counts and reports from admin tools, college and event information, operational guidance. The admin assistant does not receive raw student answer scripts unless a report tool returns an aggregate.

Performance recommendations are labeled as AI-assisted guidance, not a measured scientific diagnosis.

# Database design

Postgres on Supabase. UUID primary keys. `created_at` and `updated_at` on every application table. Soft delete (`deleted_at`) on people, academic structure, events, and announcements.

Authorization data lives in `public.profiles.role`. Do not read role from `auth.users.raw_user_meta_data`.

Helper functions live in schema `private`, which is not exposed to the Data API:

- `private.current_role()` returns the caller’s role from `profiles`
- `private.is_admin()` is true when that role is `admin`

Both are `security definer` with a fixed `search_path`.

## Phase 1 tables (migration `20261012120000_phase1_foundation.sql`)

### profiles

1:1 with `auth.users`.

| Column | Notes |
| --- | --- |
| id | PK, FK → `auth.users.id` on delete cascade |
| role | `admin` \| `teacher` \| `student` |
| full_name | required |
| email | unique, copied from auth |
| phone | optional |
| avatar_url | optional |
| is_active | default true |
| deleted_at | null means visible |

Users may update their own name, phone, and avatar. They cannot update `role` or `is_active`. Admins can update any profile except they cannot demote the last admin (enforced in the service, Phase 2).

Trigger `on_auth_user_created`: insert a profile. If `raw_app_meta_data.role` is one of the three roles, use it. Otherwise `student`.

### college_settings

Single row (`id` fixed). Columns: `name`, `about`, `address`, `phone`, `email`, `admissions_info`. Public read. Admin update. Guest pages render this row.

### departments

`name` unique, `code` unique, `description`, `is_active`, `deleted_at`.

### academic_years

`name` unique (example `2026-27`), `starts_on`, `ends_on`, `is_current` (partial unique index: only one current year).

### courses

`department_id` FK, `name`, `code` unique, `duration_semesters`, `description`, `is_active`, `deleted_at`.

### semesters

`course_id` FK, `academic_year_id` FK, `number` (1–12), unique `(course_id, academic_year_id, number)`, `is_active`.

### subjects

`department_id` FK, `course_id` FK, `semester_number`, `name`, `code`, unique `(course_id, code)`, `credits`, `is_active`, `deleted_at`.

### students

`profile_id` unique FK → profiles, `department_id`, `course_id`, `semester_id` nullable FKs, `roll_number` unique, `admission_id` nullable (FK added when admissions exist; column is present in Phase 1), `is_active`, `deleted_at`.

### teachers

`profile_id` unique FK → profiles, `department_id` nullable, `employee_code` unique, `designation`, `is_active`, `deleted_at`.

### admissions

`full_name`, `email`, `phone`, `department_id`, `course_id`, `semester_id` nullable, `status` check (`applied`, `under_review`, `approved`, `rejected`, `completed`), `notes`, `student_id` nullable FK set when a student account is created (Phase 2).

### events

`title`, `description`, `event_type` check (`technical`, `sports`, `cultural`, `workshop`, `seminar`, `hackathon`, `fest`, `placement`), `starts_at`, `ends_at`, `venue`, `status` (`draft`, `published`, `cancelled`, `completed`), `is_public`.

### announcements

`title`, `body`, `audience` (`everyone`, `students`, `teachers`, `admins`), `department_id` nullable, `priority` (`low`, `normal`, `high`), `publish_at`, `expires_at`, `author_id` FK → profiles, `status` (`draft`, `published`).

Phase 1 public policy: `status = published`, `audience = everyone`, `publish_at <= now()`, and (`expires_at` is null or `expires_at > now()`). Department-targeted rows are not public.

### activity_logs

`actor_id` nullable FK → profiles, `action`, `entity_type`, `entity_id`, `summary`. Admin dashboard reads the latest rows. Inserts in Phase 1 come from the settings update service.

## Phase 1 access

| Table | anon | student | teacher | admin |
| --- | --- | --- | --- | --- |
| college_settings | select | select | select | select, update |
| departments, courses, subjects, academic_years, semesters | select active / not deleted | select | select | all |
| profiles | none | own row | own row | all |
| students, teachers, admissions | none | none | none | all |
| events | select public published | select public published | select public published | all |
| announcements | select public | select public | select public | all |
| activity_logs | none | none | none | select |

Students do not read the student directory. Teacher assignment tables do not exist yet, so teachers do not read other students. Phase 2 adds `teacher_subjects` and `teacher_classes`, then policies that limit teachers to assigned students.

Events and announcements gain student registration and audience filtering in Phase 5. Phase 1 only lists public rows.

## Later migrations (not created in Phase 1)

### Academic assignments (Phase 2)

- `enrollments` — student, semester, subject, status
- `teacher_subjects` — teacher, subject
- `teacher_classes` — teacher, semester, subject

### Assessment (Phase 3)

- `questions` — subject, topic, type (`mcq`, `true_false`, `short_answer`, `long_answer`, `coding`), difficulty (`easy`, `medium`, `hard`), marks, explanation, `created_by`, `source` (`manual`, `ai`)
- `question_options` — question, label, text, `is_correct`
- `question_papers` — subject, semester, duration, total marks, status (`draft`, `published`), `created_by`. AI output is always inserted as `draft`
- `question_paper_questions`
- `assessments` — paper, class, opens_at, closes_at, status
- `assessment_questions`
- `test_attempts` — student, assessment or mock definition, started_at, submitted_at, score
- `student_answers`
- `results`
- `performance_records` — subject, topic, score, recorded_at

Mock tests a student generates for themselves are `test_attempts` with `kind = mock` and no class assessment. Answers and explanations are stored with the attempt so scoring does not depend on a second model call.

### Learning and RAG (Phase 4)

- `learning_materials` — department, course, semester, subject, unit, topic, kind (`pdf`, `notes`, `document`, `link`, `video`), storage path or URL, `approved_for_rag`
- `documents` — material, extraction status
- `document_chunks` — document, ordinal, content, `embedding vector` via `pgvector`, metadata

Only `approved_for_rag = true` chunks are searchable. If search returns nothing relevant, the tutor says college material is insufficient.

### Placement, campus life (Phase 5)

- `placement_categories` — the ten fixed categories (aptitude through communication)
- `placement_questions`
- `placement_attempts` and answers, or reuse `test_attempts` with `kind = placement` if that stays one code path. Prefer reusing `test_attempts` when the attempt shape matches; do not duplicate scoring tables.
- `interview_sessions` — student, transcript summary, feedback (not full sensitive transcript by default)
- `event_registrations` — event, student, unique pair, status
- `sports` — name
- `sport_events` — sport, title, starts_at (or a `sports` flag on `events` if a separate table is redundant). Phase 5 uses `events` with `event_type = sports` plus `sport_results` (event, team or participant, place, result_text). No extra team-management product.

### AI audit (Phase 4)

- `chat_sessions` — user, role, feature
- `chat_messages` — session, role, content. Retention: tutor and interview transcripts stay only as long as the feature needs them. Do not log secrets.
- `ai_usage_logs` — user_id, role, model, feature, latency_ms, token counts if the provider returns them, created_at. Store a short feature label and status, not the full prompt when it contains marks or personal data.

## Indexes (Phase 1)

- `profiles (role)`, `profiles (email)`
- FKs on courses.department_id, semesters.course_id, semesters.academic_year_id, subjects.course_id, students.department_id, students.course_id, admissions.status, admissions.email
- `events (starts_at)` where status is published
- `announcements (publish_at, expires_at)`
- `activity_logs (created_at desc)`

Partial indexes for `deleted_at is null` on list queries that always exclude deleted rows.

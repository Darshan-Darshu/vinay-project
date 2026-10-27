# Implementation checklist

Phase 1 is the current build. Later phases are specified in `PROJECT_PLAN.md` and are not started.

## Phase 1 — Foundation

- [x] Next.js app, TypeScript, Tailwind, shadcn/ui, light/dark theme
- [x] Folder layout and API response helper
- [x] SQL migration for profiles, college settings, catalog, people, admissions, events, announcements, activity
- [x] Email/password login, no public sign-up UI
- [x] Role redirect and `requireRole` on admin, teacher, and student layouts
- [x] `src/proxy.ts` redirects
- [x] Guest pages for college info, departments, courses, admissions, events
- [x] Admin, teacher, and student dashboards with live empty-or-real data
- [x] Placeholder pages for modules scheduled later
- [x] Admin settings for `college_settings`
- [x] `.env.example`
- [x] `typecheck` and production build

## Phase 2 — People and catalog

- [ ] Admissions workflow and status changes
- [ ] Create a student auth user when an application is completed
- [ ] Student and teacher CRUD, search, filters, activate/deactivate
- [ ] Departments, courses, subjects, academic years, semesters
- [ ] `enrollments`, `teacher_subjects`, `teacher_classes`
- [ ] RLS so teachers only read assigned students

## Phase 3 — Assessment

- [ ] Question bank with search and filters
- [ ] Question papers, review, edit, draft, publish, print
- [ ] Assessments, attempts, timer, mark for review, scoring
- [ ] Student results and performance page (real aggregates)

## Phase 4 — AI

- [ ] Provider interface, Gemini and OpenAI adapters, server-only keys
- [ ] Prompt modules and authorized tools
- [ ] Question paper JSON generator (draft only)
- [ ] Mock test generator
- [ ] Tutor with RAG over approved materials
- [ ] Role-specific chatbot
- [ ] `ai_usage_logs`

## Phase 5 — Campus

- [ ] Placement practice, scores, weak areas, interview simulator
- [ ] Event create, detail, registration, participants
- [ ] Lightweight sports results
- [ ] Announcements with audience, department, priority, and dates

## Phase 6 — Release

- [ ] Automated tests for permissions and scoring
- [ ] Security pass on RLS and service-role usage
- [ ] Loading, empty, and error states on every shipped screen
- [ ] Deployment and environment documentation

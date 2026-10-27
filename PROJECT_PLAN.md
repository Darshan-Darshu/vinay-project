# AI College Management & Learning System

Single-college platform. “SaaS-style” describes the product UI (roles, dashboards, consistent API, settings), not multi-tenant hosting of many colleges.

## Stack

- Next.js App Router (current stable), TypeScript strict, React, Tailwind CSS, shadcn/ui, Lucide, `next-themes`
- Supabase Auth (email/password), Postgres, Storage (storage buckets arrive with learning materials)
- Server-only AI providers behind `lib/ai` (Phase 4): Gemini and OpenAI
- Route protection: `src/proxy.ts` plus `requireRole` in server layouts and API handlers

Business logic lives in `services/`. UI components render data they are given. Database access goes through Supabase clients in `lib/supabase`, called from services.

A later NestJS service can take `services/`, `lib/permissions`, and `lib/ai` without rewriting pages.

## Roles

| Actor | Identity | Home |
| --- | --- | --- |
| Guest | No session | `/` and `/guest` |
| Admin | `profiles.role = admin` | `/admin` |
| Teacher | `profiles.role = teacher` | `/teacher` |
| Student | `profiles.role = student` | `/student` |

Guests are not a database role. There is no public registration page. Create users in Supabase Auth, then set `profiles.role` (see `SECURITY.md`).

## Request path

```text
Browser
  → proxy.ts (redirect only)
  → server layout or route handler
  → getUser()
  → profiles.role
  → permission check
  → service
  → Supabase with the user JWT (RLS)
```

AI tools, when they exist, receive only data the service already authorized. The model does not choose record ids for private data.

## API envelope

```json
{ "success": true, "data": {}, "error": null }
```

```json
{
  "success": false,
  "data": null,
  "error": { "code": "UNAUTHORIZED", "message": "You do not have permission to access this resource." }
}
```

Phase 1 ships the helper and `GET /api/me`. Resource APIs start in Phase 2.

## Phase 1 (this implementation)

- Project setup, theme, app shell
- Email/password login, role redirect, server-side role checks
- Foundation SQL migration (you run it in the Supabase SQL editor)
- Guest college pages from public tables
- Admin, teacher, and student dashboards with live queries
- Navigation for later modules as labeled placeholders (no fake records)
- Admin settings for the single `college_settings` row

Charts are deferred until assessments produce a real time series. Phase 1 dashboards use counts, lists, empty states, and skeletons.

## Later phases

**Phase 2.** Admissions workflow, student and teacher CRUD, departments, courses, subjects, academic years, semesters. Approving an admission can create an auth user via the service-role client.

**Phase 3.** Question bank, question papers, assessments, mock tests, results, performance analytics.

**Phase 4.** AI chatbot, question generator, mock-test generator, tutor, RAG over approved materials. Generated papers stay drafts until a teacher publishes them.

**Phase 5.** Placement preparation, events registration, sports, announcements targeting.

**Phase 6.** Tests, security review, performance, error-handling pass, AI evaluation, deployment.

## Folder map

```text
src/app/(auth)          login
src/app/(public)        guest college site
src/app/admin|teacher|student
src/app/api             route handlers
src/components/ui       shadcn
src/components/layout   shell
src/components/dashboard
src/lib/auth            session and requireRole
src/lib/db              not used in Phase 1 (Supabase client is the DB access)
src/lib/permissions     role matrix
src/lib/supabase        browser, server, admin clients
src/lib/validations     Zod schemas
src/services            use-case functions
src/types
src/constants           navigation
supabase/migrations     SQL you run in Supabase
```

`lib/ai` is specified in `AI_ARCHITECTURE.md` and is not implemented in Phase 1.

# Security

## Secrets

| Variable | Where it may run |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Browser and server |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Browser and server. Public client key. `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` is accepted as an alias. |
| `SUPABASE_SERVICE_ROLE_KEY` | Server only. Not referenced by client components. Unused in Phase 1. |
| `GEMINI_API_KEY`, `OPENAI_API_KEY` | Server only, Phase 4. |

Never prefix a secret with `NEXT_PUBLIC_`. The service-role client, when added, imports `server-only`.

## Session

`src/proxy.ts` calls `auth.getClaims()` to refresh the session cookie. Server code that authorizes a request calls `auth.getUser()`, which checks the token with Supabase Auth. `getSession()` is not used for authorization because it trusts the cookie payload without that check.

`src/proxy.ts` only redirects. Layouts and route handlers call `requireRole` again.

## Role

- Role is `profiles.role`.
- The profile trigger may copy `raw_app_meta_data.role` at insert time. `raw_user_meta_data` is ignored because users can edit it.
- Profile update policies do not allow `role` or `is_active` changes by the row owner.
- Clients must not send a role field. APIs that later accept a body ignore any role in that body.
- Bootstrap an admin in the SQL editor after the user exists:

```sql
update public.profiles
set role = 'admin'
where email = 'you@college.edu';
```

Turn off public sign-ups in the Supabase Auth settings so unknown people cannot create `student` profiles.

## Row Level Security

Every `public` table has RLS enabled. Policies match `DATABASE_DESIGN.md`. Views are not used in Phase 1. If a view is added later, create it with `security_invoker = true`.

`security definer` functions stay in `private`.

Phase 1 does not let students or teachers read the `students` or `teachers` tables. That avoids a directory leak before class assignment exists.

## Errors

Users see short messages (“You do not have permission to access this resource.”, “We couldn't generate a response right now. Please try again.”). Responses omit SQL text, stack traces, and key material.

## AI (Phase 4 contract)

The model is not a security boundary. Tool executors enforce the id rules in `AI_ARCHITECTURE.md` before any private row is placed in a prompt. Generated question papers stay `draft` until a teacher publishes them.

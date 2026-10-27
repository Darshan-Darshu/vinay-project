create table public.admin_chat_proposals (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id),
  session_id uuid references public.chat_sessions (id) on delete set null,
  specialist text not null check (specialist in (
    'admissions', 'students', 'teachers', 'departments', 'courses',
    'subjects', 'announcements', 'events', 'placements'
  )),
  action text not null check (action in (
    'department.create', 'department.update',
    'course.create', 'course.update',
    'subject.create', 'subject.update',
    'student.update',
    'teacher.create', 'teacher.update',
    'admission.create', 'admission.update', 'admission.status', 'admission.enroll',
    'announcement.create', 'announcement.update',
    'event.create', 'event.update',
    'placement.create', 'placement.update', 'placement.application'
  )),
  payload jsonb not null,
  summary text not null,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default pg_catalog.now(),
  constraint admin_chat_proposals_payload_object check (jsonb_typeof(payload) = 'object')
);

create index admin_chat_proposals_profile_id_idx
  on public.admin_chat_proposals (profile_id, created_at desc);

alter table public.admin_chat_proposals enable row level security;

revoke all on public.admin_chat_proposals from public, anon;
grant select, insert, update on public.admin_chat_proposals to authenticated;

create policy admin_chat_proposals_own on public.admin_chat_proposals
  for all to authenticated
  using (
    profile_id = (select auth.uid())
    and private.is_admin()
  )
  with check (
    profile_id = (select auth.uid())
    and private.is_admin()
  );

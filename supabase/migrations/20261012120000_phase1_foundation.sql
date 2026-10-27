-- Phase 1 foundation schema for the AI College platform.
-- Run this file in the Supabase SQL editor (hosted project).
-- Then create a user under Authentication and promote them:
--   update public.profiles set role = 'admin' where email = 'you@college.edu';
-- Turn off public sign-ups in Authentication settings.

create schema if not exists private;

create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = pg_catalog.now();
  return new;
end;
$$;

revoke all on function private.set_updated_at() from public;

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role text not null default 'student' check (role in ('admin', 'teacher', 'student')),
  full_name text not null,
  email text not null unique,
  phone text,
  avatar_url text,
  is_active boolean not null default true,
  deleted_at timestamptz,
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now()
);

create index profiles_role_idx on public.profiles (role) where deleted_at is null;

create table public.college_settings (
  id boolean primary key default true check (id),
  name text not null,
  about text not null default '',
  address text not null default '',
  phone text not null default '',
  email text not null default '',
  admissions_info text not null default '',
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now()
);

create table public.departments (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  code text not null unique,
  description text not null default '',
  is_active boolean not null default true,
  deleted_at timestamptz,
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now()
);

create index departments_active_name_idx on public.departments (name) where deleted_at is null;

create table public.academic_years (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  starts_on date not null,
  ends_on date not null,
  is_current boolean not null default false,
  deleted_at timestamptz,
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  check (ends_on >= starts_on)
);

create unique index academic_years_one_current_idx
  on public.academic_years (is_current)
  where is_current and deleted_at is null;

create table public.courses (
  id uuid primary key default gen_random_uuid(),
  department_id uuid not null references public.departments (id),
  name text not null,
  code text not null unique,
  duration_semesters integer not null check (duration_semesters between 1 and 12),
  description text not null default '',
  is_active boolean not null default true,
  deleted_at timestamptz,
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now()
);

create index courses_department_id_idx on public.courses (department_id);

create table public.semesters (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses (id),
  academic_year_id uuid not null references public.academic_years (id),
  number integer not null check (number between 1 and 12),
  is_active boolean not null default true,
  deleted_at timestamptz,
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  unique (course_id, academic_year_id, number)
);

create index semesters_course_id_idx on public.semesters (course_id);
create index semesters_academic_year_id_idx on public.semesters (academic_year_id);

create table public.subjects (
  id uuid primary key default gen_random_uuid(),
  department_id uuid not null references public.departments (id),
  course_id uuid not null references public.courses (id),
  semester_number integer not null check (semester_number between 1 and 12),
  name text not null,
  code text not null,
  credits integer not null default 0 check (credits >= 0),
  is_active boolean not null default true,
  deleted_at timestamptz,
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  unique (course_id, code)
);

create index subjects_course_id_idx on public.subjects (course_id);
create index subjects_department_id_idx on public.subjects (department_id);

create table public.admissions (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  email text not null,
  phone text,
  department_id uuid references public.departments (id),
  course_id uuid references public.courses (id),
  semester_id uuid references public.semesters (id),
  status text not null default 'applied'
    check (status in ('applied', 'under_review', 'approved', 'rejected', 'completed')),
  notes text not null default '',
  student_id uuid,
  deleted_at timestamptz,
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now()
);

create index admissions_status_idx on public.admissions (status) where deleted_at is null;
create index admissions_email_idx on public.admissions (email);

create table public.students (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null unique references public.profiles (id),
  department_id uuid references public.departments (id),
  course_id uuid references public.courses (id),
  semester_id uuid references public.semesters (id),
  admission_id uuid unique references public.admissions (id),
  roll_number text unique,
  is_active boolean not null default true,
  deleted_at timestamptz,
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now()
);

create index students_department_id_idx on public.students (department_id);
create index students_course_id_idx on public.students (course_id);

alter table public.admissions
  add constraint admissions_student_id_fkey
  foreign key (student_id) references public.students (id);

create table public.teachers (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null unique references public.profiles (id),
  department_id uuid references public.departments (id),
  employee_code text unique,
  designation text not null default '',
  is_active boolean not null default true,
  deleted_at timestamptz,
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now()
);

create index teachers_department_id_idx on public.teachers (department_id);

create table public.events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null default '',
  event_type text not null
    check (event_type in (
      'technical', 'sports', 'cultural', 'workshop',
      'seminar', 'hackathon', 'fest', 'placement'
    )),
  starts_at timestamptz not null,
  ends_at timestamptz,
  venue text not null default '',
  status text not null default 'draft'
    check (status in ('draft', 'published', 'cancelled', 'completed')),
  is_public boolean not null default false,
  deleted_at timestamptz,
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  check (ends_at is null or ends_at >= starts_at)
);

create index events_starts_at_idx on public.events (starts_at)
  where status = 'published' and deleted_at is null;

create table public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null default '',
  audience text not null default 'everyone'
    check (audience in ('everyone', 'students', 'teachers', 'admins')),
  department_id uuid references public.departments (id),
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high')),
  publish_at timestamptz not null default pg_catalog.now(),
  expires_at timestamptz,
  author_id uuid references public.profiles (id) on delete set null,
  status text not null default 'draft' check (status in ('draft', 'published')),
  deleted_at timestamptz,
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now()
);

create index announcements_publish_idx on public.announcements (publish_at, expires_at)
  where status = 'published' and deleted_at is null;

create table public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles (id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  summary text not null,
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now()
);

create index activity_logs_created_at_idx on public.activity_logs (created_at desc);

create or replace function private.current_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select role
  from public.profiles
  where id = auth.uid()
    and deleted_at is null
    and is_active
$$;

create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.current_role() = 'admin'
$$;

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  requested_role text := new.raw_app_meta_data ->> 'role';
  resolved_role text := 'student';
begin
  if requested_role in ('admin', 'teacher', 'student') then
    resolved_role := requested_role;
  end if;

  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    coalesce(new.email, new.id::text),
    coalesce(
      nullif(new.raw_user_meta_data ->> 'full_name', ''),
      nullif(split_part(coalesce(new.email, 'user'), '@', 1), ''),
      'New user'
    ),
    resolved_role
  );

  return new;
end;
$$;

create or replace function private.protect_profile_columns()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_admin() then
    if new.role is distinct from old.role
      or new.is_active is distinct from old.is_active
      or new.email is distinct from old.email
      or new.deleted_at is distinct from old.deleted_at
      or new.id is distinct from old.id
    then
      raise exception 'privileged profile fields cannot be changed';
    end if;
  end if;
  return new;
end;
$$;

revoke all on function private.current_role() from public;
revoke all on function private.is_admin() from public;
revoke all on function private.handle_new_user() from public;
revoke all on function private.protect_profile_columns() from public;

grant usage on schema private to authenticated;
grant execute on function private.current_role() to authenticated;
grant execute on function private.is_admin() to authenticated;
grant execute on function private.protect_profile_columns() to authenticated;
grant execute on function private.handle_new_user() to supabase_auth_admin;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function private.set_updated_at();

create trigger profiles_protect_columns
  before update on public.profiles
  for each row execute function private.protect_profile_columns();

create trigger college_settings_set_updated_at
  before update on public.college_settings
  for each row execute function private.set_updated_at();

create trigger departments_set_updated_at
  before update on public.departments
  for each row execute function private.set_updated_at();

create trigger academic_years_set_updated_at
  before update on public.academic_years
  for each row execute function private.set_updated_at();

create trigger courses_set_updated_at
  before update on public.courses
  for each row execute function private.set_updated_at();

create trigger semesters_set_updated_at
  before update on public.semesters
  for each row execute function private.set_updated_at();

create trigger subjects_set_updated_at
  before update on public.subjects
  for each row execute function private.set_updated_at();

create trigger admissions_set_updated_at
  before update on public.admissions
  for each row execute function private.set_updated_at();

create trigger students_set_updated_at
  before update on public.students
  for each row execute function private.set_updated_at();

create trigger teachers_set_updated_at
  before update on public.teachers
  for each row execute function private.set_updated_at();

create trigger events_set_updated_at
  before update on public.events
  for each row execute function private.set_updated_at();

create trigger announcements_set_updated_at
  before update on public.announcements
  for each row execute function private.set_updated_at();

create trigger activity_logs_set_updated_at
  before update on public.activity_logs
  for each row execute function private.set_updated_at();

grant execute on function private.set_updated_at() to authenticated;

alter table public.profiles enable row level security;
alter table public.college_settings enable row level security;
alter table public.departments enable row level security;
alter table public.academic_years enable row level security;
alter table public.courses enable row level security;
alter table public.semesters enable row level security;
alter table public.subjects enable row level security;
alter table public.admissions enable row level security;
alter table public.students enable row level security;
alter table public.teachers enable row level security;
alter table public.events enable row level security;
alter table public.announcements enable row level security;
alter table public.activity_logs enable row level security;

create policy profiles_select_own on public.profiles
  for select to authenticated
  using (id = (select auth.uid()));

create policy profiles_update_own on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

create policy profiles_admin_all on public.profiles
  for all to authenticated
  using (private.is_admin())
  with check (private.is_admin());

create policy college_settings_select on public.college_settings
  for select to anon, authenticated
  using (true);

create policy college_settings_admin_update on public.college_settings
  for update to authenticated
  using (private.is_admin())
  with check (private.is_admin());

create policy departments_public_select on public.departments
  for select to anon, authenticated
  using (deleted_at is null and is_active);

create policy departments_admin_all on public.departments
  for all to authenticated
  using (private.is_admin())
  with check (private.is_admin());

create policy academic_years_public_select on public.academic_years
  for select to anon, authenticated
  using (deleted_at is null);

create policy academic_years_admin_all on public.academic_years
  for all to authenticated
  using (private.is_admin())
  with check (private.is_admin());

create policy courses_public_select on public.courses
  for select to anon, authenticated
  using (deleted_at is null and is_active);

create policy courses_admin_all on public.courses
  for all to authenticated
  using (private.is_admin())
  with check (private.is_admin());

create policy semesters_public_select on public.semesters
  for select to anon, authenticated
  using (deleted_at is null and is_active);

create policy semesters_admin_all on public.semesters
  for all to authenticated
  using (private.is_admin())
  with check (private.is_admin());

create policy subjects_public_select on public.subjects
  for select to anon, authenticated
  using (deleted_at is null and is_active);

create policy subjects_admin_all on public.subjects
  for all to authenticated
  using (private.is_admin())
  with check (private.is_admin());

create policy admissions_admin_all on public.admissions
  for all to authenticated
  using (private.is_admin())
  with check (private.is_admin());

create policy students_admin_all on public.students
  for all to authenticated
  using (private.is_admin())
  with check (private.is_admin());

create policy teachers_admin_all on public.teachers
  for all to authenticated
  using (private.is_admin())
  with check (private.is_admin());

create policy events_public_select on public.events
  for select to anon, authenticated
  using (
    deleted_at is null
    and is_public
    and status = 'published'
  );

create policy events_admin_all on public.events
  for all to authenticated
  using (private.is_admin())
  with check (private.is_admin());

create policy announcements_public_select on public.announcements
  for select to anon, authenticated
  using (
    deleted_at is null
    and status = 'published'
    and audience = 'everyone'
    and publish_at <= pg_catalog.now()
    and (expires_at is null or expires_at > pg_catalog.now())
  );

create policy announcements_admin_all on public.announcements
  for all to authenticated
  using (private.is_admin())
  with check (private.is_admin());

create policy activity_logs_admin_select on public.activity_logs
  for select to authenticated
  using (private.is_admin());

create policy activity_logs_admin_insert on public.activity_logs
  for insert to authenticated
  with check (private.is_admin() and actor_id = (select auth.uid()));

revoke all on table public.profiles from anon;
revoke all on table public.students from anon;
revoke all on table public.teachers from anon;
revoke all on table public.admissions from anon;
revoke all on table public.activity_logs from anon;

insert into public.college_settings (id, name, about, admissions_info)
values (
  true,
  'College',
  'Update this introduction from Admin settings after you sign in.',
  'Admission steps, eligibility, and important dates will be published here.'
);

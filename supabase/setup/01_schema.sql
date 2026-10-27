-- Full schema for a new Supabase project.
-- Run this once in the SQL editor, then run 02_demo_data.sql.
-- Do not run it again on a project that already has these tables.


-- ===== 20261012120000_phase1_foundation.sql =====

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


-- ===== 20261012143000_dashboard_role_reads.sql =====

-- Let each signed-in person read their own student or teacher record,
-- and read announcements addressed to their role.

create or replace function private.is_role(expected text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.current_role() = expected
$$;

revoke all on function private.is_role(text) from public;
grant execute on function private.is_role(text) to authenticated;

create policy students_select_own on public.students
  for select to authenticated
  using (profile_id = (select auth.uid()) and deleted_at is null);

create policy teachers_select_own on public.teachers
  for select to authenticated
  using (profile_id = (select auth.uid()) and deleted_at is null);

create policy announcements_role_select on public.announcements
  for select to authenticated
  using (
    deleted_at is null
    and status = 'published'
    and publish_at <= pg_catalog.now()
    and (expires_at is null or expires_at > pg_catalog.now())
    and (
      (audience = 'students' and private.is_role('student'))
      or (audience = 'teachers' and private.is_role('teacher'))
      or (audience = 'admins' and private.is_role('admin'))
    )
  );


-- ===== 20261022055053_teacher_subjects.sql =====

-- Subjects a teacher takes, and campus-wide reads for signed-in students and teachers.

create table public.teacher_subjects (
  teacher_id uuid not null references public.teachers (id) on delete cascade,
  subject_id uuid not null references public.subjects (id) on delete cascade,
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  primary key (teacher_id, subject_id)
);

create index teacher_subjects_subject_id_idx on public.teacher_subjects (subject_id);

create trigger teacher_subjects_set_updated_at
  before update on public.teacher_subjects
  for each row execute function private.set_updated_at();

alter table public.teacher_subjects enable row level security;

revoke all on public.teacher_subjects from public, anon;
grant select, insert, update, delete on public.teacher_subjects to authenticated;

create or replace function private.teaches_course(target_course uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.teacher_subjects
    join public.subjects on subjects.id = teacher_subjects.subject_id
    join public.teachers on teachers.id = teacher_subjects.teacher_id
    where teachers.profile_id = (select auth.uid())
      and teachers.deleted_at is null
      and subjects.deleted_at is null
      and subjects.course_id = target_course
  )
$$;

create or replace function private.teaches_student(target_profile uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.students
    where students.profile_id = target_profile
      and students.deleted_at is null
      and students.is_active
      and private.teaches_course(students.course_id)
  )
$$;

revoke all on function private.teaches_course(uuid) from public;
revoke all on function private.teaches_student(uuid) from public;
grant execute on function private.teaches_course(uuid) to authenticated;
grant execute on function private.teaches_student(uuid) to authenticated;

create policy teacher_subjects_admin_all on public.teacher_subjects
  for all to authenticated
  using (private.is_admin())
  with check (private.is_admin());

create policy teacher_subjects_select_own on public.teacher_subjects
  for select to authenticated
  using (
    teacher_id in (
      select teachers.id
      from public.teachers
      where teachers.profile_id = (select auth.uid())
        and teachers.deleted_at is null
    )
  );

create policy students_select_taught on public.students
  for select to authenticated
  using (
    deleted_at is null
    and is_active
    and private.teaches_course(course_id)
  );

create policy profiles_select_taught_students on public.profiles
  for select to authenticated
  using (private.teaches_student(id));

create policy events_campus_select on public.events
  for select to authenticated
  using (
    deleted_at is null
    and status = 'published'
    and (select private.current_role()) in ('student', 'teacher')
  );


-- ===== 20261022055305_placement_drives.sql =====

-- Company visits and the students who apply to them.

create table public.placement_drives (
  id uuid primary key default gen_random_uuid(),
  company_name text not null,
  role_title text not null,
  description text not null default '',
  package_text text not null default '',
  location text not null default '',
  job_type text not null check (job_type in ('full_time', 'internship')),
  eligibility text not null default '',
  department_id uuid references public.departments (id) on delete set null,
  course_id uuid references public.courses (id) on delete set null,
  apply_by timestamptz not null,
  visit_at timestamptz,
  venue text not null default '',
  status text not null default 'draft' check (status in ('draft', 'open', 'closed')),
  deleted_at timestamptz,
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now()
);

create index placement_drives_status_idx on public.placement_drives (status)
  where deleted_at is null;

create index placement_drives_apply_by_idx on public.placement_drives (apply_by)
  where deleted_at is null;

create table public.placement_applications (
  id uuid primary key default gen_random_uuid(),
  drive_id uuid not null references public.placement_drives (id),
  student_id uuid not null references public.students (id),
  status text not null default 'applied'
    check (status in ('applied', 'shortlisted', 'selected', 'not_selected')),
  applied_at timestamptz not null default pg_catalog.now(),
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  unique (drive_id, student_id)
);

create index placement_applications_drive_id_idx on public.placement_applications (drive_id);
create index placement_applications_student_id_idx on public.placement_applications (student_id);

create trigger placement_drives_set_updated_at
  before update on public.placement_drives
  for each row execute function private.set_updated_at();

create trigger placement_applications_set_updated_at
  before update on public.placement_applications
  for each row execute function private.set_updated_at();

alter table public.placement_drives enable row level security;
alter table public.placement_applications enable row level security;

revoke all on public.placement_drives from public, anon;
revoke all on public.placement_applications from public, anon;
grant select, insert, update, delete on public.placement_drives to authenticated;
grant select, insert, update, delete on public.placement_applications to authenticated;

create or replace function private.can_read_drive(target_drive uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.placement_drives as drives
    join public.students as students
      on students.profile_id = (select auth.uid())
    where drives.id = target_drive
      and drives.deleted_at is null
      and students.deleted_at is null
      and students.is_active
      and (
        (
          drives.status = 'open'
          and (drives.department_id is null or drives.department_id = students.department_id)
          and (drives.course_id is null or drives.course_id = students.course_id)
        )
        or (
          drives.status = 'closed'
          and exists (
            select 1
            from public.placement_applications as applications
            where applications.drive_id = drives.id
              and applications.student_id = students.id
          )
        )
      )
  )
$$;

create or replace function private.can_apply(target_drive uuid, target_student uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.placement_drives as drives
    join public.students as students on students.id = target_student
    where drives.id = target_drive
      and drives.deleted_at is null
      and drives.status = 'open'
      and drives.apply_by >= pg_catalog.now()
      and students.profile_id = (select auth.uid())
      and students.deleted_at is null
      and students.is_active
      and (drives.department_id is null or drives.department_id = students.department_id)
      and (drives.course_id is null or drives.course_id = students.course_id)
  )
$$;

revoke all on function private.can_read_drive(uuid) from public;
revoke all on function private.can_apply(uuid, uuid) from public;
grant execute on function private.can_read_drive(uuid) to authenticated;
grant execute on function private.can_apply(uuid, uuid) to authenticated;

create policy placement_drives_admin_all on public.placement_drives
  for all to authenticated
  using (private.is_admin())
  with check (private.is_admin());

create policy placement_drives_student_select on public.placement_drives
  for select to authenticated
  using (
    (select private.current_role()) = 'student'
    and private.can_read_drive(id)
  );

create policy placement_applications_admin_all on public.placement_applications
  for all to authenticated
  using (private.is_admin())
  with check (private.is_admin());

create policy placement_applications_student_select on public.placement_applications
  for select to authenticated
  using (
    student_id in (
      select students.id
      from public.students as students
      where students.profile_id = (select auth.uid())
        and students.deleted_at is null
    )
  );

create policy placement_applications_student_insert on public.placement_applications
  for insert to authenticated
  with check (
    status = 'applied'
    and private.can_apply(drive_id, student_id)
  );


-- ===== 20261022064005_academic_records.sql =====

-- Objective papers, resumes, learning materials, and the chat tables the agent spec will write later.
-- Scoring matches src/lib/academics/score.ts: a question scores its marks only when the chosen option is correct.

alter table public.placement_drives
  add column required_skills text[] not null default '{}';

create or replace function private.normalize_skills(input text[])
returns text[]
language sql
immutable
set search_path = ''
as $$
  select coalesce(
    (
      select pg_catalog.array_agg(skill order by skill)
      from (
        select distinct pg_catalog.lower(pg_catalog.btrim(item)) as skill
        from pg_catalog.unnest(coalesce(input, array[]::text[])) as item
        where pg_catalog.btrim(item) <> ''
      ) cleaned
    ),
    array[]::text[]
  )
$$;

create or replace function private.normalize_skill_list()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  normalized text[];
  skill text;
begin
  if tg_table_name = 'student_resumes' then
    normalized := private.normalize_skills(new.skills);
  else
    normalized := private.normalize_skills(new.required_skills);
  end if;

  if coalesce(pg_catalog.array_length(normalized, 1), 0) > 40 then
    raise exception 'Enter at most 40 skills.';
  end if;

  foreach skill in array normalized loop
    if pg_catalog.char_length(skill) > 40 then
      raise exception 'Each skill must be 40 characters or fewer.';
    end if;
  end loop;

  if tg_table_name = 'student_resumes' then
    new.skills := normalized;
  else
    new.required_skills := normalized;
  end if;
  return new;
end;
$$;

create trigger placement_drives_normalize_skills
  before insert or update of required_skills on public.placement_drives
  for each row execute function private.normalize_skill_list();

create or replace function private.current_student_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select students.id
  from public.students
  where students.profile_id = (select auth.uid())
    and students.deleted_at is null
    and students.is_active
$$;

create or replace function private.teaches_subject(target_subject uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_admin()
    or exists (
      select 1
      from public.teacher_subjects
      join public.teachers on teachers.id = teacher_subjects.teacher_id
      join public.subjects on subjects.id = teacher_subjects.subject_id
      where teacher_subjects.subject_id = target_subject
        and teachers.profile_id = (select auth.uid())
        and teachers.deleted_at is null
        and teachers.is_active
        and subjects.deleted_at is null
    )
$$;

create table public.student_resumes (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  student_id uuid not null unique references public.students (id) on delete cascade,
  storage_path text not null,
  file_name text not null,
  skills text[] not null default '{}',
  extracted_text text not null default '',
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now()
);

create trigger student_resumes_set_updated_at
  before update on public.student_resumes
  for each row execute function private.set_updated_at();

create trigger student_resumes_normalize_skills
  before insert or update of skills on public.student_resumes
  for each row execute function private.normalize_skill_list();

create table public.questions (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  subject_id uuid not null references public.subjects (id),
  topic text not null default '',
  question_type text not null check (question_type in ('mcq', 'true_false')),
  difficulty text not null default 'medium' check (difficulty in ('easy', 'medium', 'hard')),
  marks integer not null check (marks > 0 and marks <= 100),
  stem text not null check (pg_catalog.char_length(pg_catalog.btrim(stem)) > 0),
  explanation text not null default '',
  created_by uuid not null references public.profiles (id),
  source text not null default 'manual' check (source in ('manual', 'ai')),
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now()
);

create index questions_subject_id_idx on public.questions (subject_id);

create trigger questions_set_updated_at
  before update on public.questions
  for each row execute function private.set_updated_at();

create table public.question_options (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  question_id uuid not null references public.questions (id) on delete cascade,
  label text not null,
  option_text text not null check (pg_catalog.char_length(pg_catalog.btrim(option_text)) > 0),
  is_correct boolean not null default false,
  ordinal integer not null check (ordinal >= 0),
  unique (question_id, ordinal)
);

create index question_options_question_id_idx on public.question_options (question_id);

create table public.question_papers (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  subject_id uuid not null references public.subjects (id),
  title text not null check (pg_catalog.char_length(pg_catalog.btrim(title)) > 0),
  duration_minutes integer not null check (duration_minutes > 0 and duration_minutes <= 300),
  total_marks integer not null default 0 check (total_marks >= 0),
  status text not null default 'draft' check (status in ('draft', 'published')),
  opens_at timestamptz not null,
  closes_at timestamptz not null,
  created_by uuid not null references public.profiles (id),
  published_at timestamptz,
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  check (opens_at < closes_at)
);

create index question_papers_subject_id_idx on public.question_papers (subject_id, status);

create trigger question_papers_set_updated_at
  before update on public.question_papers
  for each row execute function private.set_updated_at();

create table public.question_paper_questions (
  paper_id uuid not null references public.question_papers (id) on delete cascade,
  question_id uuid not null references public.questions (id),
  ordinal integer not null check (ordinal >= 0),
  marks integer not null check (marks > 0),
  primary key (paper_id, question_id),
  unique (paper_id, ordinal)
);

create index question_paper_questions_question_id_idx on public.question_paper_questions (question_id);

create table public.test_attempts (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  student_id uuid not null references public.students (id),
  paper_id uuid not null references public.question_papers (id),
  status text not null default 'in_progress' check (status in ('in_progress', 'submitted', 'expired')),
  started_at timestamptz not null default pg_catalog.now(),
  submitted_at timestamptz,
  score integer,
  max_score integer not null check (max_score >= 0),
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  unique (student_id, paper_id)
);

create index test_attempts_paper_id_idx on public.test_attempts (paper_id);
create index test_attempts_student_id_idx on public.test_attempts (student_id);

create trigger test_attempts_set_updated_at
  before update on public.test_attempts
  for each row execute function private.set_updated_at();

create table public.student_answers (
  attempt_id uuid not null references public.test_attempts (id) on delete cascade,
  question_id uuid not null references public.questions (id),
  option_id uuid not null references public.question_options (id),
  primary key (attempt_id, question_id)
);

create index student_answers_option_id_idx on public.student_answers (option_id);

create table public.learning_materials (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  subject_id uuid not null references public.subjects (id),
  title text not null check (pg_catalog.char_length(pg_catalog.btrim(title)) > 0),
  kind text not null check (kind in ('pdf', 'link')),
  storage_path text,
  external_url text,
  file_name text not null default '',
  approved_for_rag boolean not null default false,
  uploaded_by uuid not null references public.profiles (id),
  deleted_at timestamptz,
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  check (
    (kind = 'pdf' and storage_path is not null and external_url is null)
    or (kind = 'link' and external_url is not null and storage_path is null)
  )
);

create index learning_materials_subject_id_idx on public.learning_materials (subject_id)
  where deleted_at is null;

create trigger learning_materials_set_updated_at
  before update on public.learning_materials
  for each row execute function private.set_updated_at();

create table public.chat_sessions (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  profile_id uuid not null references public.profiles (id),
  role text not null check (role in ('admin', 'teacher', 'student')),
  feature text not null,
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now()
);

create index chat_sessions_profile_id_idx on public.chat_sessions (profile_id);

create trigger chat_sessions_set_updated_at
  before update on public.chat_sessions
  for each row execute function private.set_updated_at();

create table public.chat_messages (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  session_id uuid not null references public.chat_sessions (id) on delete cascade,
  role text not null check (role in ('user', 'assistant', 'tool')),
  content text not null,
  created_at timestamptz not null default pg_catalog.now()
);

create index chat_messages_session_id_idx on public.chat_messages (session_id, created_at);

create table public.ai_usage_logs (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  profile_id uuid not null references public.profiles (id),
  role text not null,
  model text not null,
  feature text not null,
  latency_ms integer,
  prompt_tokens integer,
  completion_tokens integer,
  status text not null,
  created_at timestamptz not null default pg_catalog.now()
);

create index ai_usage_logs_profile_id_idx on public.ai_usage_logs (profile_id, created_at desc);

create or replace function private.question_is_frozen(target_question uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.question_paper_questions
    join public.question_papers on question_papers.id = question_paper_questions.paper_id
    where question_paper_questions.question_id = target_question
      and question_papers.status = 'published'
  )
$$;

create or replace function private.prevent_frozen_question_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if private.question_is_frozen(old.id) then
    raise exception 'Published questions cannot be changed.';
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create trigger questions_freeze_published
  before update or delete on public.questions
  for each row execute function private.prevent_frozen_question_change();

create or replace function private.prevent_frozen_option_change()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  target uuid := coalesce(new.question_id, old.question_id);
begin
  if private.question_is_frozen(target) then
    raise exception 'Published questions cannot be changed.';
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create trigger question_options_freeze_published
  before insert or update or delete on public.question_options
  for each row execute function private.prevent_frozen_option_change();

create or replace function private.assert_question_options()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  target uuid := coalesce(new.question_id, old.question_id);
  kind text;
  option_count integer;
  correct_count integer;
begin
  select questions.question_type into kind
  from public.questions
  where questions.id = target;

  if kind is null then
    return null;
  end if;

  select count(*), count(*) filter (where is_correct)
    into option_count, correct_count
  from public.question_options
  where question_id = target;

  if option_count = 0 then
    return null;
  end if;

  if correct_count <> 1 then
    raise exception 'Each question needs one correct option.';
  end if;

  if kind = 'true_false' and option_count <> 2 then
    raise exception 'True or false questions need two options.';
  end if;

  if kind = 'mcq' and (option_count < 2 or option_count > 6) then
    raise exception 'Multiple choice questions need two to six options.';
  end if;

  return null;
end;
$$;

create constraint trigger question_options_one_correct
  after insert or update or delete on public.question_options
  deferrable initially deferred
  for each row
  execute function private.assert_question_options();

create or replace function private.prevent_published_paper_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.status = 'published' then
    raise exception 'Published papers cannot be changed.';
  end if;
  if new.status = 'published' and pg_catalog.current_setting('app.publishing', true) is distinct from 'on' then
    raise exception 'Publish the paper from the paper screen.';
  end if;
  return new;
end;
$$;

create trigger question_papers_freeze
  before update on public.question_papers
  for each row execute function private.prevent_published_paper_change();

create or replace function private.prevent_published_link_change()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  target uuid := coalesce(new.paper_id, old.paper_id);
  paper_status text;
begin
  select status into paper_status from public.question_papers where id = target;
  if paper_status = 'published' then
    raise exception 'Published papers cannot be changed.';
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create trigger question_paper_questions_freeze
  before insert or update or delete on public.question_paper_questions
  for each row execute function private.prevent_published_link_change();

create or replace function private.publish_question_paper(target_paper uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  paper public.question_papers%rowtype;
  question_count integer;
begin
  select * into paper from public.question_papers where id = target_paper;
  if not found then
    raise exception 'That paper could not be found.';
  end if;
  if not private.teaches_subject(paper.subject_id) then
    raise exception 'You do not have permission to publish this paper.';
  end if;
  if paper.status = 'published' then
    raise exception 'This paper is already published.';
  end if;
  if paper.opens_at >= paper.closes_at then
    raise exception 'The open time has to be before the close time.';
  end if;

  select count(*) into question_count
  from public.question_paper_questions
  where paper_id = paper.id;

  if question_count = 0 then
    raise exception 'Add at least one question before publishing.';
  end if;

  perform pg_catalog.set_config('app.publishing', 'on', true);

  update public.question_papers
  set status = 'published',
      published_at = pg_catalog.now(),
      total_marks = (
        select coalesce(sum(marks), 0)
        from public.question_paper_questions
        where paper_id = paper.id
      )
  where id = paper.id;
end;
$$;

create or replace function private.replace_attempt_answers(
  target_attempt uuid,
  target_paper uuid,
  answers jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  item jsonb;
  question_id uuid;
  option_id uuid;
begin
  if answers is null then
    answers := '[]'::jsonb;
  end if;
  if pg_catalog.jsonb_typeof(answers) <> 'array' then
    raise exception 'Check the form and try again.';
  end if;

  if exists (
    select 1
    from pg_catalog.jsonb_array_elements(answers) as elem
    group by elem ->> 'questionId'
    having count(*) > 1
  ) then
    raise exception 'Check the form and try again.';
  end if;

  delete from public.student_answers where attempt_id = target_attempt;

  for item in select elements.value from pg_catalog.jsonb_array_elements(answers) as elements(value) loop
    begin
      question_id := (item ->> 'questionId')::uuid;
      option_id := (item ->> 'optionId')::uuid;
    exception
      when invalid_text_representation then
        raise exception 'Check the form and try again.';
    end;

    if not exists (
      select 1
      from public.question_paper_questions
      where paper_id = target_paper
        and question_paper_questions.question_id = question_id
    ) then
      raise exception 'Check the form and try again.';
    end if;

    if not exists (
      select 1
      from public.question_options
      where question_options.id = option_id
        and question_options.question_id = question_id
    ) then
      raise exception 'Check the form and try again.';
    end if;

    insert into public.student_answers (attempt_id, question_id, option_id)
    values (target_attempt, question_id, option_id);
  end loop;
end;
$$;

create or replace function private.lock_student_attempt(target_attempt uuid)
returns public.test_attempts
language plpgsql
security definer
set search_path = ''
as $$
declare
  student uuid := private.current_student_id();
  attempt public.test_attempts%rowtype;
  paper public.question_papers%rowtype;
begin
  if student is null then
    raise exception 'Your enrollment is not on file yet.';
  end if;

  select * into attempt
  from public.test_attempts
  where id = target_attempt
  for update;

  if not found or attempt.student_id <> student then
    raise exception 'That attempt could not be found.';
  end if;

  select * into paper from public.question_papers where id = attempt.paper_id;

  if attempt.status = 'in_progress' and pg_catalog.now() >= paper.closes_at then
    update public.test_attempts
    set status = 'expired', submitted_at = pg_catalog.now(), score = null
    where id = attempt.id;
    attempt.status := 'expired';
    attempt.score := null;
  end if;

  return attempt;
end;
$$;

create or replace function private.start_test_attempt(target_paper uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  student uuid := private.current_student_id();
  course uuid;
  paper public.question_papers%rowtype;
  subject_course uuid;
  existing public.test_attempts%rowtype;
  created uuid;
  max_marks integer;
begin
  if student is null then
    raise exception 'Your enrollment is not on file yet.';
  end if;

  select students.course_id into course from public.students where students.id = student;

  select * into paper from public.question_papers where id = target_paper;
  if not found or paper.status <> 'published' then
    raise exception 'This paper is not open.';
  end if;

  select subjects.course_id into subject_course
  from public.subjects
  where subjects.id = paper.subject_id;

  if course is null or subject_course is distinct from course then
    raise exception 'This paper is for another course.';
  end if;

  if pg_catalog.now() < paper.opens_at or pg_catalog.now() >= paper.closes_at then
    raise exception 'This paper is not open.';
  end if;

  select * into existing
  from public.test_attempts
  where student_id = student
    and paper_id = paper.id;

  if found then
    if existing.status = 'in_progress' then
      return existing.id;
    end if;
    raise exception 'You have already taken this paper.';
  end if;

  select coalesce(sum(marks), 0) into max_marks
  from public.question_paper_questions
  where paper_id = paper.id;

  insert into public.test_attempts (student_id, paper_id, max_score)
  values (student, paper.id, max_marks)
  returning id into created;

  return created;
exception
  when unique_violation then
    select id into created
    from public.test_attempts
    where student_id = student
      and paper_id = target_paper
      and status = 'in_progress';
    if created is not null then
      return created;
    end if;
    raise exception 'You have already taken this paper.';
end;
$$;

create or replace function private.save_test_answers(target_attempt uuid, answers jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  attempt public.test_attempts%rowtype;
begin
  attempt := private.lock_student_attempt(target_attempt);
  if attempt.status = 'expired' then
    raise exception 'The paper has closed. This attempt has expired.';
  end if;
  if attempt.status <> 'in_progress' then
    raise exception 'This attempt is already submitted.';
  end if;
  perform private.replace_attempt_answers(attempt.id, attempt.paper_id, answers);
end;
$$;

create or replace function private.submit_test_attempt(target_attempt uuid, answers jsonb)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  attempt public.test_attempts%rowtype;
  earned integer;
begin
  attempt := private.lock_student_attempt(target_attempt);
  if attempt.status = 'expired' then
    raise exception 'The paper has closed. This attempt has expired.';
  end if;
  if attempt.status = 'submitted' then
    return coalesce(attempt.score, 0);
  end if;

  perform private.replace_attempt_answers(attempt.id, attempt.paper_id, answers);

  select coalesce(sum(link.marks) filter (where options.is_correct), 0)
    into earned
  from public.question_paper_questions as link
  left join public.student_answers as answers
    on answers.attempt_id = attempt.id
    and answers.question_id = link.question_id
  left join public.question_options as options
    on options.id = answers.option_id
  where link.paper_id = attempt.paper_id;

  update public.test_attempts
  set status = 'submitted',
      submitted_at = pg_catalog.now(),
      score = earned
  where id = attempt.id;

  return earned;
end;
$$;

create or replace function private.expire_my_closed_attempts()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  student uuid := private.current_student_id();
begin
  if student is null then
    return;
  end if;

  update public.test_attempts as attempts
  set status = 'expired',
      submitted_at = pg_catalog.now(),
      score = null
  from public.question_papers as papers
  where attempts.paper_id = papers.id
    and attempts.student_id = student
    and attempts.status = 'in_progress'
    and pg_catalog.now() >= papers.closes_at;
end;
$$;

create or replace function private.student_paper(target_paper uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  student uuid := private.current_student_id();
  course uuid;
  paper public.question_papers%rowtype;
  subject_name text;
  subject_course uuid;
  attempt public.test_attempts%rowtype;
  has_attempt boolean := false;
  show_key boolean := false;
  question_rows jsonb;
begin
  if student is null then
    raise exception 'Your enrollment is not on file yet.';
  end if;

  select students.course_id into course from public.students where students.id = student;
  select * into paper from public.question_papers where id = target_paper;
  if not found or paper.status <> 'published' then
    raise exception 'This paper is not open.';
  end if;

  select subjects.course_id, subjects.name
    into subject_course, subject_name
  from public.subjects
  where subjects.id = paper.subject_id;

  if course is null or subject_course is distinct from course then
    raise exception 'This paper is for another course.';
  end if;

  select * into attempt
  from public.test_attempts
  where test_attempts.student_id = student
    and test_attempts.paper_id = paper.id
  for update;

  if found then
    has_attempt := true;
    if attempt.status = 'in_progress' and pg_catalog.now() >= paper.closes_at then
      update public.test_attempts
      set status = 'expired', submitted_at = pg_catalog.now(), score = null
      where id = attempt.id;
      attempt.status := 'expired';
      attempt.score := null;
    end if;
    show_key := attempt.status = 'submitted';
  end if;

  if has_attempt and attempt.status in ('in_progress', 'submitted') then
    select coalesce(pg_catalog.jsonb_agg(item.payload order by item.ordinal), '[]'::jsonb)
      into question_rows
    from (
      select
        link.ordinal,
        pg_catalog.jsonb_build_object(
          'id', questions.id,
          'stem', questions.stem,
          'marks', link.marks,
          'explanation', case when show_key then questions.explanation else null end,
          'selectedOptionId', (
            select student_answers.option_id
            from public.student_answers
            where student_answers.attempt_id = attempt.id
              and student_answers.question_id = questions.id
          ),
          'options', (
            select coalesce(pg_catalog.jsonb_agg(
              pg_catalog.jsonb_build_object(
                'id', opts.id,
                'label', opts.label,
                'body', opts.option_text,
                'isCorrect', case when show_key then opts.is_correct else null end
              )
              order by opts.ordinal
            ), '[]'::jsonb)
            from public.question_options as opts
            where opts.question_id = questions.id
          )
        ) as payload
      from public.question_paper_questions as link
      join public.questions as questions on questions.id = link.question_id
      where link.paper_id = paper.id
    ) as item;
  else
    question_rows := '[]'::jsonb;
  end if;

  return pg_catalog.jsonb_build_object(
    'id', paper.id,
    'title', paper.title,
    'subjectName', subject_name,
    'durationMinutes', paper.duration_minutes,
    'opensAt', paper.opens_at,
    'closesAt', paper.closes_at,
    'maxScore', case when has_attempt then attempt.max_score else paper.total_marks end,
    'attemptId', case when has_attempt then attempt.id else null end,
    'attemptStatus', case when has_attempt then attempt.status else null end,
    'score', case when has_attempt then attempt.score else null end,
    'questions', question_rows
  );
end;
$$;

create or replace function private.save_question(
  target_question uuid,
  target_subject uuid,
  topic text,
  question_type text,
  difficulty text,
  marks integer,
  stem text,
  explanation text,
  options jsonb,
  actor uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  saved uuid := target_question;
  item jsonb;
  ordinal integer := 0;
begin
  if actor is distinct from (select auth.uid()) or not private.teaches_subject(target_subject) then
    raise exception 'You do not have permission to edit this question.';
  end if;
  if options is null or pg_catalog.jsonb_typeof(options) <> 'array' then
    raise exception 'Check the form and try again.';
  end if;

  if saved is null then
    insert into public.questions (
      subject_id, topic, question_type, difficulty, marks, stem, explanation, created_by, source
    )
    values (
      target_subject, topic, question_type, difficulty, marks, stem, explanation, actor, 'manual'
    )
    returning id into saved;
  else
    update public.questions
    set subject_id = target_subject,
        topic = topic,
        question_type = question_type,
        difficulty = difficulty,
        marks = marks,
        stem = stem,
        explanation = explanation
    where id = saved;
    if not found then
      raise exception 'That question could not be found.';
    end if;
  end if;

  delete from public.question_options where question_id = saved;

  for item in select elements.value from pg_catalog.jsonb_array_elements(options) as elements(value) loop
    insert into public.question_options (question_id, label, option_text, is_correct, ordinal)
    values (
      saved,
      coalesce(item ->> 'label', ''),
      coalesce(item ->> 'body', ''),
      coalesce((item ->> 'isCorrect')::boolean, false),
      ordinal
    );
    ordinal := ordinal + 1;
  end loop;

  return saved;
end;
$$;

create or replace function private.storage_folder_id(object_name text)
returns uuid
language plpgsql
stable
set search_path = ''
as $$
declare
  folder text := (storage.foldername(object_name))[1];
begin
  if folder is null or folder !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return null;
  end if;
  return folder::uuid;
end;
$$;

create or replace function public.publish_question_paper(target_paper uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  perform private.publish_question_paper(target_paper);
end;
$$;

create or replace function public.start_test_attempt(target_paper uuid)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
begin
  return private.start_test_attempt(target_paper);
end;
$$;

create or replace function public.save_test_answers(target_attempt uuid, answers jsonb)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  perform private.save_test_answers(target_attempt, answers);
end;
$$;

create or replace function public.submit_test_attempt(target_attempt uuid, answers jsonb)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
begin
  return private.submit_test_attempt(target_attempt, answers);
end;
$$;

create or replace function public.expire_my_closed_attempts()
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  perform private.expire_my_closed_attempts();
end;
$$;

create or replace function public.student_paper(target_paper uuid)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
begin
  return private.student_paper(target_paper);
end;
$$;

create or replace function public.save_question(
  target_question uuid,
  target_subject uuid,
  topic text,
  question_type text,
  difficulty text,
  marks integer,
  stem text,
  explanation text,
  options jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
begin
  return private.save_question(
    target_question,
    target_subject,
    topic,
    question_type,
    difficulty,
    marks,
    stem,
    explanation,
    options,
    (select auth.uid())
  );
end;
$$;

revoke all on function private.normalize_skills(text[]) from public;
revoke all on function private.normalize_skill_list() from public;
revoke all on function private.current_student_id() from public;
revoke all on function private.teaches_subject(uuid) from public;
revoke all on function private.question_is_frozen(uuid) from public;
revoke all on function private.prevent_frozen_question_change() from public;
revoke all on function private.prevent_frozen_option_change() from public;
revoke all on function private.assert_question_options() from public;
revoke all on function private.prevent_published_paper_change() from public;
revoke all on function private.prevent_published_link_change() from public;
revoke all on function private.publish_question_paper(uuid) from public;
revoke all on function private.replace_attempt_answers(uuid, uuid, jsonb) from public;
revoke all on function private.lock_student_attempt(uuid) from public;
revoke all on function private.start_test_attempt(uuid) from public;
revoke all on function private.save_test_answers(uuid, jsonb) from public;
revoke all on function private.submit_test_attempt(uuid, jsonb) from public;
revoke all on function private.expire_my_closed_attempts() from public;
revoke all on function private.student_paper(uuid) from public;
revoke all on function private.save_question(uuid, uuid, text, text, text, integer, text, text, jsonb, uuid) from public;
revoke all on function private.storage_folder_id(text) from public;

grant execute on function private.normalize_skills(text[]) to authenticated;
grant execute on function private.current_student_id() to authenticated;
grant execute on function private.teaches_subject(uuid) to authenticated;
grant execute on function private.publish_question_paper(uuid) to authenticated;
grant execute on function private.replace_attempt_answers(uuid, uuid, jsonb) to authenticated;
grant execute on function private.lock_student_attempt(uuid) to authenticated;
grant execute on function private.start_test_attempt(uuid) to authenticated;
grant execute on function private.save_test_answers(uuid, jsonb) to authenticated;
grant execute on function private.submit_test_attempt(uuid, jsonb) to authenticated;
grant execute on function private.expire_my_closed_attempts() to authenticated;
grant execute on function private.student_paper(uuid) to authenticated;
grant execute on function private.save_question(uuid, uuid, text, text, text, integer, text, text, jsonb, uuid) to authenticated;
grant execute on function private.storage_folder_id(text) to authenticated;

revoke all on function public.publish_question_paper(uuid) from public, anon;
revoke all on function public.start_test_attempt(uuid) from public, anon;
revoke all on function public.save_test_answers(uuid, jsonb) from public, anon;
revoke all on function public.submit_test_attempt(uuid, jsonb) from public, anon;
revoke all on function public.expire_my_closed_attempts() from public, anon;
revoke all on function public.student_paper(uuid) from public, anon;

grant execute on function public.publish_question_paper(uuid) to authenticated;
grant execute on function public.start_test_attempt(uuid) to authenticated;
grant execute on function public.save_test_answers(uuid, jsonb) to authenticated;
grant execute on function public.submit_test_attempt(uuid, jsonb) to authenticated;
grant execute on function public.expire_my_closed_attempts() to authenticated;
revoke all on function public.save_question(uuid, uuid, text, text, text, integer, text, text, jsonb) from public, anon;
grant execute on function public.student_paper(uuid) to authenticated;
grant execute on function public.save_question(uuid, uuid, text, text, text, integer, text, text, jsonb) to authenticated;

alter table public.student_resumes enable row level security;
alter table public.questions enable row level security;
alter table public.question_options enable row level security;
alter table public.question_papers enable row level security;
alter table public.question_paper_questions enable row level security;
alter table public.test_attempts enable row level security;
alter table public.student_answers enable row level security;
alter table public.learning_materials enable row level security;
alter table public.chat_sessions enable row level security;
alter table public.chat_messages enable row level security;
alter table public.ai_usage_logs enable row level security;

revoke all on public.student_resumes from public, anon;
revoke all on public.questions from public, anon;
revoke all on public.question_options from public, anon;
revoke all on public.question_papers from public, anon;
revoke all on public.question_paper_questions from public, anon;
revoke all on public.test_attempts from public, anon;
revoke all on public.student_answers from public, anon;
revoke all on public.learning_materials from public, anon;
revoke all on public.chat_sessions from public, anon;
revoke all on public.chat_messages from public, anon;
revoke all on public.ai_usage_logs from public, anon;

grant select, insert, update, delete on public.student_resumes to authenticated;
grant select, insert, update, delete on public.questions to authenticated;
grant select, insert, update, delete on public.question_options to authenticated;
grant select, insert, update, delete on public.question_papers to authenticated;
grant select, insert, update, delete on public.question_paper_questions to authenticated;
grant select on public.test_attempts to authenticated;
grant select on public.student_answers to authenticated;
grant select, insert, update, delete on public.learning_materials to authenticated;
grant select, insert, update, delete on public.chat_sessions to authenticated;
grant select, insert on public.chat_messages to authenticated;
grant select, insert on public.ai_usage_logs to authenticated;

create policy student_resumes_select on public.student_resumes
  for select to authenticated
  using (
    private.is_admin()
    or student_id = private.current_student_id()
    or exists (
      select 1
      from public.students
      where students.id = student_resumes.student_id
        and private.teaches_student(students.profile_id)
    )
  );

create policy student_resumes_write on public.student_resumes
  for all to authenticated
  using (private.is_admin() or student_id = private.current_student_id())
  with check (private.is_admin() or student_id = private.current_student_id());

create policy questions_staff on public.questions
  for all to authenticated
  using (private.teaches_subject(subject_id))
  with check (private.teaches_subject(subject_id));

create policy question_options_staff on public.question_options
  for all to authenticated
  using (
    exists (
      select 1
      from public.questions
      where questions.id = question_options.question_id
        and private.teaches_subject(questions.subject_id)
    )
  )
  with check (
    exists (
      select 1
      from public.questions
      where questions.id = question_options.question_id
        and private.teaches_subject(questions.subject_id)
    )
  );

create policy question_papers_staff on public.question_papers
  for all to authenticated
  using (private.teaches_subject(subject_id))
  with check (private.teaches_subject(subject_id));

create policy question_papers_student_select on public.question_papers
  for select to authenticated
  using (
    status = 'published'
    and exists (
      select 1
      from public.subjects
      join public.students on students.course_id = subjects.course_id
      where subjects.id = question_papers.subject_id
        and students.id = private.current_student_id()
        and students.course_id is not null
    )
  );

create policy question_links_staff on public.question_paper_questions
  for all to authenticated
  using (
    exists (
      select 1
      from public.question_papers
      where question_papers.id = question_paper_questions.paper_id
        and private.teaches_subject(question_papers.subject_id)
    )
  )
  with check (
    exists (
      select 1
      from public.question_papers
      where question_papers.id = question_paper_questions.paper_id
        and private.teaches_subject(question_papers.subject_id)
        and question_papers.status = 'draft'
    )
    and exists (
      select 1
      from public.questions
      join public.question_papers on question_papers.id = question_paper_questions.paper_id
      where questions.id = question_paper_questions.question_id
        and questions.subject_id = question_papers.subject_id
    )
  );

create policy test_attempts_select on public.test_attempts
  for select to authenticated
  using (
    student_id = private.current_student_id()
    or private.is_admin()
    or exists (
      select 1
      from public.question_papers
      where question_papers.id = test_attempts.paper_id
        and private.teaches_subject(question_papers.subject_id)
    )
  );

create policy student_answers_select on public.student_answers
  for select to authenticated
  using (
    exists (
      select 1
      from public.test_attempts
      where test_attempts.id = student_answers.attempt_id
        and (
          test_attempts.student_id = private.current_student_id()
          or private.is_admin()
          or exists (
            select 1
            from public.question_papers
            where question_papers.id = test_attempts.paper_id
              and private.teaches_subject(question_papers.subject_id)
          )
        )
    )
  );

create policy learning_materials_select on public.learning_materials
  for select to authenticated
  using (
    deleted_at is null
    and (
      private.teaches_subject(subject_id)
      or exists (
        select 1
        from public.subjects
        join public.students on students.course_id = subjects.course_id
        where subjects.id = learning_materials.subject_id
          and students.id = private.current_student_id()
          and students.course_id is not null
      )
    )
  );

create policy learning_materials_staff on public.learning_materials
  for all to authenticated
  using (private.teaches_subject(subject_id))
  with check (private.teaches_subject(subject_id));

create policy chat_sessions_own on public.chat_sessions
  for all to authenticated
  using (profile_id = (select auth.uid()))
  with check (
    profile_id = (select auth.uid())
    and role = private.current_role()
  );

create policy chat_messages_own on public.chat_messages
  for select to authenticated
  using (
    exists (
      select 1
      from public.chat_sessions
      where chat_sessions.id = chat_messages.session_id
        and chat_sessions.profile_id = (select auth.uid())
    )
  );

create policy chat_messages_insert_own on public.chat_messages
  for insert to authenticated
  with check (
    exists (
      select 1
      from public.chat_sessions
      where chat_sessions.id = chat_messages.session_id
        and chat_sessions.profile_id = (select auth.uid())
    )
  );

create policy ai_usage_logs_select on public.ai_usage_logs
  for select to authenticated
  using (profile_id = (select auth.uid()) or private.is_admin());

create policy ai_usage_logs_insert_own on public.ai_usage_logs
  for insert to authenticated
  with check (
    profile_id = (select auth.uid())
    and role = private.current_role()
  );

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('resumes', 'resumes', false, 5242880, array['application/pdf']::text[])
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('materials', 'materials', false, 10485760, array['application/pdf']::text[])
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create policy resumes_student_read on storage.objects
  for select to authenticated
  using (
    bucket_id = 'resumes'
    and (storage.foldername(name))[1] = private.current_student_id()::text
  );

create policy resumes_student_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'resumes'
    and (storage.foldername(name))[1] = private.current_student_id()::text
  );

create policy resumes_student_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'resumes'
    and (storage.foldername(name))[1] = private.current_student_id()::text
  )
  with check (
    bucket_id = 'resumes'
    and (storage.foldername(name))[1] = private.current_student_id()::text
  );

create policy resumes_student_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'resumes'
    and (storage.foldername(name))[1] = private.current_student_id()::text
  );

create policy resumes_teacher_read on storage.objects
  for select to authenticated
  using (
    bucket_id = 'resumes'
    and exists (
      select 1
      from public.students
      where students.id::text = (storage.foldername(name))[1]
        and private.teaches_student(students.profile_id)
    )
  );

create policy resumes_admin_all on storage.objects
  for all to authenticated
  using (bucket_id = 'resumes' and private.is_admin())
  with check (bucket_id = 'resumes' and private.is_admin());

create policy materials_staff_read on storage.objects
  for select to authenticated
  using (
    bucket_id = 'materials'
    and private.teaches_subject(private.storage_folder_id(name))
  );

create policy materials_staff_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'materials'
    and private.teaches_subject(private.storage_folder_id(name))
  );

create policy materials_staff_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'materials'
    and private.teaches_subject(private.storage_folder_id(name))
  )
  with check (
    bucket_id = 'materials'
    and private.teaches_subject(private.storage_folder_id(name))
  );

create policy materials_staff_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'materials'
    and private.teaches_subject(private.storage_folder_id(name))
  );

create policy materials_student_read on storage.objects
  for select to authenticated
  using (
    bucket_id = 'materials'
    and exists (
      select 1
      from public.subjects
      join public.students on students.course_id = subjects.course_id
      where subjects.id = private.storage_folder_id(name)
        and students.id = private.current_student_id()
        and students.course_id is not null
    )
  );


-- ===== 20261022073527_ai_practice.sql =====

-- Interview practice sessions and an all-or-nothing insert for AI question drafts.

create table public.interview_sessions (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  student_id uuid not null references public.students (id),
  drive_id uuid references public.placement_drives (id),
  role_title text not null check (pg_catalog.char_length(pg_catalog.btrim(role_title)) > 0),
  status text not null default 'in_progress' check (status in ('in_progress', 'completed')),
  main_count integer not null default 0 check (main_count between 0 and 5),
  follow_up_pending boolean not null default false,
  score integer check (score is null or score between 0 and 100),
  feedback text not null default '',
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now()
);

create unique index interview_sessions_one_active_idx
  on public.interview_sessions (student_id)
  where status = 'in_progress';

create index interview_sessions_student_id_idx on public.interview_sessions (student_id, created_at desc);

create trigger interview_sessions_set_updated_at
  before update on public.interview_sessions
  for each row execute function private.set_updated_at();

create table public.interview_turns (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  session_id uuid not null references public.interview_sessions (id) on delete cascade,
  ordinal integer not null check (ordinal >= 0),
  kind text not null check (kind in ('question', 'follow_up', 'answer')),
  content text not null check (pg_catalog.char_length(pg_catalog.btrim(content)) > 0),
  created_at timestamptz not null default pg_catalog.now(),
  unique (session_id, ordinal)
);

create index interview_turns_session_id_idx on public.interview_turns (session_id, ordinal);

create or replace function private.lock_my_interview(target_session uuid)
returns public.interview_sessions
language plpgsql
security definer
set search_path = ''
as $$
declare
  student uuid := private.current_student_id();
  session public.interview_sessions%rowtype;
begin
  if student is null then
    raise exception 'Your enrollment is not on file yet.';
  end if;

  select * into session
  from public.interview_sessions
  where id = target_session
  for update;

  if not found or session.student_id <> student then
    raise exception 'That interview could not be found.';
  end if;
  if session.status <> 'in_progress' then
    raise exception 'This interview is already finished.';
  end if;
  return session;
end;
$$;

create or replace function private.next_interview_ordinal(target_session uuid)
returns integer
language sql
security definer
set search_path = ''
as $$
  select coalesce(max(ordinal), -1) + 1
  from public.interview_turns
  where session_id = target_session
$$;

create or replace function private.begin_interview(target_drive uuid, requested_role text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  student uuid := private.current_student_id();
  role_title text := pg_catalog.btrim(coalesce(requested_role, ''));
  created uuid;
begin
  if student is null then
    raise exception 'Your enrollment is not on file yet.';
  end if;
  if exists (
    select 1
    from public.interview_sessions
    where student_id = student
      and status = 'in_progress'
  ) then
    raise exception 'You already have an interview in progress.';
  end if;

  if target_drive is not null then
    if not private.can_read_drive(target_drive) then
      raise exception 'Choose an open drive or type a role.';
    end if;
    select pg_catalog.btrim(drives.role_title) into role_title
    from public.placement_drives as drives
    where drives.id = target_drive
      and drives.deleted_at is null
      and drives.status = 'open';
    if role_title is null or role_title = '' then
      raise exception 'Choose an open drive or type a role.';
    end if;
  elsif role_title = '' then
    raise exception 'Choose an open drive or type a role.';
  end if;

  insert into public.interview_sessions (student_id, drive_id, role_title)
  values (student, target_drive, role_title)
  returning id into created;
  return created;
end;
$$;

create or replace function private.open_interview_question(target_session uuid, question_text text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  session public.interview_sessions%rowtype;
begin
  session := private.lock_my_interview(target_session);
  if session.main_count <> 0 or session.follow_up_pending then
    raise exception 'invalid interview turn';
  end if;
  if pg_catalog.btrim(coalesce(question_text, '')) = '' then
    raise exception 'invalid interview turn';
  end if;

  insert into public.interview_turns (session_id, ordinal, kind, content)
  values (session.id, private.next_interview_ordinal(session.id), 'question', pg_catalog.btrim(question_text));

  update public.interview_sessions
  set main_count = 1, follow_up_pending = false
  where id = session.id;
end;
$$;

create or replace function private.advance_interview(
  target_session uuid,
  answer_text text,
  turn_kind text,
  turn_text text,
  turn_score integer,
  turn_feedback text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  session public.interview_sessions%rowtype;
  answer_ordinal integer;
begin
  session := private.lock_my_interview(target_session);
  if pg_catalog.btrim(coalesce(answer_text, '')) = '' then
    raise exception 'Check the form and try again.';
  end if;

  if session.follow_up_pending then
    if session.main_count = 5 then
      if turn_kind <> 'result' then
        raise exception 'invalid interview turn';
      end if;
    elsif turn_kind <> 'question' then
      raise exception 'invalid interview turn';
    end if;
  elsif session.main_count < 5 then
    if turn_kind not in ('follow_up', 'question') then
      raise exception 'invalid interview turn';
    end if;
  elsif turn_kind not in ('follow_up', 'result') then
    raise exception 'invalid interview turn';
  end if;

  if turn_kind = 'result' then
    if turn_score is null or turn_score < 0 or turn_score > 100 or pg_catalog.btrim(coalesce(turn_feedback, '')) = '' then
      raise exception 'invalid interview turn';
    end if;
  elsif pg_catalog.btrim(coalesce(turn_text, '')) = '' then
    raise exception 'invalid interview turn';
  end if;

  answer_ordinal := private.next_interview_ordinal(session.id);
  insert into public.interview_turns (session_id, ordinal, kind, content)
  values (session.id, answer_ordinal, 'answer', pg_catalog.btrim(answer_text));

  if turn_kind = 'result' then
    update public.interview_sessions
    set status = 'completed',
        score = turn_score,
        feedback = pg_catalog.btrim(turn_feedback),
        follow_up_pending = false
    where id = session.id;
    return;
  end if;

  insert into public.interview_turns (session_id, ordinal, kind, content)
  values (session.id, answer_ordinal + 1, turn_kind, pg_catalog.btrim(turn_text));

  if turn_kind = 'follow_up' then
    update public.interview_sessions
    set follow_up_pending = true
    where id = session.id;
  else
    update public.interview_sessions
    set main_count = session.main_count + 1,
        follow_up_pending = false
    where id = session.id;
  end if;
end;
$$;

create or replace function private.save_ai_questions(target_subject uuid, questions jsonb)
returns uuid[]
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  item jsonb;
  option_item jsonb;
  saved uuid;
  ids uuid[] := array[]::uuid[];
  ordinal integer;
  labels text[] := array['A', 'B', 'C', 'D', 'E', 'F'];
begin
  if actor is null or not private.teaches_subject(target_subject) then
    raise exception 'You do not have permission to edit this question.';
  end if;
  if questions is null or pg_catalog.jsonb_typeof(questions) <> 'array' or pg_catalog.jsonb_array_length(questions) < 1 then
    raise exception 'invalid question batch';
  end if;

  for item in select elements.value from pg_catalog.jsonb_array_elements(questions) as elements(value) loop
    insert into public.questions (
      subject_id, topic, question_type, difficulty, marks, stem, explanation, created_by, source
    )
    values (
      target_subject,
      coalesce(item ->> 'topic', ''),
      item ->> 'questionType',
      item ->> 'difficulty',
      (item ->> 'marks')::integer,
      coalesce(item ->> 'stem', ''),
      coalesce(item ->> 'explanation', ''),
      actor,
      'ai'
    )
    returning id into saved;

    ordinal := 0;
    for option_item in select elements.value from pg_catalog.jsonb_array_elements(item -> 'options') as elements(value) loop
      insert into public.question_options (question_id, label, option_text, is_correct, ordinal)
      values (
        saved,
        labels[ordinal + 1],
        coalesce(option_item ->> 'body', ''),
        coalesce((option_item ->> 'isCorrect')::boolean, false),
        ordinal
      );
      ordinal := ordinal + 1;
    end loop;
    ids := ids || saved;
  end loop;

  return ids;
end;
$$;

create or replace function private.cancel_empty_interview(target_session uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  student uuid := private.current_student_id();
begin
  if student is null then
    return;
  end if;
  delete from public.interview_sessions
  where id = target_session
    and student_id = student
    and status = 'in_progress'
    and main_count = 0;
end;
$$;

create or replace function public.begin_interview(target_drive uuid, requested_role text)
returns uuid
language sql
security invoker
set search_path = ''
as $$
  select private.begin_interview(target_drive, requested_role)
$$;

create or replace function public.open_interview_question(target_session uuid, question_text text)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  perform private.open_interview_question(target_session, question_text);
end;
$$;

create or replace function public.advance_interview(
  target_session uuid,
  answer_text text,
  turn_kind text,
  turn_text text,
  turn_score integer,
  turn_feedback text
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  perform private.advance_interview(target_session, answer_text, turn_kind, turn_text, turn_score, turn_feedback);
end;
$$;

create or replace function public.cancel_empty_interview(target_session uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  perform private.cancel_empty_interview(target_session);
end;
$$;

create or replace function public.save_ai_questions(target_subject uuid, questions jsonb)
returns uuid[]
language sql
security invoker
set search_path = ''
as $$
  select private.save_ai_questions(target_subject, questions)
$$;

revoke all on function private.lock_my_interview(uuid) from public;
revoke all on function private.next_interview_ordinal(uuid) from public;
revoke all on function private.begin_interview(uuid, text) from public;
revoke all on function private.open_interview_question(uuid, text) from public;
revoke all on function private.advance_interview(uuid, text, text, text, integer, text) from public;
revoke all on function private.save_ai_questions(uuid, jsonb) from public;
grant execute on function private.lock_my_interview(uuid) to authenticated;
grant execute on function private.next_interview_ordinal(uuid) to authenticated;
grant execute on function private.begin_interview(uuid, text) to authenticated;
grant execute on function private.open_interview_question(uuid, text) to authenticated;
grant execute on function private.advance_interview(uuid, text, text, text, integer, text) to authenticated;
revoke all on function private.cancel_empty_interview(uuid) from public;
grant execute on function private.cancel_empty_interview(uuid) to authenticated;
grant execute on function private.save_ai_questions(uuid, jsonb) to authenticated;

revoke all on function public.cancel_empty_interview(uuid) from public, anon;
grant execute on function public.cancel_empty_interview(uuid) to authenticated;

revoke all on function public.begin_interview(uuid, text) from public, anon;
revoke all on function public.open_interview_question(uuid, text) from public, anon;
revoke all on function public.advance_interview(uuid, text, text, text, integer, text) from public, anon;
revoke all on function public.save_ai_questions(uuid, jsonb) from public, anon;
grant execute on function public.begin_interview(uuid, text) to authenticated;
grant execute on function public.open_interview_question(uuid, text) to authenticated;
grant execute on function public.advance_interview(uuid, text, text, text, integer, text) to authenticated;
grant execute on function public.save_ai_questions(uuid, jsonb) to authenticated;

alter table public.interview_sessions enable row level security;
alter table public.interview_turns enable row level security;

revoke all on public.interview_sessions from public, anon;
revoke all on public.interview_turns from public, anon;
grant select on public.interview_sessions to authenticated;
grant select on public.interview_turns to authenticated;

create policy interview_sessions_own on public.interview_sessions
  for select to authenticated
  using (student_id = private.current_student_id());

create policy interview_turns_own on public.interview_turns
  for select to authenticated
  using (
    exists (
      select 1
      from public.interview_sessions
      where interview_sessions.id = interview_turns.session_id
        and interview_sessions.student_id = private.current_student_id()
    )
  );


-- ===== 20261022082347_role_chat.sql =====

-- Exam marks, searchable passages, score reads, and a one-step chat save.

create table public.exam_marks (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  student_id uuid not null references public.students (id),
  subject_id uuid not null references public.subjects (id),
  exam_name text not null check (pg_catalog.char_length(pg_catalog.btrim(exam_name)) > 0),
  exam_key text not null,
  score integer not null,
  maximum integer not null check (maximum between 1 and 100),
  entered_by uuid not null references public.profiles (id),
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  unique (student_id, subject_id, exam_key),
  check (score between 0 and maximum)
);

create index exam_marks_subject_id_idx on public.exam_marks (subject_id);

create trigger exam_marks_set_updated_at
  before update on public.exam_marks
  for each row execute function private.set_updated_at();

create table public.material_passages (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  material_id uuid not null references public.learning_materials (id) on delete cascade,
  ordinal integer not null check (ordinal >= 0),
  content text not null check (pg_catalog.char_length(content) > 0 and pg_catalog.char_length(content) <= 1200),
  provider text not null check (provider in ('gemini', 'openai')),
  embedding jsonb not null,
  unique (material_id, ordinal)
);

create index material_passages_material_id_idx on public.material_passages (material_id);

create or replace function private.keep_material_search_flag()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.kind = 'link' then
    new.approved_for_rag := false;
  elsif new.approved_for_rag and not exists (
    select 1 from public.material_passages where material_id = new.id
  ) then
    new.approved_for_rag := false;
  end if;
  return new;
end;
$$;

create trigger learning_materials_search_flag
  before insert or update on public.learning_materials
  for each row execute function private.keep_material_search_flag();

create or replace function private.save_exam_marks(rows jsonb)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  item jsonb;
  roll text;
  code text;
  exam text;
  key text;
  mark_score integer;
  mark_max integer;
  student uuid;
  course uuid;
  subject uuid;
  saved integer := 0;
begin
  if actor is null or pg_catalog.jsonb_typeof(rows) <> 'array' or pg_catalog.jsonb_array_length(rows) < 1 then
    raise exception 'Check the exam marks and try again.';
  end if;

  for item in select elements.value from pg_catalog.jsonb_array_elements(rows) as elements(value) loop
    roll := pg_catalog.btrim(coalesce(item ->> 'rollNumber', ''));
    code := pg_catalog.btrim(coalesce(item ->> 'subjectCode', ''));
    exam := pg_catalog.btrim(coalesce(item ->> 'examName', ''));
    key := pg_catalog.lower(exam);
    mark_score := (item ->> 'score')::integer;
    mark_max := (item ->> 'maximum')::integer;
    if roll = '' or code = '' or exam = '' or mark_max < 1 or mark_max > 100 or mark_score < 0 or mark_score > mark_max then
      raise exception 'Check the exam marks and try again.';
    end if;

    select students.id, students.course_id into student, course
    from public.students
    where students.roll_number = roll
      and students.deleted_at is null
      and students.is_active
      and students.course_id is not null;

    if student is null then
      raise exception 'Check the exam marks and try again.';
    end if;

    select subjects.id into subject
    from public.subjects
    where subjects.course_id = course
      and subjects.code = code
      and subjects.deleted_at is null
      and subjects.is_active;

    if subject is null then
      raise exception 'Check the exam marks and try again.';
    end if;
    if not private.is_admin() and not private.teaches_subject(subject) then
      raise exception 'You do not have permission to edit this question.';
    end if;

    insert into public.exam_marks (student_id, subject_id, exam_name, exam_key, score, maximum, entered_by)
    values (student, subject, exam, key, mark_score, mark_max, actor)
    on conflict (student_id, subject_id, exam_key)
    do update set exam_name = excluded.exam_name, score = excluded.score, maximum = excluded.maximum, entered_by = excluded.entered_by;
    saved := saved + 1;
  end loop;

  return saved;
end;
$$;

create or replace function private.replace_material_passages(target_material uuid, target_provider text, passages jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  subject uuid;
  item jsonb;
begin
  if target_provider not in ('gemini', 'openai') or pg_catalog.jsonb_typeof(passages) <> 'array' or pg_catalog.jsonb_array_length(passages) < 1 then
    raise exception 'invalid passages';
  end if;

  select learning_materials.subject_id into subject
  from public.learning_materials
  where learning_materials.id = target_material
    and learning_materials.deleted_at is null
    and learning_materials.kind = 'pdf';

  if subject is null or not private.teaches_subject(subject) then
    raise exception 'You do not have permission to edit this question.';
  end if;

  delete from public.material_passages where material_id = target_material;

  for item in select elements.value from pg_catalog.jsonb_array_elements(passages) as elements(value) loop
    insert into public.material_passages (material_id, ordinal, content, provider, embedding)
    values (
      target_material,
      (item ->> 'ordinal')::integer,
      item ->> 'content',
      target_provider,
      item -> 'embedding'
    );
  end loop;

  update public.learning_materials
  set approved_for_rag = true
  where id = target_material;
end;
$$;

create or replace function private.own_quiz_scores()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
    'title', papers.title,
    'score', attempts.score,
    'maxScore', attempts.max_score,
    'submittedAt', attempts.submitted_at
  ) order by attempts.submitted_at desc), '[]'::jsonb)
  from public.test_attempts as attempts
  join public.question_papers as papers on papers.id = attempts.paper_id
  where attempts.student_id = private.current_student_id()
    and attempts.status = 'submitted'
$$;

create or replace function private.taught_quiz_scores()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
    'rollNumber', students.roll_number,
    'title', papers.title,
    'score', attempts.score,
    'maxScore', attempts.max_score,
    'submittedAt', attempts.submitted_at
  ) order by attempts.submitted_at desc), '[]'::jsonb)
  from public.test_attempts as attempts
  join public.students as students on students.id = attempts.student_id
  join public.question_papers as papers on papers.id = attempts.paper_id
  where attempts.status = 'submitted'
    and private.teaches_course(students.course_id)
    and private.teaches_subject(papers.subject_id)
$$;

create or replace function private.save_chat_exchange(target_session uuid, user_text text, assistant_text text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  actor_role text := private.current_role();
  session uuid := target_session;
begin
  if actor is null or actor_role not in ('admin', 'teacher', 'student') then
    raise exception 'Check the form and try again.';
  end if;
  if pg_catalog.char_length(pg_catalog.btrim(user_text)) < 1
    or pg_catalog.char_length(user_text) > 2000
    or pg_catalog.char_length(pg_catalog.btrim(assistant_text)) < 1 then
    raise exception 'Check the form and try again.';
  end if;

  if session is null then
    insert into public.chat_sessions (profile_id, role, feature)
    values (actor, actor_role, 'assistant')
    returning id into session;
  elsif not exists (
    select 1 from public.chat_sessions
    where id = session and profile_id = actor and role = actor_role
  ) then
    raise exception 'That chat could not be found.';
  end if;

  insert into public.chat_messages (session_id, role, content)
  values (session, 'user', pg_catalog.btrim(user_text)), (session, 'assistant', pg_catalog.btrim(assistant_text));
  return session;
end;
$$;

create or replace function public.save_exam_marks(rows jsonb)
returns integer
language sql
security invoker
set search_path = ''
as $$
  select private.save_exam_marks(rows)
$$;

create or replace function public.replace_material_passages(target_material uuid, target_provider text, passages jsonb)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  perform private.replace_material_passages(target_material, target_provider, passages);
end;
$$;

create or replace function public.own_quiz_scores()
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.own_quiz_scores()
$$;

create or replace function public.taught_quiz_scores()
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.taught_quiz_scores()
$$;

create or replace function public.save_chat_exchange(target_session uuid, user_text text, assistant_text text)
returns uuid
language sql
security invoker
set search_path = ''
as $$
  select private.save_chat_exchange(target_session, user_text, assistant_text)
$$;

revoke all on function private.save_exam_marks(jsonb) from public;
revoke all on function private.replace_material_passages(uuid, text, jsonb) from public;
revoke all on function private.own_quiz_scores() from public;
revoke all on function private.taught_quiz_scores() from public;
revoke all on function private.save_chat_exchange(uuid, text, text) from public;
grant execute on function private.save_exam_marks(jsonb) to authenticated;
grant execute on function private.replace_material_passages(uuid, text, jsonb) to authenticated;
grant execute on function private.own_quiz_scores() to authenticated;
grant execute on function private.taught_quiz_scores() to authenticated;
grant execute on function private.save_chat_exchange(uuid, text, text) to authenticated;

revoke all on function public.save_exam_marks(jsonb) from public, anon;
revoke all on function public.replace_material_passages(uuid, text, jsonb) from public, anon;
revoke all on function public.own_quiz_scores() from public, anon;
revoke all on function public.taught_quiz_scores() from public, anon;
revoke all on function public.save_chat_exchange(uuid, text, text) from public, anon;
grant execute on function public.save_exam_marks(jsonb) to authenticated;
grant execute on function public.replace_material_passages(uuid, text, jsonb) to authenticated;
grant execute on function public.own_quiz_scores() to authenticated;
grant execute on function public.taught_quiz_scores() to authenticated;
grant execute on function public.save_chat_exchange(uuid, text, text) to authenticated;

alter table public.exam_marks enable row level security;
alter table public.material_passages enable row level security;

revoke all on public.exam_marks from public, anon;
revoke all on public.material_passages from public, anon;
grant select on public.exam_marks to authenticated;
grant select on public.material_passages to authenticated;

create policy exam_marks_select on public.exam_marks
  for select to authenticated
  using (
    private.is_admin()
    or student_id = private.current_student_id()
    or (
      private.teaches_subject(subject_id)
      and exists (
        select 1
        from public.students
        where students.id = exam_marks.student_id
          and private.teaches_student(students.profile_id)
      )
    )
  );

create policy material_passages_select on public.material_passages
  for select to authenticated
  using (
    exists (
      select 1
      from public.learning_materials
      where learning_materials.id = material_passages.material_id
        and learning_materials.deleted_at is null
        and learning_materials.approved_for_rag
    )
  );


-- ===== 20261022101040_ollama_provider.sql =====

-- Allow locally embedded passages when AI_PROVIDER is ollama.

alter table public.material_passages
  drop constraint if exists material_passages_provider_check;

alter table public.material_passages
  add constraint material_passages_provider_check
  check (provider in ('gemini', 'openai', 'ollama'));

create or replace function private.replace_material_passages(target_material uuid, target_provider text, passages jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  subject uuid;
  item jsonb;
begin
  if target_provider not in ('gemini', 'openai', 'ollama') or pg_catalog.jsonb_typeof(passages) <> 'array' or pg_catalog.jsonb_array_length(passages) < 1 then
    raise exception 'invalid passages';
  end if;

  select learning_materials.subject_id into subject
  from public.learning_materials
  where learning_materials.id = target_material
    and learning_materials.deleted_at is null
    and learning_materials.kind = 'pdf';

  if subject is null or not private.teaches_subject(subject) then
    raise exception 'You do not have permission to edit this question.';
  end if;

  delete from public.material_passages where material_id = target_material;

  for item in select elements.value from pg_catalog.jsonb_array_elements(passages) as elements(value) loop
    insert into public.material_passages (material_id, ordinal, content, provider, embedding)
    values (
      target_material,
      (item ->> 'ordinal')::integer,
      item ->> 'content',
      target_provider,
      item -> 'embedding'
    );
  end loop;

  update public.learning_materials
  set approved_for_rag = true
  where id = target_material;
end;
$$;


-- ===== 20261023110145_admin_chat_proposals.sql =====

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


-- ===== 20261024120000_chat_message_widgets.sql =====

alter table public.chat_messages
  add column widgets jsonb not null default '[]'::jsonb;

alter table public.chat_messages
  add constraint chat_messages_widgets_array check (jsonb_typeof(widgets) = 'array');

drop function if exists public.save_chat_exchange(uuid, text, text);
drop function if exists private.save_chat_exchange(uuid, text, text);

create function private.save_chat_exchange(
  target_session uuid,
  user_text text,
  assistant_text text,
  assistant_widgets jsonb default '[]'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  actor_role text := private.current_role();
  session uuid := target_session;
begin
  if actor is null or actor_role not in ('admin', 'teacher', 'student') then
    raise exception 'Check the form and try again.';
  end if;
  if pg_catalog.char_length(pg_catalog.btrim(user_text)) < 1
    or pg_catalog.char_length(user_text) > 2000
    or pg_catalog.char_length(pg_catalog.btrim(assistant_text)) < 1
    or assistant_widgets is null
    or jsonb_typeof(assistant_widgets) <> 'array' then
    raise exception 'Check the form and try again.';
  end if;

  if session is null then
    insert into public.chat_sessions (profile_id, role, feature)
    values (actor, actor_role, 'assistant')
    returning id into session;
  elsif not exists (
    select 1 from public.chat_sessions
    where id = session and profile_id = actor and role = actor_role
  ) then
    raise exception 'That chat could not be found.';
  end if;

  insert into public.chat_messages (session_id, role, content)
  values (session, 'user', pg_catalog.btrim(user_text));
  insert into public.chat_messages (session_id, role, content, widgets)
  values (session, 'assistant', pg_catalog.btrim(assistant_text), assistant_widgets);
  return session;
end;
$$;

create function public.save_chat_exchange(
  target_session uuid,
  user_text text,
  assistant_text text,
  assistant_widgets jsonb default '[]'::jsonb
)
returns uuid
language sql
security invoker
set search_path = ''
as $$
  select private.save_chat_exchange(target_session, user_text, assistant_text, assistant_widgets)
$$;

create function private.settle_chat_widget(target_proposal uuid, result_text text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
begin
  if actor is null or not private.is_admin() then
    raise exception 'Check the form and try again.';
  end if;
  if target_proposal is null
    or pg_catalog.char_length(pg_catalog.btrim(result_text)) < 1
    or pg_catalog.char_length(result_text) > 500 then
    raise exception 'Check the form and try again.';
  end if;

  update public.chat_messages as messages
  set widgets = (
    select coalesce(jsonb_agg(
      case
        when widget->>'kind' = 'form' and widget->>'proposalId' = target_proposal::text
        then widget || jsonb_build_object('result', pg_catalog.btrim(result_text))
        else widget
      end
    ), '[]'::jsonb)
    from jsonb_array_elements(messages.widgets) as widget
  )
  where messages.role = 'assistant'
    and exists (
      select 1
      from public.chat_sessions as sessions
      where sessions.id = messages.session_id
        and sessions.profile_id = actor
    )
    and messages.widgets @> jsonb_build_array(jsonb_build_object('proposalId', target_proposal::text));
end;
$$;

create function public.settle_chat_widget(target_proposal uuid, result_text text)
returns void
language sql
security invoker
set search_path = ''
as $$
  select private.settle_chat_widget(target_proposal, result_text)
$$;

revoke all on function private.save_chat_exchange(uuid, text, text, jsonb) from public;
revoke all on function private.settle_chat_widget(uuid, text) from public;
grant execute on function private.save_chat_exchange(uuid, text, text, jsonb) to authenticated;
grant execute on function private.settle_chat_widget(uuid, text) to authenticated;

revoke all on function public.save_chat_exchange(uuid, text, text, jsonb) from public, anon;
revoke all on function public.settle_chat_widget(uuid, text) from public, anon;
grant execute on function public.save_chat_exchange(uuid, text, text, jsonb) to authenticated;
grant execute on function public.settle_chat_widget(uuid, text) to authenticated;


-- ===== 20261024133000_resume_skill_execute.sql =====

-- student_resumes and placement_drives normalize skills in a trigger.
-- That trigger runs as the signed-in user, so authenticated needs execute.
grant execute on function private.normalize_skills(text[]) to authenticated;


-- ===== 20261025120000_interview_report.sql =====

-- Structured interview reports are written only after the last answer is stored.

alter table public.interview_sessions
  drop constraint if exists interview_sessions_status_check;

alter table public.interview_sessions
  add constraint interview_sessions_status_check
  check (status in ('in_progress', 'awaiting_report', 'completed'));

alter table public.interview_sessions
  add column report jsonb;

alter table public.interview_sessions
  drop constraint if exists interview_sessions_report_check;

alter table public.interview_sessions
  add constraint interview_sessions_report_check
  check (report is null or pg_catalog.jsonb_typeof(report) = 'object');

drop index if exists public.interview_sessions_one_active_idx;

create unique index interview_sessions_one_active_idx
  on public.interview_sessions (student_id)
  where status in ('in_progress', 'awaiting_report');

create or replace function private.begin_interview(target_drive uuid, requested_role text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  student uuid := private.current_student_id();
  role_title text := pg_catalog.btrim(coalesce(requested_role, ''));
  created uuid;
begin
  if student is null then
    raise exception 'Your enrollment is not on file yet.';
  end if;
  if exists (
    select 1
    from public.interview_sessions
    where student_id = student
      and status in ('in_progress', 'awaiting_report')
  ) then
    raise exception 'You already have an interview in progress.';
  end if;

  if target_drive is not null then
    if not private.can_read_drive(target_drive) then
      raise exception 'Choose an open drive or type a role.';
    end if;
    select pg_catalog.btrim(drives.role_title) into role_title
    from public.placement_drives as drives
    where drives.id = target_drive
      and drives.deleted_at is null
      and drives.status = 'open';
    if role_title is null or role_title = '' then
      raise exception 'Choose an open drive or type a role.';
    end if;
  elsif role_title = '' then
    raise exception 'Choose an open drive or type a role.';
  end if;

  insert into public.interview_sessions (student_id, drive_id, role_title)
  values (student, target_drive, role_title)
  returning id into created;
  return created;
end;
$$;

create or replace function private.advance_interview(
  target_session uuid,
  answer_text text,
  turn_kind text,
  turn_text text,
  turn_score integer,
  turn_feedback text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  session public.interview_sessions%rowtype;
  answer_ordinal integer;
begin
  session := private.lock_my_interview(target_session);
  if pg_catalog.btrim(coalesce(answer_text, '')) = '' then
    raise exception 'Check the form and try again.';
  end if;

  if turn_kind = 'result' then
    raise exception 'invalid interview turn';
  end if;

  if session.follow_up_pending then
    if session.main_count = 5 or turn_kind <> 'question' then
      raise exception 'invalid interview turn';
    end if;
  elsif session.main_count < 5 then
    if turn_kind not in ('follow_up', 'question') then
      raise exception 'invalid interview turn';
    end if;
  elsif turn_kind <> 'follow_up' then
    raise exception 'invalid interview turn';
  end if;

  if pg_catalog.btrim(coalesce(turn_text, '')) = '' then
    raise exception 'invalid interview turn';
  end if;

  answer_ordinal := private.next_interview_ordinal(session.id);
  insert into public.interview_turns (session_id, ordinal, kind, content)
  values (session.id, answer_ordinal, 'answer', pg_catalog.btrim(answer_text));

  insert into public.interview_turns (session_id, ordinal, kind, content)
  values (session.id, answer_ordinal + 1, turn_kind, pg_catalog.btrim(turn_text));

  if turn_kind = 'follow_up' then
    update public.interview_sessions
    set follow_up_pending = true
    where id = session.id;
  else
    update public.interview_sessions
    set main_count = session.main_count + 1,
        follow_up_pending = false
    where id = session.id;
  end if;
end;
$$;

create or replace function private.close_interview(target_session uuid, answer_text text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  session public.interview_sessions%rowtype;
begin
  session := private.lock_my_interview(target_session);
  if session.main_count <> 5 then
    raise exception 'invalid interview turn';
  end if;
  if pg_catalog.btrim(coalesce(answer_text, '')) = '' then
    raise exception 'Check the form and try again.';
  end if;

  insert into public.interview_turns (session_id, ordinal, kind, content)
  values (session.id, private.next_interview_ordinal(session.id), 'answer', pg_catalog.btrim(answer_text));

  update public.interview_sessions
  set status = 'awaiting_report',
      follow_up_pending = false
  where id = session.id;
end;
$$;

create or replace function private.save_interview_report(
  target_session uuid,
  report_body jsonb,
  turn_score integer,
  summary text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  student uuid := private.current_student_id();
  session public.interview_sessions%rowtype;
begin
  if student is null then
    raise exception 'Your enrollment is not on file yet.';
  end if;
  if report_body is null or pg_catalog.jsonb_typeof(report_body) <> 'object' then
    raise exception 'invalid interview turn';
  end if;
  if turn_score is null or turn_score < 0 or turn_score > 100 or pg_catalog.btrim(coalesce(summary, '')) = '' then
    raise exception 'invalid interview turn';
  end if;

  select * into session
  from public.interview_sessions
  where id = target_session
  for update;

  if not found or session.student_id <> student then
    raise exception 'That interview could not be found.';
  end if;
  if session.status <> 'awaiting_report' then
    raise exception 'This interview is already finished.';
  end if;

  update public.interview_sessions
  set status = 'completed',
      score = turn_score,
      feedback = pg_catalog.btrim(summary),
      report = report_body,
      follow_up_pending = false
  where id = session.id;
end;
$$;

create or replace function public.close_interview(target_session uuid, answer_text text)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  perform private.close_interview(target_session, answer_text);
end;
$$;

create or replace function public.save_interview_report(
  target_session uuid,
  report_body jsonb,
  turn_score integer,
  summary text
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  perform private.save_interview_report(target_session, report_body, turn_score, summary);
end;
$$;

revoke all on function private.close_interview(uuid, text) from public;
revoke all on function private.save_interview_report(uuid, jsonb, integer, text) from public;
grant execute on function private.close_interview(uuid, text) to authenticated;
grant execute on function private.save_interview_report(uuid, jsonb, integer, text) to authenticated;

revoke all on function public.close_interview(uuid, text) from public, anon;
revoke all on function public.save_interview_report(uuid, jsonb, integer, text) from public, anon;
grant execute on function public.close_interview(uuid, text) to authenticated;
grant execute on function public.save_interview_report(uuid, jsonb, integer, text) to authenticated;


-- ===== 20261025133000_interview_report_param.sql =====

-- The report argument shared a name with interview_sessions.report, so the save failed.
-- Postgres cannot rename an argument with CREATE OR REPLACE, so drop both functions first.

drop function if exists public.save_interview_report(uuid, jsonb, integer, text);
drop function if exists private.save_interview_report(uuid, jsonb, integer, text);

create or replace function private.save_interview_report(
  target_session uuid,
  report_body jsonb,
  turn_score integer,
  summary text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  student uuid := private.current_student_id();
  session public.interview_sessions%rowtype;
begin
  if student is null then
    raise exception 'Your enrollment is not on file yet.';
  end if;
  if report_body is null or pg_catalog.jsonb_typeof(report_body) <> 'object' then
    raise exception 'invalid interview turn';
  end if;
  if turn_score is null or turn_score < 0 or turn_score > 100 or pg_catalog.btrim(coalesce(summary, '')) = '' then
    raise exception 'invalid interview turn';
  end if;

  select * into session
  from public.interview_sessions
  where id = target_session
  for update;

  if not found or session.student_id <> student then
    raise exception 'That interview could not be found.';
  end if;
  if session.status <> 'awaiting_report' then
    raise exception 'This interview is already finished.';
  end if;

  update public.interview_sessions
  set status = 'completed',
      score = turn_score,
      feedback = pg_catalog.btrim(summary),
      report = report_body,
      follow_up_pending = false
  where id = session.id;
end;
$$;

create or replace function public.save_interview_report(
  target_session uuid,
  report_body jsonb,
  turn_score integer,
  summary text
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  perform private.save_interview_report(target_session, report_body, turn_score, summary);
end;
$$;

revoke all on function private.save_interview_report(uuid, jsonb, integer, text) from public;
revoke all on function public.save_interview_report(uuid, jsonb, integer, text) from public, anon;
grant execute on function private.save_interview_report(uuid, jsonb, integer, text) to authenticated;
grant execute on function public.save_interview_report(uuid, jsonb, integer, text) to authenticated;


-- ===== 20261026103000_teacher_read_own_subjects.sql =====

-- A teacher must be able to read their own staff row and assigned subjects.
-- The subject list is filtered with those ids. Papers and questions use the same set.

create or replace function private.current_teacher_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select teachers.id
  from public.teachers
  where teachers.profile_id = (select auth.uid())
    and teachers.deleted_at is null
  limit 1
$$;

revoke all on function private.current_teacher_id() from public;
grant execute on function private.current_teacher_id() to authenticated;

drop policy if exists teachers_select_own on public.teachers;
create policy teachers_select_own on public.teachers
  for select to authenticated
  using (id = (select private.current_teacher_id()));

drop policy if exists teacher_subjects_select_own on public.teacher_subjects;
create policy teacher_subjects_select_own on public.teacher_subjects
  for select to authenticated
  using (teacher_id = (select private.current_teacher_id()));


-- ===== 20261026140000_exam_papers.sql =====

-- Written exam papers for staff. Students never read these tables.

create table public.exam_papers (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  subject_id uuid not null references public.subjects (id),
  title text not null check (pg_catalog.char_length(pg_catalog.btrim(title)) > 0 and pg_catalog.char_length(title) <= 160),
  topics text not null check (pg_catalog.char_length(pg_catalog.btrim(topics)) > 0 and pg_catalog.char_length(topics) <= 500),
  difficulty text not null check (difficulty in ('easy', 'medium', 'hard')),
  total_marks integer not null check (total_marks > 0),
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now()
);

create index exam_papers_subject_id_idx on public.exam_papers (subject_id, created_at desc);

create trigger exam_papers_set_updated_at
  before update on public.exam_papers
  for each row execute function private.set_updated_at();

create table public.exam_paper_questions (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  paper_id uuid not null references public.exam_papers (id) on delete cascade,
  section_marks integer not null check (section_marks in (1, 2, 5, 20)),
  ordinal integer not null check (ordinal >= 0),
  stem text not null check (pg_catalog.char_length(pg_catalog.btrim(stem)) > 0),
  unique (paper_id, ordinal)
);

create index exam_paper_questions_paper_id_idx on public.exam_paper_questions (paper_id);

create or replace function private.save_exam_paper(paper jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  target_subject uuid;
  paper_title text;
  paper_topics text;
  paper_difficulty text;
  item jsonb;
  saved uuid;
  ordinal integer := 0;
  total integer := 0;
  section_marks integer;
  stem text;
begin
  if actor is null or paper is null or pg_catalog.jsonb_typeof(paper) <> 'object' then
    raise exception 'You do not have permission to edit this question.';
  end if;

  target_subject := (paper ->> 'subjectId')::uuid;
  if not private.teaches_subject(target_subject) then
    raise exception 'You do not have permission to edit this question.';
  end if;

  paper_title := pg_catalog.btrim(coalesce(paper ->> 'title', ''));
  paper_topics := pg_catalog.btrim(coalesce(paper ->> 'topics', ''));
  paper_difficulty := paper ->> 'difficulty';
  if pg_catalog.char_length(paper_title) < 1
    or pg_catalog.char_length(paper_title) > 160
    or pg_catalog.char_length(paper_topics) < 1
    or pg_catalog.char_length(paper_topics) > 500
    or paper_difficulty not in ('easy', 'medium', 'hard')
    or pg_catalog.jsonb_typeof(paper -> 'questions') <> 'array'
    or pg_catalog.jsonb_array_length(paper -> 'questions') < 1
    or pg_catalog.jsonb_array_length(paper -> 'questions') > 30
  then
    raise exception 'Check the form and try again.';
  end if;

  insert into public.exam_papers (subject_id, title, topics, difficulty, total_marks, created_by)
  values (target_subject, paper_title, paper_topics, paper_difficulty, 1, actor)
  returning id into saved;

  for item in select elements.value from pg_catalog.jsonb_array_elements(paper -> 'questions') as elements(value) loop
    if pg_catalog.jsonb_typeof(item) <> 'object'
      or pg_catalog.jsonb_typeof(item -> 'sectionMarks') <> 'number'
    then
      raise exception 'Check the form and try again.';
    end if;
    section_marks := (item ->> 'sectionMarks')::integer;
    stem := pg_catalog.btrim(coalesce(item ->> 'stem', ''));
    if section_marks not in (1, 2, 5, 20) or pg_catalog.char_length(stem) < 1 then
      raise exception 'Check the form and try again.';
    end if;
    insert into public.exam_paper_questions (paper_id, section_marks, ordinal, stem)
    values (saved, section_marks, ordinal, stem);
    total := total + section_marks;
    ordinal := ordinal + 1;
  end loop;

  update public.exam_papers set total_marks = total where id = saved;
  return saved;
end;
$$;

create or replace function public.save_exam_paper(paper jsonb)
returns uuid
language sql
security invoker
set search_path = ''
as $$
  select private.save_exam_paper(paper)
$$;

revoke all on function private.save_exam_paper(jsonb) from public;
grant execute on function private.save_exam_paper(jsonb) to authenticated;
revoke all on function public.save_exam_paper(jsonb) from public, anon;
grant execute on function public.save_exam_paper(jsonb) to authenticated;

alter table public.exam_papers enable row level security;
alter table public.exam_paper_questions enable row level security;

revoke all on public.exam_papers from public, anon;
revoke all on public.exam_paper_questions from public, anon;
grant select, delete on public.exam_papers to authenticated;
grant select, delete on public.exam_paper_questions to authenticated;

create policy exam_papers_staff_select on public.exam_papers
  for select to authenticated
  using (private.teaches_subject(subject_id));

create policy exam_papers_staff_delete on public.exam_papers
  for delete to authenticated
  using (private.teaches_subject(subject_id));

create policy exam_paper_questions_staff_select on public.exam_paper_questions
  for select to authenticated
  using (
    exists (
      select 1
      from public.exam_papers
      where exam_papers.id = exam_paper_questions.paper_id
        and private.teaches_subject(exam_papers.subject_id)
    )
  );

create policy exam_paper_questions_staff_delete on public.exam_paper_questions
  for delete to authenticated
  using (
    exists (
      select 1
      from public.exam_papers
      where exam_papers.id = exam_paper_questions.paper_id
        and private.teaches_subject(exam_papers.subject_id)
    )
  );


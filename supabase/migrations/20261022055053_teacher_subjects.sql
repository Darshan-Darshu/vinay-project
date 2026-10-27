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

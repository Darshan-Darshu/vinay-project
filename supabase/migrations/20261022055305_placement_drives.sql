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

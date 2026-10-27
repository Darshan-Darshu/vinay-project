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

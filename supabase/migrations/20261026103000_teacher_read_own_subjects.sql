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

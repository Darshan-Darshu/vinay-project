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

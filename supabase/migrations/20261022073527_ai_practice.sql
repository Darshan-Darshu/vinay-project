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

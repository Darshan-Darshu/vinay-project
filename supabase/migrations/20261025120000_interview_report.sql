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

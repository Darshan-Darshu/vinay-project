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

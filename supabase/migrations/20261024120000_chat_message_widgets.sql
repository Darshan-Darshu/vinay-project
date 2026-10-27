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

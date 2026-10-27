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

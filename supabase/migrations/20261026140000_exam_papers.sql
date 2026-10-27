-- Written exam papers for staff. Students never read these tables.

create table public.exam_papers (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  subject_id uuid not null references public.subjects (id),
  title text not null check (pg_catalog.char_length(pg_catalog.btrim(title)) > 0 and pg_catalog.char_length(title) <= 160),
  topics text not null check (pg_catalog.char_length(pg_catalog.btrim(topics)) > 0 and pg_catalog.char_length(topics) <= 500),
  difficulty text not null check (difficulty in ('easy', 'medium', 'hard')),
  total_marks integer not null check (total_marks > 0),
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now()
);

create index exam_papers_subject_id_idx on public.exam_papers (subject_id, created_at desc);

create trigger exam_papers_set_updated_at
  before update on public.exam_papers
  for each row execute function private.set_updated_at();

create table public.exam_paper_questions (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  paper_id uuid not null references public.exam_papers (id) on delete cascade,
  section_marks integer not null check (section_marks in (1, 2, 5, 20)),
  ordinal integer not null check (ordinal >= 0),
  stem text not null check (pg_catalog.char_length(pg_catalog.btrim(stem)) > 0),
  unique (paper_id, ordinal)
);

create index exam_paper_questions_paper_id_idx on public.exam_paper_questions (paper_id);

create or replace function private.save_exam_paper(paper jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  target_subject uuid;
  paper_title text;
  paper_topics text;
  paper_difficulty text;
  item jsonb;
  saved uuid;
  ordinal integer := 0;
  total integer := 0;
  section_marks integer;
  stem text;
begin
  if actor is null or paper is null or pg_catalog.jsonb_typeof(paper) <> 'object' then
    raise exception 'You do not have permission to edit this question.';
  end if;

  target_subject := (paper ->> 'subjectId')::uuid;
  if not private.teaches_subject(target_subject) then
    raise exception 'You do not have permission to edit this question.';
  end if;

  paper_title := pg_catalog.btrim(coalesce(paper ->> 'title', ''));
  paper_topics := pg_catalog.btrim(coalesce(paper ->> 'topics', ''));
  paper_difficulty := paper ->> 'difficulty';
  if pg_catalog.char_length(paper_title) < 1
    or pg_catalog.char_length(paper_title) > 160
    or pg_catalog.char_length(paper_topics) < 1
    or pg_catalog.char_length(paper_topics) > 500
    or paper_difficulty not in ('easy', 'medium', 'hard')
    or pg_catalog.jsonb_typeof(paper -> 'questions') <> 'array'
    or pg_catalog.jsonb_array_length(paper -> 'questions') < 1
    or pg_catalog.jsonb_array_length(paper -> 'questions') > 30
  then
    raise exception 'Check the form and try again.';
  end if;

  insert into public.exam_papers (subject_id, title, topics, difficulty, total_marks, created_by)
  values (target_subject, paper_title, paper_topics, paper_difficulty, 1, actor)
  returning id into saved;

  for item in select elements.value from pg_catalog.jsonb_array_elements(paper -> 'questions') as elements(value) loop
    if pg_catalog.jsonb_typeof(item) <> 'object'
      or pg_catalog.jsonb_typeof(item -> 'sectionMarks') <> 'number'
    then
      raise exception 'Check the form and try again.';
    end if;
    section_marks := (item ->> 'sectionMarks')::integer;
    stem := pg_catalog.btrim(coalesce(item ->> 'stem', ''));
    if section_marks not in (1, 2, 5, 20) or pg_catalog.char_length(stem) < 1 then
      raise exception 'Check the form and try again.';
    end if;
    insert into public.exam_paper_questions (paper_id, section_marks, ordinal, stem)
    values (saved, section_marks, ordinal, stem);
    total := total + section_marks;
    ordinal := ordinal + 1;
  end loop;

  update public.exam_papers set total_marks = total where id = saved;
  return saved;
end;
$$;

create or replace function public.save_exam_paper(paper jsonb)
returns uuid
language sql
security invoker
set search_path = ''
as $$
  select private.save_exam_paper(paper)
$$;

revoke all on function private.save_exam_paper(jsonb) from public;
grant execute on function private.save_exam_paper(jsonb) to authenticated;
revoke all on function public.save_exam_paper(jsonb) from public, anon;
grant execute on function public.save_exam_paper(jsonb) to authenticated;

alter table public.exam_papers enable row level security;
alter table public.exam_paper_questions enable row level security;

revoke all on public.exam_papers from public, anon;
revoke all on public.exam_paper_questions from public, anon;
grant select, delete on public.exam_papers to authenticated;
grant select, delete on public.exam_paper_questions to authenticated;

create policy exam_papers_staff_select on public.exam_papers
  for select to authenticated
  using (private.teaches_subject(subject_id));

create policy exam_papers_staff_delete on public.exam_papers
  for delete to authenticated
  using (private.teaches_subject(subject_id));

create policy exam_paper_questions_staff_select on public.exam_paper_questions
  for select to authenticated
  using (
    exists (
      select 1
      from public.exam_papers
      where exam_papers.id = exam_paper_questions.paper_id
        and private.teaches_subject(exam_papers.subject_id)
    )
  );

create policy exam_paper_questions_staff_delete on public.exam_paper_questions
  for delete to authenticated
  using (
    exists (
      select 1
      from public.exam_papers
      where exam_papers.id = exam_paper_questions.paper_id
        and private.teaches_subject(exam_papers.subject_id)
    )
  );

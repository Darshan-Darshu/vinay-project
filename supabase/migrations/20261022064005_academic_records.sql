-- Objective papers, resumes, learning materials, and the chat tables the agent spec will write later.
-- Scoring matches src/lib/academics/score.ts: a question scores its marks only when the chosen option is correct.

alter table public.placement_drives
  add column required_skills text[] not null default '{}';

create or replace function private.normalize_skills(input text[])
returns text[]
language sql
immutable
set search_path = ''
as $$
  select coalesce(
    (
      select pg_catalog.array_agg(skill order by skill)
      from (
        select distinct pg_catalog.lower(pg_catalog.btrim(item)) as skill
        from pg_catalog.unnest(coalesce(input, array[]::text[])) as item
        where pg_catalog.btrim(item) <> ''
      ) cleaned
    ),
    array[]::text[]
  )
$$;

create or replace function private.normalize_skill_list()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  normalized text[];
  skill text;
begin
  if tg_table_name = 'student_resumes' then
    normalized := private.normalize_skills(new.skills);
  else
    normalized := private.normalize_skills(new.required_skills);
  end if;

  if coalesce(pg_catalog.array_length(normalized, 1), 0) > 40 then
    raise exception 'Enter at most 40 skills.';
  end if;

  foreach skill in array normalized loop
    if pg_catalog.char_length(skill) > 40 then
      raise exception 'Each skill must be 40 characters or fewer.';
    end if;
  end loop;

  if tg_table_name = 'student_resumes' then
    new.skills := normalized;
  else
    new.required_skills := normalized;
  end if;
  return new;
end;
$$;

create trigger placement_drives_normalize_skills
  before insert or update of required_skills on public.placement_drives
  for each row execute function private.normalize_skill_list();

create or replace function private.current_student_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select students.id
  from public.students
  where students.profile_id = (select auth.uid())
    and students.deleted_at is null
    and students.is_active
$$;

create or replace function private.teaches_subject(target_subject uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_admin()
    or exists (
      select 1
      from public.teacher_subjects
      join public.teachers on teachers.id = teacher_subjects.teacher_id
      join public.subjects on subjects.id = teacher_subjects.subject_id
      where teacher_subjects.subject_id = target_subject
        and teachers.profile_id = (select auth.uid())
        and teachers.deleted_at is null
        and teachers.is_active
        and subjects.deleted_at is null
    )
$$;

create table public.student_resumes (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  student_id uuid not null unique references public.students (id) on delete cascade,
  storage_path text not null,
  file_name text not null,
  skills text[] not null default '{}',
  extracted_text text not null default '',
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now()
);

create trigger student_resumes_set_updated_at
  before update on public.student_resumes
  for each row execute function private.set_updated_at();

create trigger student_resumes_normalize_skills
  before insert or update of skills on public.student_resumes
  for each row execute function private.normalize_skill_list();

create table public.questions (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  subject_id uuid not null references public.subjects (id),
  topic text not null default '',
  question_type text not null check (question_type in ('mcq', 'true_false')),
  difficulty text not null default 'medium' check (difficulty in ('easy', 'medium', 'hard')),
  marks integer not null check (marks > 0 and marks <= 100),
  stem text not null check (pg_catalog.char_length(pg_catalog.btrim(stem)) > 0),
  explanation text not null default '',
  created_by uuid not null references public.profiles (id),
  source text not null default 'manual' check (source in ('manual', 'ai')),
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now()
);

create index questions_subject_id_idx on public.questions (subject_id);

create trigger questions_set_updated_at
  before update on public.questions
  for each row execute function private.set_updated_at();

create table public.question_options (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  question_id uuid not null references public.questions (id) on delete cascade,
  label text not null,
  option_text text not null check (pg_catalog.char_length(pg_catalog.btrim(option_text)) > 0),
  is_correct boolean not null default false,
  ordinal integer not null check (ordinal >= 0),
  unique (question_id, ordinal)
);

create index question_options_question_id_idx on public.question_options (question_id);

create table public.question_papers (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  subject_id uuid not null references public.subjects (id),
  title text not null check (pg_catalog.char_length(pg_catalog.btrim(title)) > 0),
  duration_minutes integer not null check (duration_minutes > 0 and duration_minutes <= 300),
  total_marks integer not null default 0 check (total_marks >= 0),
  status text not null default 'draft' check (status in ('draft', 'published')),
  opens_at timestamptz not null,
  closes_at timestamptz not null,
  created_by uuid not null references public.profiles (id),
  published_at timestamptz,
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  check (opens_at < closes_at)
);

create index question_papers_subject_id_idx on public.question_papers (subject_id, status);

create trigger question_papers_set_updated_at
  before update on public.question_papers
  for each row execute function private.set_updated_at();

create table public.question_paper_questions (
  paper_id uuid not null references public.question_papers (id) on delete cascade,
  question_id uuid not null references public.questions (id),
  ordinal integer not null check (ordinal >= 0),
  marks integer not null check (marks > 0),
  primary key (paper_id, question_id),
  unique (paper_id, ordinal)
);

create index question_paper_questions_question_id_idx on public.question_paper_questions (question_id);

create table public.test_attempts (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  student_id uuid not null references public.students (id),
  paper_id uuid not null references public.question_papers (id),
  status text not null default 'in_progress' check (status in ('in_progress', 'submitted', 'expired')),
  started_at timestamptz not null default pg_catalog.now(),
  submitted_at timestamptz,
  score integer,
  max_score integer not null check (max_score >= 0),
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  unique (student_id, paper_id)
);

create index test_attempts_paper_id_idx on public.test_attempts (paper_id);
create index test_attempts_student_id_idx on public.test_attempts (student_id);

create trigger test_attempts_set_updated_at
  before update on public.test_attempts
  for each row execute function private.set_updated_at();

create table public.student_answers (
  attempt_id uuid not null references public.test_attempts (id) on delete cascade,
  question_id uuid not null references public.questions (id),
  option_id uuid not null references public.question_options (id),
  primary key (attempt_id, question_id)
);

create index student_answers_option_id_idx on public.student_answers (option_id);

create table public.learning_materials (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  subject_id uuid not null references public.subjects (id),
  title text not null check (pg_catalog.char_length(pg_catalog.btrim(title)) > 0),
  kind text not null check (kind in ('pdf', 'link')),
  storage_path text,
  external_url text,
  file_name text not null default '',
  approved_for_rag boolean not null default false,
  uploaded_by uuid not null references public.profiles (id),
  deleted_at timestamptz,
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  check (
    (kind = 'pdf' and storage_path is not null and external_url is null)
    or (kind = 'link' and external_url is not null and storage_path is null)
  )
);

create index learning_materials_subject_id_idx on public.learning_materials (subject_id)
  where deleted_at is null;

create trigger learning_materials_set_updated_at
  before update on public.learning_materials
  for each row execute function private.set_updated_at();

create table public.chat_sessions (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  profile_id uuid not null references public.profiles (id),
  role text not null check (role in ('admin', 'teacher', 'student')),
  feature text not null,
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now()
);

create index chat_sessions_profile_id_idx on public.chat_sessions (profile_id);

create trigger chat_sessions_set_updated_at
  before update on public.chat_sessions
  for each row execute function private.set_updated_at();

create table public.chat_messages (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  session_id uuid not null references public.chat_sessions (id) on delete cascade,
  role text not null check (role in ('user', 'assistant', 'tool')),
  content text not null,
  created_at timestamptz not null default pg_catalog.now()
);

create index chat_messages_session_id_idx on public.chat_messages (session_id, created_at);

create table public.ai_usage_logs (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  profile_id uuid not null references public.profiles (id),
  role text not null,
  model text not null,
  feature text not null,
  latency_ms integer,
  prompt_tokens integer,
  completion_tokens integer,
  status text not null,
  created_at timestamptz not null default pg_catalog.now()
);

create index ai_usage_logs_profile_id_idx on public.ai_usage_logs (profile_id, created_at desc);

create or replace function private.question_is_frozen(target_question uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.question_paper_questions
    join public.question_papers on question_papers.id = question_paper_questions.paper_id
    where question_paper_questions.question_id = target_question
      and question_papers.status = 'published'
  )
$$;

create or replace function private.prevent_frozen_question_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if private.question_is_frozen(old.id) then
    raise exception 'Published questions cannot be changed.';
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create trigger questions_freeze_published
  before update or delete on public.questions
  for each row execute function private.prevent_frozen_question_change();

create or replace function private.prevent_frozen_option_change()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  target uuid := coalesce(new.question_id, old.question_id);
begin
  if private.question_is_frozen(target) then
    raise exception 'Published questions cannot be changed.';
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create trigger question_options_freeze_published
  before insert or update or delete on public.question_options
  for each row execute function private.prevent_frozen_option_change();

create or replace function private.assert_question_options()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  target uuid := coalesce(new.question_id, old.question_id);
  kind text;
  option_count integer;
  correct_count integer;
begin
  select questions.question_type into kind
  from public.questions
  where questions.id = target;

  if kind is null then
    return null;
  end if;

  select count(*), count(*) filter (where is_correct)
    into option_count, correct_count
  from public.question_options
  where question_id = target;

  if option_count = 0 then
    return null;
  end if;

  if correct_count <> 1 then
    raise exception 'Each question needs one correct option.';
  end if;

  if kind = 'true_false' and option_count <> 2 then
    raise exception 'True or false questions need two options.';
  end if;

  if kind = 'mcq' and (option_count < 2 or option_count > 6) then
    raise exception 'Multiple choice questions need two to six options.';
  end if;

  return null;
end;
$$;

create constraint trigger question_options_one_correct
  after insert or update or delete on public.question_options
  deferrable initially deferred
  for each row
  execute function private.assert_question_options();

create or replace function private.prevent_published_paper_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.status = 'published' then
    raise exception 'Published papers cannot be changed.';
  end if;
  if new.status = 'published' and pg_catalog.current_setting('app.publishing', true) is distinct from 'on' then
    raise exception 'Publish the paper from the paper screen.';
  end if;
  return new;
end;
$$;

create trigger question_papers_freeze
  before update on public.question_papers
  for each row execute function private.prevent_published_paper_change();

create or replace function private.prevent_published_link_change()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  target uuid := coalesce(new.paper_id, old.paper_id);
  paper_status text;
begin
  select status into paper_status from public.question_papers where id = target;
  if paper_status = 'published' then
    raise exception 'Published papers cannot be changed.';
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create trigger question_paper_questions_freeze
  before insert or update or delete on public.question_paper_questions
  for each row execute function private.prevent_published_link_change();

create or replace function private.publish_question_paper(target_paper uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  paper public.question_papers%rowtype;
  question_count integer;
begin
  select * into paper from public.question_papers where id = target_paper;
  if not found then
    raise exception 'That paper could not be found.';
  end if;
  if not private.teaches_subject(paper.subject_id) then
    raise exception 'You do not have permission to publish this paper.';
  end if;
  if paper.status = 'published' then
    raise exception 'This paper is already published.';
  end if;
  if paper.opens_at >= paper.closes_at then
    raise exception 'The open time has to be before the close time.';
  end if;

  select count(*) into question_count
  from public.question_paper_questions
  where paper_id = paper.id;

  if question_count = 0 then
    raise exception 'Add at least one question before publishing.';
  end if;

  perform pg_catalog.set_config('app.publishing', 'on', true);

  update public.question_papers
  set status = 'published',
      published_at = pg_catalog.now(),
      total_marks = (
        select coalesce(sum(marks), 0)
        from public.question_paper_questions
        where paper_id = paper.id
      )
  where id = paper.id;
end;
$$;

create or replace function private.replace_attempt_answers(
  target_attempt uuid,
  target_paper uuid,
  answers jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  item jsonb;
  question_id uuid;
  option_id uuid;
begin
  if answers is null then
    answers := '[]'::jsonb;
  end if;
  if pg_catalog.jsonb_typeof(answers) <> 'array' then
    raise exception 'Check the form and try again.';
  end if;

  if exists (
    select 1
    from pg_catalog.jsonb_array_elements(answers) as elem
    group by elem ->> 'questionId'
    having count(*) > 1
  ) then
    raise exception 'Check the form and try again.';
  end if;

  delete from public.student_answers where attempt_id = target_attempt;

  for item in select elements.value from pg_catalog.jsonb_array_elements(answers) as elements(value) loop
    begin
      question_id := (item ->> 'questionId')::uuid;
      option_id := (item ->> 'optionId')::uuid;
    exception
      when invalid_text_representation then
        raise exception 'Check the form and try again.';
    end;

    if not exists (
      select 1
      from public.question_paper_questions
      where paper_id = target_paper
        and question_paper_questions.question_id = question_id
    ) then
      raise exception 'Check the form and try again.';
    end if;

    if not exists (
      select 1
      from public.question_options
      where question_options.id = option_id
        and question_options.question_id = question_id
    ) then
      raise exception 'Check the form and try again.';
    end if;

    insert into public.student_answers (attempt_id, question_id, option_id)
    values (target_attempt, question_id, option_id);
  end loop;
end;
$$;

create or replace function private.lock_student_attempt(target_attempt uuid)
returns public.test_attempts
language plpgsql
security definer
set search_path = ''
as $$
declare
  student uuid := private.current_student_id();
  attempt public.test_attempts%rowtype;
  paper public.question_papers%rowtype;
begin
  if student is null then
    raise exception 'Your enrollment is not on file yet.';
  end if;

  select * into attempt
  from public.test_attempts
  where id = target_attempt
  for update;

  if not found or attempt.student_id <> student then
    raise exception 'That attempt could not be found.';
  end if;

  select * into paper from public.question_papers where id = attempt.paper_id;

  if attempt.status = 'in_progress' and pg_catalog.now() >= paper.closes_at then
    update public.test_attempts
    set status = 'expired', submitted_at = pg_catalog.now(), score = null
    where id = attempt.id;
    attempt.status := 'expired';
    attempt.score := null;
  end if;

  return attempt;
end;
$$;

create or replace function private.start_test_attempt(target_paper uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  student uuid := private.current_student_id();
  course uuid;
  paper public.question_papers%rowtype;
  subject_course uuid;
  existing public.test_attempts%rowtype;
  created uuid;
  max_marks integer;
begin
  if student is null then
    raise exception 'Your enrollment is not on file yet.';
  end if;

  select students.course_id into course from public.students where students.id = student;

  select * into paper from public.question_papers where id = target_paper;
  if not found or paper.status <> 'published' then
    raise exception 'This paper is not open.';
  end if;

  select subjects.course_id into subject_course
  from public.subjects
  where subjects.id = paper.subject_id;

  if course is null or subject_course is distinct from course then
    raise exception 'This paper is for another course.';
  end if;

  if pg_catalog.now() < paper.opens_at or pg_catalog.now() >= paper.closes_at then
    raise exception 'This paper is not open.';
  end if;

  select * into existing
  from public.test_attempts
  where student_id = student
    and paper_id = paper.id;

  if found then
    if existing.status = 'in_progress' then
      return existing.id;
    end if;
    raise exception 'You have already taken this paper.';
  end if;

  select coalesce(sum(marks), 0) into max_marks
  from public.question_paper_questions
  where paper_id = paper.id;

  insert into public.test_attempts (student_id, paper_id, max_score)
  values (student, paper.id, max_marks)
  returning id into created;

  return created;
exception
  when unique_violation then
    select id into created
    from public.test_attempts
    where student_id = student
      and paper_id = target_paper
      and status = 'in_progress';
    if created is not null then
      return created;
    end if;
    raise exception 'You have already taken this paper.';
end;
$$;

create or replace function private.save_test_answers(target_attempt uuid, answers jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  attempt public.test_attempts%rowtype;
begin
  attempt := private.lock_student_attempt(target_attempt);
  if attempt.status = 'expired' then
    raise exception 'The paper has closed. This attempt has expired.';
  end if;
  if attempt.status <> 'in_progress' then
    raise exception 'This attempt is already submitted.';
  end if;
  perform private.replace_attempt_answers(attempt.id, attempt.paper_id, answers);
end;
$$;

create or replace function private.submit_test_attempt(target_attempt uuid, answers jsonb)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  attempt public.test_attempts%rowtype;
  earned integer;
begin
  attempt := private.lock_student_attempt(target_attempt);
  if attempt.status = 'expired' then
    raise exception 'The paper has closed. This attempt has expired.';
  end if;
  if attempt.status = 'submitted' then
    return coalesce(attempt.score, 0);
  end if;

  perform private.replace_attempt_answers(attempt.id, attempt.paper_id, answers);

  select coalesce(sum(link.marks) filter (where options.is_correct), 0)
    into earned
  from public.question_paper_questions as link
  left join public.student_answers as answers
    on answers.attempt_id = attempt.id
    and answers.question_id = link.question_id
  left join public.question_options as options
    on options.id = answers.option_id
  where link.paper_id = attempt.paper_id;

  update public.test_attempts
  set status = 'submitted',
      submitted_at = pg_catalog.now(),
      score = earned
  where id = attempt.id;

  return earned;
end;
$$;

create or replace function private.expire_my_closed_attempts()
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

  update public.test_attempts as attempts
  set status = 'expired',
      submitted_at = pg_catalog.now(),
      score = null
  from public.question_papers as papers
  where attempts.paper_id = papers.id
    and attempts.student_id = student
    and attempts.status = 'in_progress'
    and pg_catalog.now() >= papers.closes_at;
end;
$$;

create or replace function private.student_paper(target_paper uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  student uuid := private.current_student_id();
  course uuid;
  paper public.question_papers%rowtype;
  subject_name text;
  subject_course uuid;
  attempt public.test_attempts%rowtype;
  has_attempt boolean := false;
  show_key boolean := false;
  question_rows jsonb;
begin
  if student is null then
    raise exception 'Your enrollment is not on file yet.';
  end if;

  select students.course_id into course from public.students where students.id = student;
  select * into paper from public.question_papers where id = target_paper;
  if not found or paper.status <> 'published' then
    raise exception 'This paper is not open.';
  end if;

  select subjects.course_id, subjects.name
    into subject_course, subject_name
  from public.subjects
  where subjects.id = paper.subject_id;

  if course is null or subject_course is distinct from course then
    raise exception 'This paper is for another course.';
  end if;

  select * into attempt
  from public.test_attempts
  where test_attempts.student_id = student
    and test_attempts.paper_id = paper.id
  for update;

  if found then
    has_attempt := true;
    if attempt.status = 'in_progress' and pg_catalog.now() >= paper.closes_at then
      update public.test_attempts
      set status = 'expired', submitted_at = pg_catalog.now(), score = null
      where id = attempt.id;
      attempt.status := 'expired';
      attempt.score := null;
    end if;
    show_key := attempt.status = 'submitted';
  end if;

  if has_attempt and attempt.status in ('in_progress', 'submitted') then
    select coalesce(pg_catalog.jsonb_agg(item.payload order by item.ordinal), '[]'::jsonb)
      into question_rows
    from (
      select
        link.ordinal,
        pg_catalog.jsonb_build_object(
          'id', questions.id,
          'stem', questions.stem,
          'marks', link.marks,
          'explanation', case when show_key then questions.explanation else null end,
          'selectedOptionId', (
            select student_answers.option_id
            from public.student_answers
            where student_answers.attempt_id = attempt.id
              and student_answers.question_id = questions.id
          ),
          'options', (
            select coalesce(pg_catalog.jsonb_agg(
              pg_catalog.jsonb_build_object(
                'id', opts.id,
                'label', opts.label,
                'body', opts.option_text,
                'isCorrect', case when show_key then opts.is_correct else null end
              )
              order by opts.ordinal
            ), '[]'::jsonb)
            from public.question_options as opts
            where opts.question_id = questions.id
          )
        ) as payload
      from public.question_paper_questions as link
      join public.questions as questions on questions.id = link.question_id
      where link.paper_id = paper.id
    ) as item;
  else
    question_rows := '[]'::jsonb;
  end if;

  return pg_catalog.jsonb_build_object(
    'id', paper.id,
    'title', paper.title,
    'subjectName', subject_name,
    'durationMinutes', paper.duration_minutes,
    'opensAt', paper.opens_at,
    'closesAt', paper.closes_at,
    'maxScore', case when has_attempt then attempt.max_score else paper.total_marks end,
    'attemptId', case when has_attempt then attempt.id else null end,
    'attemptStatus', case when has_attempt then attempt.status else null end,
    'score', case when has_attempt then attempt.score else null end,
    'questions', question_rows
  );
end;
$$;

create or replace function private.save_question(
  target_question uuid,
  target_subject uuid,
  topic text,
  question_type text,
  difficulty text,
  marks integer,
  stem text,
  explanation text,
  options jsonb,
  actor uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  saved uuid := target_question;
  item jsonb;
  ordinal integer := 0;
begin
  if actor is distinct from (select auth.uid()) or not private.teaches_subject(target_subject) then
    raise exception 'You do not have permission to edit this question.';
  end if;
  if options is null or pg_catalog.jsonb_typeof(options) <> 'array' then
    raise exception 'Check the form and try again.';
  end if;

  if saved is null then
    insert into public.questions (
      subject_id, topic, question_type, difficulty, marks, stem, explanation, created_by, source
    )
    values (
      target_subject, topic, question_type, difficulty, marks, stem, explanation, actor, 'manual'
    )
    returning id into saved;
  else
    update public.questions
    set subject_id = target_subject,
        topic = topic,
        question_type = question_type,
        difficulty = difficulty,
        marks = marks,
        stem = stem,
        explanation = explanation
    where id = saved;
    if not found then
      raise exception 'That question could not be found.';
    end if;
  end if;

  delete from public.question_options where question_id = saved;

  for item in select elements.value from pg_catalog.jsonb_array_elements(options) as elements(value) loop
    insert into public.question_options (question_id, label, option_text, is_correct, ordinal)
    values (
      saved,
      coalesce(item ->> 'label', ''),
      coalesce(item ->> 'body', ''),
      coalesce((item ->> 'isCorrect')::boolean, false),
      ordinal
    );
    ordinal := ordinal + 1;
  end loop;

  return saved;
end;
$$;

create or replace function private.storage_folder_id(object_name text)
returns uuid
language plpgsql
stable
set search_path = ''
as $$
declare
  folder text := (storage.foldername(object_name))[1];
begin
  if folder is null or folder !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return null;
  end if;
  return folder::uuid;
end;
$$;

create or replace function public.publish_question_paper(target_paper uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  perform private.publish_question_paper(target_paper);
end;
$$;

create or replace function public.start_test_attempt(target_paper uuid)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
begin
  return private.start_test_attempt(target_paper);
end;
$$;

create or replace function public.save_test_answers(target_attempt uuid, answers jsonb)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  perform private.save_test_answers(target_attempt, answers);
end;
$$;

create or replace function public.submit_test_attempt(target_attempt uuid, answers jsonb)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
begin
  return private.submit_test_attempt(target_attempt, answers);
end;
$$;

create or replace function public.expire_my_closed_attempts()
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  perform private.expire_my_closed_attempts();
end;
$$;

create or replace function public.student_paper(target_paper uuid)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
begin
  return private.student_paper(target_paper);
end;
$$;

create or replace function public.save_question(
  target_question uuid,
  target_subject uuid,
  topic text,
  question_type text,
  difficulty text,
  marks integer,
  stem text,
  explanation text,
  options jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
begin
  return private.save_question(
    target_question,
    target_subject,
    topic,
    question_type,
    difficulty,
    marks,
    stem,
    explanation,
    options,
    (select auth.uid())
  );
end;
$$;

revoke all on function private.normalize_skills(text[]) from public;
revoke all on function private.normalize_skill_list() from public;
revoke all on function private.current_student_id() from public;
revoke all on function private.teaches_subject(uuid) from public;
revoke all on function private.question_is_frozen(uuid) from public;
revoke all on function private.prevent_frozen_question_change() from public;
revoke all on function private.prevent_frozen_option_change() from public;
revoke all on function private.assert_question_options() from public;
revoke all on function private.prevent_published_paper_change() from public;
revoke all on function private.prevent_published_link_change() from public;
revoke all on function private.publish_question_paper(uuid) from public;
revoke all on function private.replace_attempt_answers(uuid, uuid, jsonb) from public;
revoke all on function private.lock_student_attempt(uuid) from public;
revoke all on function private.start_test_attempt(uuid) from public;
revoke all on function private.save_test_answers(uuid, jsonb) from public;
revoke all on function private.submit_test_attempt(uuid, jsonb) from public;
revoke all on function private.expire_my_closed_attempts() from public;
revoke all on function private.student_paper(uuid) from public;
revoke all on function private.save_question(uuid, uuid, text, text, text, integer, text, text, jsonb, uuid) from public;
revoke all on function private.storage_folder_id(text) from public;

grant execute on function private.normalize_skills(text[]) to authenticated;
grant execute on function private.current_student_id() to authenticated;
grant execute on function private.teaches_subject(uuid) to authenticated;
grant execute on function private.publish_question_paper(uuid) to authenticated;
grant execute on function private.replace_attempt_answers(uuid, uuid, jsonb) to authenticated;
grant execute on function private.lock_student_attempt(uuid) to authenticated;
grant execute on function private.start_test_attempt(uuid) to authenticated;
grant execute on function private.save_test_answers(uuid, jsonb) to authenticated;
grant execute on function private.submit_test_attempt(uuid, jsonb) to authenticated;
grant execute on function private.expire_my_closed_attempts() to authenticated;
grant execute on function private.student_paper(uuid) to authenticated;
grant execute on function private.save_question(uuid, uuid, text, text, text, integer, text, text, jsonb, uuid) to authenticated;
grant execute on function private.storage_folder_id(text) to authenticated;

revoke all on function public.publish_question_paper(uuid) from public, anon;
revoke all on function public.start_test_attempt(uuid) from public, anon;
revoke all on function public.save_test_answers(uuid, jsonb) from public, anon;
revoke all on function public.submit_test_attempt(uuid, jsonb) from public, anon;
revoke all on function public.expire_my_closed_attempts() from public, anon;
revoke all on function public.student_paper(uuid) from public, anon;

grant execute on function public.publish_question_paper(uuid) to authenticated;
grant execute on function public.start_test_attempt(uuid) to authenticated;
grant execute on function public.save_test_answers(uuid, jsonb) to authenticated;
grant execute on function public.submit_test_attempt(uuid, jsonb) to authenticated;
grant execute on function public.expire_my_closed_attempts() to authenticated;
revoke all on function public.save_question(uuid, uuid, text, text, text, integer, text, text, jsonb) from public, anon;
grant execute on function public.student_paper(uuid) to authenticated;
grant execute on function public.save_question(uuid, uuid, text, text, text, integer, text, text, jsonb) to authenticated;

alter table public.student_resumes enable row level security;
alter table public.questions enable row level security;
alter table public.question_options enable row level security;
alter table public.question_papers enable row level security;
alter table public.question_paper_questions enable row level security;
alter table public.test_attempts enable row level security;
alter table public.student_answers enable row level security;
alter table public.learning_materials enable row level security;
alter table public.chat_sessions enable row level security;
alter table public.chat_messages enable row level security;
alter table public.ai_usage_logs enable row level security;

revoke all on public.student_resumes from public, anon;
revoke all on public.questions from public, anon;
revoke all on public.question_options from public, anon;
revoke all on public.question_papers from public, anon;
revoke all on public.question_paper_questions from public, anon;
revoke all on public.test_attempts from public, anon;
revoke all on public.student_answers from public, anon;
revoke all on public.learning_materials from public, anon;
revoke all on public.chat_sessions from public, anon;
revoke all on public.chat_messages from public, anon;
revoke all on public.ai_usage_logs from public, anon;

grant select, insert, update, delete on public.student_resumes to authenticated;
grant select, insert, update, delete on public.questions to authenticated;
grant select, insert, update, delete on public.question_options to authenticated;
grant select, insert, update, delete on public.question_papers to authenticated;
grant select, insert, update, delete on public.question_paper_questions to authenticated;
grant select on public.test_attempts to authenticated;
grant select on public.student_answers to authenticated;
grant select, insert, update, delete on public.learning_materials to authenticated;
grant select, insert, update, delete on public.chat_sessions to authenticated;
grant select, insert on public.chat_messages to authenticated;
grant select, insert on public.ai_usage_logs to authenticated;

create policy student_resumes_select on public.student_resumes
  for select to authenticated
  using (
    private.is_admin()
    or student_id = private.current_student_id()
    or exists (
      select 1
      from public.students
      where students.id = student_resumes.student_id
        and private.teaches_student(students.profile_id)
    )
  );

create policy student_resumes_write on public.student_resumes
  for all to authenticated
  using (private.is_admin() or student_id = private.current_student_id())
  with check (private.is_admin() or student_id = private.current_student_id());

create policy questions_staff on public.questions
  for all to authenticated
  using (private.teaches_subject(subject_id))
  with check (private.teaches_subject(subject_id));

create policy question_options_staff on public.question_options
  for all to authenticated
  using (
    exists (
      select 1
      from public.questions
      where questions.id = question_options.question_id
        and private.teaches_subject(questions.subject_id)
    )
  )
  with check (
    exists (
      select 1
      from public.questions
      where questions.id = question_options.question_id
        and private.teaches_subject(questions.subject_id)
    )
  );

create policy question_papers_staff on public.question_papers
  for all to authenticated
  using (private.teaches_subject(subject_id))
  with check (private.teaches_subject(subject_id));

create policy question_papers_student_select on public.question_papers
  for select to authenticated
  using (
    status = 'published'
    and exists (
      select 1
      from public.subjects
      join public.students on students.course_id = subjects.course_id
      where subjects.id = question_papers.subject_id
        and students.id = private.current_student_id()
        and students.course_id is not null
    )
  );

create policy question_links_staff on public.question_paper_questions
  for all to authenticated
  using (
    exists (
      select 1
      from public.question_papers
      where question_papers.id = question_paper_questions.paper_id
        and private.teaches_subject(question_papers.subject_id)
    )
  )
  with check (
    exists (
      select 1
      from public.question_papers
      where question_papers.id = question_paper_questions.paper_id
        and private.teaches_subject(question_papers.subject_id)
        and question_papers.status = 'draft'
    )
    and exists (
      select 1
      from public.questions
      join public.question_papers on question_papers.id = question_paper_questions.paper_id
      where questions.id = question_paper_questions.question_id
        and questions.subject_id = question_papers.subject_id
    )
  );

create policy test_attempts_select on public.test_attempts
  for select to authenticated
  using (
    student_id = private.current_student_id()
    or private.is_admin()
    or exists (
      select 1
      from public.question_papers
      where question_papers.id = test_attempts.paper_id
        and private.teaches_subject(question_papers.subject_id)
    )
  );

create policy student_answers_select on public.student_answers
  for select to authenticated
  using (
    exists (
      select 1
      from public.test_attempts
      where test_attempts.id = student_answers.attempt_id
        and (
          test_attempts.student_id = private.current_student_id()
          or private.is_admin()
          or exists (
            select 1
            from public.question_papers
            where question_papers.id = test_attempts.paper_id
              and private.teaches_subject(question_papers.subject_id)
          )
        )
    )
  );

create policy learning_materials_select on public.learning_materials
  for select to authenticated
  using (
    deleted_at is null
    and (
      private.teaches_subject(subject_id)
      or exists (
        select 1
        from public.subjects
        join public.students on students.course_id = subjects.course_id
        where subjects.id = learning_materials.subject_id
          and students.id = private.current_student_id()
          and students.course_id is not null
      )
    )
  );

create policy learning_materials_staff on public.learning_materials
  for all to authenticated
  using (private.teaches_subject(subject_id))
  with check (private.teaches_subject(subject_id));

create policy chat_sessions_own on public.chat_sessions
  for all to authenticated
  using (profile_id = (select auth.uid()))
  with check (
    profile_id = (select auth.uid())
    and role = private.current_role()
  );

create policy chat_messages_own on public.chat_messages
  for select to authenticated
  using (
    exists (
      select 1
      from public.chat_sessions
      where chat_sessions.id = chat_messages.session_id
        and chat_sessions.profile_id = (select auth.uid())
    )
  );

create policy chat_messages_insert_own on public.chat_messages
  for insert to authenticated
  with check (
    exists (
      select 1
      from public.chat_sessions
      where chat_sessions.id = chat_messages.session_id
        and chat_sessions.profile_id = (select auth.uid())
    )
  );

create policy ai_usage_logs_select on public.ai_usage_logs
  for select to authenticated
  using (profile_id = (select auth.uid()) or private.is_admin());

create policy ai_usage_logs_insert_own on public.ai_usage_logs
  for insert to authenticated
  with check (
    profile_id = (select auth.uid())
    and role = private.current_role()
  );

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('resumes', 'resumes', false, 5242880, array['application/pdf']::text[])
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('materials', 'materials', false, 10485760, array['application/pdf']::text[])
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create policy resumes_student_read on storage.objects
  for select to authenticated
  using (
    bucket_id = 'resumes'
    and (storage.foldername(name))[1] = private.current_student_id()::text
  );

create policy resumes_student_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'resumes'
    and (storage.foldername(name))[1] = private.current_student_id()::text
  );

create policy resumes_student_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'resumes'
    and (storage.foldername(name))[1] = private.current_student_id()::text
  )
  with check (
    bucket_id = 'resumes'
    and (storage.foldername(name))[1] = private.current_student_id()::text
  );

create policy resumes_student_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'resumes'
    and (storage.foldername(name))[1] = private.current_student_id()::text
  );

create policy resumes_teacher_read on storage.objects
  for select to authenticated
  using (
    bucket_id = 'resumes'
    and exists (
      select 1
      from public.students
      where students.id::text = (storage.foldername(name))[1]
        and private.teaches_student(students.profile_id)
    )
  );

create policy resumes_admin_all on storage.objects
  for all to authenticated
  using (bucket_id = 'resumes' and private.is_admin())
  with check (bucket_id = 'resumes' and private.is_admin());

create policy materials_staff_read on storage.objects
  for select to authenticated
  using (
    bucket_id = 'materials'
    and private.teaches_subject(private.storage_folder_id(name))
  );

create policy materials_staff_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'materials'
    and private.teaches_subject(private.storage_folder_id(name))
  );

create policy materials_staff_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'materials'
    and private.teaches_subject(private.storage_folder_id(name))
  )
  with check (
    bucket_id = 'materials'
    and private.teaches_subject(private.storage_folder_id(name))
  );

create policy materials_staff_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'materials'
    and private.teaches_subject(private.storage_folder_id(name))
  );

create policy materials_student_read on storage.objects
  for select to authenticated
  using (
    bucket_id = 'materials'
    and exists (
      select 1
      from public.subjects
      join public.students on students.course_id = subjects.course_id
      where subjects.id = private.storage_folder_id(name)
        and students.id = private.current_student_id()
        and students.course_id is not null
    )
  );

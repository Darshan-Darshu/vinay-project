-- Demo college, three portal logins, teacher subjects, and two placement drives.
-- Run this once after 01_schema.sql.
--
-- Sign in at /login with password Campus@2026:
--   admin@riverside.academy
--   teacher@riverside.academy
--   student@riverside.academy


-- ===== 20261012180000_demo_seed.sql =====

-- Demo catalog and the three portal logins.
-- Run this once in the Supabase SQL editor after the Phase 1 migrations.
--
-- Sign in at /login with:
--   admin@riverside.academy    Campus@2026    admin
--   teacher@riverside.academy  Campus@2026    teacher
--   student@riverside.academy  Campus@2026    student

create or replace function private.seed_demo_user(
  user_id uuid,
  user_email text,
  user_password text,
  user_role text,
  user_name text,
  user_phone text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from auth.users where id = user_id or email = user_email) then
    insert into auth.users (
      instance_id,
      id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at,
      confirmation_token,
      email_change,
      email_change_token_new,
      recovery_token,
      email_change_token_current,
      phone_change,
      phone_change_token,
      reauthentication_token,
      is_sso_user,
      is_anonymous
    )
    values (
      '00000000-0000-0000-0000-000000000000',
      user_id,
      'authenticated',
      'authenticated',
      user_email,
      extensions.crypt(user_password, extensions.gen_salt('bf')),
      pg_catalog.now(),
      pg_catalog.jsonb_build_object(
        'provider', 'email',
        'providers', pg_catalog.jsonb_build_array('email'),
        'role', user_role
      ),
      pg_catalog.jsonb_build_object('full_name', user_name),
      pg_catalog.now(),
      pg_catalog.now(),
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      false,
      false
    );

    insert into auth.identities (
      id,
      user_id,
      identity_data,
      provider,
      provider_id,
      last_sign_in_at,
      created_at,
      updated_at
    )
    values (
      user_id,
      user_id,
      pg_catalog.jsonb_build_object(
        'sub', user_id::text,
        'email', user_email,
        'email_verified', true
      ),
      'email',
      user_id::text,
      pg_catalog.now(),
      pg_catalog.now(),
      pg_catalog.now()
    );
  end if;

  update public.profiles
  set
    role = user_role,
    full_name = user_name,
    phone = user_phone,
    is_active = true,
    deleted_at = null
  where id = user_id or email = user_email;
end;
$$;

revoke all on function private.seed_demo_user(uuid, text, text, text, text, text) from public;

select private.seed_demo_user(
  '11111111-1111-4111-8111-111111111111',
  'admin@riverside.academy',
  'Campus@2026',
  'admin',
  'Priya Shah',
  '+91 98450 11001'
);

select private.seed_demo_user(
  '22222222-2222-4222-8222-222222222222',
  'teacher@riverside.academy',
  'Campus@2026',
  'teacher',
  'Meera Iyer',
  '+91 98450 11002'
);

select private.seed_demo_user(
  '33333333-3333-4333-8333-333333333333',
  'student@riverside.academy',
  'Campus@2026',
  'student',
  'Kabir Nair',
  '+91 98450 22014'
);

drop function private.seed_demo_user(uuid, text, text, text, text, text);

update public.college_settings
set
  name = 'Kalpataru Institute of Technology',
  about = 'Kalpataru Institute of Technology is an engineering college in Tiptur, Tumkur District, Karnataka. Classes, labs, and campus life run across the academic year, and teachers stay with a student from the first week through the last exam.',
  address = 'Tiptur - 572202, Tumkur District, Karnataka, India',
  phone = '+91 484 250 1100',
  email = 'office@riverside.academy',
  admissions_info = 'Applications for 2026-27 are open until 30 November 2026. Bring the qualifying mark sheet, a photo, and a parent contact. Families are welcome to walk the campus on weekday mornings.'
where id = true;

insert into public.departments (id, name, code, description)
values
  (
    'a1000000-0000-4000-8000-000000000001',
    'Computer Science',
    'CSE',
    'Programming, systems, and the software studio beside the library.'
  ),
  (
    'a1000000-0000-4000-8000-000000000002',
    'Electronics',
    'ECE',
    'Circuits, signals, and the afternoon lab on the first floor.'
  ),
  (
    'a1000000-0000-4000-8000-000000000003',
    'Mechanical Engineering',
    'ME',
    'Workshops, design drawing, and the machine hall behind the quad.'
  )
on conflict (id) do nothing;

insert into public.academic_years (id, name, starts_on, ends_on, is_current)
values
  (
    'a2000000-0000-4000-8000-000000000001',
    '2025-26',
    '2025-06-16',
    '2026-05-15',
    false
  ),
  (
    'a2000000-0000-4000-8000-000000000002',
    '2026-27',
    '2026-06-15',
    '2027-05-14',
    true
  )
on conflict (id) do nothing;

insert into public.courses (id, department_id, name, code, duration_semesters, description)
values
  (
    'a3000000-0000-4000-8000-000000000001',
    'a1000000-0000-4000-8000-000000000001',
    'B.Tech Computer Science',
    'BT-CSE',
    8,
    'Four years of computing, with a studio project in the final year.'
  ),
  (
    'a3000000-0000-4000-8000-000000000002',
    'a1000000-0000-4000-8000-000000000002',
    'B.Tech Electronics',
    'BT-ECE',
    8,
    'Devices, communication, and a lab course in every semester.'
  ),
  (
    'a3000000-0000-4000-8000-000000000003',
    'a1000000-0000-4000-8000-000000000003',
    'B.Tech Mechanical',
    'BT-ME',
    8,
    'Design, thermal systems, and workshop practice from the first year.'
  )
on conflict (id) do nothing;

insert into public.semesters (id, course_id, academic_year_id, number)
values
  (
    'a4000000-0000-4000-8000-000000000001',
    'a3000000-0000-4000-8000-000000000001',
    'a2000000-0000-4000-8000-000000000002',
    1
  ),
  (
    'a4000000-0000-4000-8000-000000000002',
    'a3000000-0000-4000-8000-000000000002',
    'a2000000-0000-4000-8000-000000000002',
    1
  ),
  (
    'a4000000-0000-4000-8000-000000000003',
    'a3000000-0000-4000-8000-000000000003',
    'a2000000-0000-4000-8000-000000000002',
    3
  )
on conflict (id) do nothing;

insert into public.subjects (
  id, department_id, course_id, semester_number, name, code, credits
)
values
  (
    'a5000000-0000-4000-8000-000000000001',
    'a1000000-0000-4000-8000-000000000001',
    'a3000000-0000-4000-8000-000000000001',
    1,
    'Programming Fundamentals',
    'CSE101',
    4
  ),
  (
    'a5000000-0000-4000-8000-000000000002',
    'a1000000-0000-4000-8000-000000000001',
    'a3000000-0000-4000-8000-000000000001',
    1,
    'Discrete Mathematics',
    'CSE102',
    3
  ),
  (
    'a5000000-0000-4000-8000-000000000003',
    'a1000000-0000-4000-8000-000000000002',
    'a3000000-0000-4000-8000-000000000002',
    1,
    'Circuit Theory',
    'ECE101',
    4
  ),
  (
    'a5000000-0000-4000-8000-000000000004',
    'a1000000-0000-4000-8000-000000000003',
    'a3000000-0000-4000-8000-000000000003',
    3,
    'Engineering Mechanics',
    'ME201',
    4
  ),
  (
    'a5000000-0000-4000-8000-000000000005',
    'a1000000-0000-4000-8000-000000000003',
    'a3000000-0000-4000-8000-000000000003',
    3,
    'Workshop Practice',
    'ME202',
    2
  )
on conflict (id) do nothing;

insert into public.admissions (
  id, full_name, email, phone, department_id, course_id, semester_id, status, notes
)
values
  (
    'a6000000-0000-4000-8000-000000000001',
    'Kabir Nair',
    'student@riverside.academy',
    '+91 98450 22014',
    'a1000000-0000-4000-8000-000000000001',
    'a3000000-0000-4000-8000-000000000001',
    'a4000000-0000-4000-8000-000000000001',
    'completed',
    'Joined the first-year computer science class.'
  ),
  (
    'a6000000-0000-4000-8000-000000000002',
    'Ananya Rao',
    'ananya.rao@example.net',
    '+91 98450 22008',
    'a1000000-0000-4000-8000-000000000002',
    'a3000000-0000-4000-8000-000000000002',
    'a4000000-0000-4000-8000-000000000002',
    'applied',
    'Waiting on the qualifying mark sheet.'
  ),
  (
    'a6000000-0000-4000-8000-000000000003',
    'Rohan Mehta',
    'rohan.mehta@example.net',
    '+91 98450 22021',
    'a1000000-0000-4000-8000-000000000001',
    'a3000000-0000-4000-8000-000000000001',
    'a4000000-0000-4000-8000-000000000001',
    'under_review',
    'Interview scheduled for 20 October 2026.'
  ),
  (
    'a6000000-0000-4000-8000-000000000004',
    'Sara Joseph',
    'sara.joseph@example.net',
    '+91 98450 22033',
    'a1000000-0000-4000-8000-000000000003',
    'a3000000-0000-4000-8000-000000000003',
    'a4000000-0000-4000-8000-000000000003',
    'approved',
    'Offer sent. Account is not created yet.'
  ),
  (
    'a6000000-0000-4000-8000-000000000005',
    'Dev Patel',
    'dev.patel@example.net',
    '+91 98450 22040',
    'a1000000-0000-4000-8000-000000000002',
    'a3000000-0000-4000-8000-000000000002',
    null,
    'rejected',
    'Qualifying marks are below this year''s cutoff.'
  )
on conflict (id) do nothing;

insert into public.teachers (
  id, profile_id, department_id, employee_code, designation
)
values (
  'a1100000-0000-4000-8000-000000000001',
  '22222222-2222-4222-8222-222222222222',
  'a1000000-0000-4000-8000-000000000001',
  'EMP-1042',
  'Associate Professor'
)
on conflict (id) do nothing;

insert into public.students (
  id, profile_id, department_id, course_id, semester_id, admission_id, roll_number
)
values (
  'a1200000-0000-4000-8000-000000000001',
  '33333333-3333-4333-8333-333333333333',
  'a1000000-0000-4000-8000-000000000001',
  'a3000000-0000-4000-8000-000000000001',
  'a4000000-0000-4000-8000-000000000001',
  'a6000000-0000-4000-8000-000000000001',
  'CSE2026-014'
)
on conflict (id) do nothing;

update public.admissions
set student_id = 'a1200000-0000-4000-8000-000000000001'
where id = 'a6000000-0000-4000-8000-000000000001'
  and student_id is null;

insert into public.events (
  id, title, description, event_type, starts_at, ends_at, venue, status, is_public
)
values
  (
    'a7000000-0000-4000-8000-000000000001',
    'First-year orientation',
    'A morning on the lawn for new students, parents, and class teachers.',
    'cultural',
    '2026-11-04 09:30:00+05:30',
    '2026-11-04 12:30:00+05:30',
    'Main lawn',
    'published',
    true
  ),
  (
    'a7000000-0000-4000-8000-000000000002',
    'Circuits workshop',
    'A hands-on afternoon for the electronics lab, open to first-year students.',
    'workshop',
    '2026-11-18 14:00:00+05:30',
    '2026-11-18 17:00:00+05:30',
    'Electronics lab',
    'published',
    true
  ),
  (
    'a7000000-0000-4000-8000-000000000003',
    'Riverbend hackathon',
    'Teams of four build a small campus tool over one weekend.',
    'hackathon',
    '2026-12-05 09:00:00+05:30',
    '2026-12-06 18:00:00+05:30',
    'Software studio',
    'published',
    true
  ),
  (
    'a7000000-0000-4000-8000-000000000004',
    'Winter sports day',
    'Track events and a staff-student cricket match on the back field.',
    'sports',
    '2027-01-16 08:00:00+05:30',
    '2027-01-16 16:00:00+05:30',
    'Sports field',
    'published',
    true
  ),
  (
    'a7000000-0000-4000-8000-000000000005',
    'Placement briefing',
    'Draft for the January company visits. Not on the public calendar yet.',
    'placement',
    '2027-01-22 11:00:00+05:30',
    '2027-01-22 12:30:00+05:30',
    'Seminar hall',
    'draft',
    false
  )
on conflict (id) do nothing;

insert into public.announcements (
  id, title, body, audience, department_id, priority, publish_at, author_id, status
)
values
  (
    'a8000000-0000-4000-8000-000000000001',
    'Campus is open for visitors',
    'Families may walk the grounds on weekday mornings. Please check in at the front office.',
    'everyone',
    null,
    'normal',
    '2026-10-01 09:00:00+05:30',
    '11111111-1111-4111-8111-111111111111',
    'published'
  ),
  (
    'a8000000-0000-4000-8000-000000000002',
    'Library hours this term',
    'The library stays open until 8 pm on weekdays and until 1 pm on Saturdays.',
    'students',
    null,
    'normal',
    '2026-10-06 09:00:00+05:30',
    '11111111-1111-4111-8111-111111111111',
    'published'
  ),
  (
    'a8000000-0000-4000-8000-000000000003',
    'Staff meeting on Friday',
    'Department heads meet in the seminar hall at 3 pm to confirm the November timetable.',
    'teachers',
    null,
    'high',
    '2026-10-08 09:00:00+05:30',
    '11111111-1111-4111-8111-111111111111',
    'published'
  ),
  (
    'a8000000-0000-4000-8000-000000000004',
    'Two files still need a decision',
    'Ananya Rao and Rohan Mehta are waiting in the admissions queue.',
    'admins',
    null,
    'high',
    '2026-10-10 09:00:00+05:30',
    '11111111-1111-4111-8111-111111111111',
    'published'
  ),
  (
    'a8000000-0000-4000-8000-000000000005',
    'Holiday note, not published',
    'Draft for the December break. Keep this off the public board until the dates are confirmed.',
    'everyone',
    null,
    'low',
    '2026-12-01 09:00:00+05:30',
    '11111111-1111-4111-8111-111111111111',
    'draft'
  )
on conflict (id) do nothing;

insert into public.activity_logs (id, actor_id, action, entity_type, entity_id, summary)
values
  (
    'a9000000-0000-4000-8000-000000000001',
    '11111111-1111-4111-8111-111111111111',
    'publish',
    'college_settings',
    null,
    'Priya Shah published the Kalpataru Institute of Technology profile.'
  ),
  (
    'a9000000-0000-4000-8000-000000000002',
    '11111111-1111-4111-8111-111111111111',
    'create',
    'departments',
    'a1000000-0000-4000-8000-000000000001',
    'Priya Shah added the Computer Science department.'
  ),
  (
    'a9000000-0000-4000-8000-000000000003',
    '11111111-1111-4111-8111-111111111111',
    'enroll',
    'students',
    'a1200000-0000-4000-8000-000000000001',
    'Kabir Nair was enrolled in B.Tech Computer Science as CSE2026-014.'
  ),
  (
    'a9000000-0000-4000-8000-000000000004',
    '11111111-1111-4111-8111-111111111111',
    'publish',
    'events',
    'a7000000-0000-4000-8000-000000000001',
    'First-year orientation was published on the public calendar.'
  )
on conflict (id) do nothing;


-- ===== 20261022055603_demo_placements.sql =====

-- Demo teacher assignments and two company visits for the seeded student.

insert into public.teacher_subjects (teacher_id, subject_id)
select teachers.id, subjects.id
from public.teachers as teachers
join public.subjects as subjects
  on subjects.code in ('CSE101', 'CSE102')
 and subjects.deleted_at is null
where teachers.employee_code = 'EMP-1042'
  and teachers.deleted_at is null
on conflict (teacher_id, subject_id) do nothing;

insert into public.placement_drives (
  id,
  company_name,
  role_title,
  description,
  package_text,
  location,
  job_type,
  eligibility,
  department_id,
  course_id,
  apply_by,
  visit_at,
  venue,
  status
)
values
  (
    'a8000000-0000-4000-8000-000000000001',
    'Northwind Software',
    'Software engineer',
    'A full-time role for the computer science class. The written test is on campus, followed by an interview the same afternoon.',
    '6 LPA',
    'Bengaluru',
    'full_time',
    'Computer science students in the current first-year class.',
    'a1000000-0000-4000-8000-000000000001',
    'a3000000-0000-4000-8000-000000000001',
    '2026-12-15 17:00:00+05:30',
    '2026-12-18 10:00:00+05:30',
    'Seminar hall',
    'open'
  ),
  (
    'a8000000-0000-4000-8000-000000000002',
    'Harbour Analytics',
    'Summer intern',
    'A two-month internship open to every active student. Bring your roll number to the pre-placement talk.',
    '25,000 per month',
    'Hyderabad',
    'internship',
    'Every active student may apply.',
    null,
    null,
    '2026-12-20 17:00:00+05:30',
    '2027-01-08 11:00:00+05:30',
    'Auditorium',
    'open'
  )
on conflict (id) do nothing;

insert into public.placement_applications (id, drive_id, student_id, status)
select
  'a8100000-0000-4000-8000-000000000001',
  'a8000000-0000-4000-8000-000000000001',
  students.id,
  'applied'
from public.students as students
where students.roll_number = 'CSE2026-014'
  and students.deleted_at is null
on conflict (id) do nothing;


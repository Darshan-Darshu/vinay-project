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

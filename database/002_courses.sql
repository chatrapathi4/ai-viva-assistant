-- VivaAI | 002: Departments, sections, courses and enrollments
-- Prerequisite: 001_profiles.sql
-- Run second in the Supabase SQL Editor on a fresh project.

create table if not exists public.departments (
  id bigint generated always as identity primary key,
  name text not null,
  code text not null unique
);

create table if not exists public.sections (
  id bigint generated always as identity primary key,
  department_id bigint not null references public.departments(id),
  name text not null,
  unique (department_id, name)
);

create table if not exists public.courses (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  code text not null unique,
  description text,
  department_id bigint not null references public.departments(id),
  faculty_id uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);

create table if not exists public.enrollments (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  enrolled_at timestamptz not null default now(),
  unique (course_id, student_id)
);

create index if not exists courses_faculty_idx on public.courses(faculty_id);
create index if not exists enrollments_student_idx on public.enrollments(student_id);
create index if not exists enrollments_course_idx on public.enrollments(course_id);

alter table public.departments enable row level security;
alter table public.sections enable row level security;
alter table public.courses enable row level security;
alter table public.enrollments enable row level security;

-- Explicit client-side privileges. Enrollment writes are deliberately
-- prohibited here; Step 5B adds faculty-authorized RPC functions.
revoke all on public.departments from anon, authenticated;
revoke all on public.sections from anon, authenticated;
revoke all on public.courses from anon, authenticated;
revoke all on public.enrollments from anon, authenticated;

grant select on public.departments to authenticated;
grant select on public.sections to authenticated;
grant select, insert on public.courses to authenticated;
grant select on public.enrollments to authenticated;

drop policy if exists "Read departments" on public.departments;
create policy "Read departments"
on public.departments for select to authenticated
using (true);

drop policy if exists "Read sections" on public.sections;
create policy "Read sections"
on public.sections for select to authenticated
using (true);

drop policy if exists "Faculty and enrolled students read courses" on public.courses;
create policy "Faculty and enrolled students read courses"
on public.courses for select to authenticated
using (
  faculty_id = (select auth.uid())
  or id in (
    select e.course_id
    from public.enrollments e
    where e.student_id = (select auth.uid())
  )
);

drop policy if exists "Faculty create their own courses" on public.courses;
create policy "Faculty create their own courses"
on public.courses for insert to authenticated
with check (
  faculty_id = (select auth.uid())
  and exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.role = 'faculty'
  )
);

drop policy if exists "Students view their enrollments" on public.enrollments;
create policy "Students view their enrollments"
on public.enrollments for select to authenticated
using (student_id = (select auth.uid()));

-- Demo reference data: safe to run again without duplicates.
insert into public.departments (name, code)
values
  ('Artificial Intelligence & Data Science', 'AIDS'),
  ('Computer Science & Engineering', 'CSE'),
  ('Electronics & Communication Engineering', 'ECE')
on conflict (code) do nothing;

insert into public.sections (department_id, name)
select d.id, v.name
from public.departments d
cross join (values ('A'), ('B'), ('C')) as v(name)
where d.code in ('AIDS', 'CSE', 'ECE')
on conflict (department_id, name) do nothing;

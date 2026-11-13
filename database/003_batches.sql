-- VivaAI | Step 5B: Sections, enrollment helpers and batch management
-- Prerequisites: 001_profiles.sql and 002_courses.sql
-- Run using Supabase SQL Editor as a database administrator.
-- Do not include project-specific student IDs or credentials here.

-- 1. Student's academic section
alter table public.profiles
  add column if not exists section_id bigint references public.sections(id);

-- 2. Batches and members
create table if not exists public.batches (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  section_id bigint not null references public.sections(id),
  name text not null,
  created_at timestamptz not null default now(),
  unique (course_id, section_id, name)
);

create table if not exists public.batch_members (
  batch_id uuid not null references public.batches(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  added_at timestamptz not null default now(),
  primary key (batch_id, student_id)
);

create index if not exists batches_course_idx on public.batches(course_id);
create index if not exists batch_members_student_idx on public.batch_members(student_id);
create index if not exists profiles_section_idx on public.profiles(section_id);

alter table public.batches enable row level security;
alter table public.batch_members enable row level security;

-- 3. Read-only table access from the browser; mutations go through checked RPCs
revoke all on public.batches from anon, authenticated;
revoke all on public.batch_members from anon, authenticated;
grant select on public.batches to authenticated;
grant select on public.batch_members to authenticated;

drop policy if exists "Faculty view their course batches" on public.batches;
create policy "Faculty view their course batches"
on public.batches for select to authenticated
using (
  exists (
    select 1 from public.courses c
    where c.id = batches.course_id
      and c.faculty_id = (select auth.uid())
  )
);

drop policy if exists "Faculty view their batch members" on public.batch_members;
create policy "Faculty view their batch members"
on public.batch_members for select to authenticated
using (
  exists (
    select 1
    from public.batches b
    join public.courses c on c.id = b.course_id
    where b.id = batch_members.batch_id
      and c.faculty_id = (select auth.uid())
  )
);

-- 4. Get students enrolled in a faculty-owned course
create or replace function public.get_course_students(p_course_id uuid)
returns table (
  student_id uuid,
  full_name text,
  section_id bigint,
  section_name text
)
language plpgsql security definer set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.courses c
    join public.profiles f on f.id = c.faculty_id
    where c.id = p_course_id
      and c.faculty_id = (select auth.uid())
      and f.role = 'faculty'
  ) then
    raise exception 'Not authorized for this course';
  end if;

  return query
  select p.id, p.full_name, p.section_id, s.name
  from public.enrollments e
  join public.profiles p on p.id = e.student_id
  left join public.sections s on s.id = p.section_id
  where e.course_id = p_course_id and p.role = 'student'
  order by p.full_name;
end;
$$;

-- 5. Enroll only eligible registered students in faculty-owned courses
create or replace function public.enroll_student_by_email(
  p_course_id uuid,
  p_email text
)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_student_id uuid;
  v_department_id bigint;
begin
  select c.department_id into v_department_id
  from public.courses c
  join public.profiles f on f.id = c.faculty_id
  where c.id = p_course_id
    and c.faculty_id = (select auth.uid())
    and f.role = 'faculty';

  if v_department_id is null then
    raise exception 'Not authorized for this course';
  end if;

  select p.id into v_student_id
  from auth.users u
  join public.profiles p on p.id = u.id
  join public.sections s on s.id = p.section_id
  where lower(u.email) = lower(trim(p_email))
    and p.role = 'student'
    and s.department_id = v_department_id
  limit 1;

  if v_student_id is null then
    raise exception 'No eligible registered student found';
  end if;

  insert into public.enrollments(course_id, student_id)
  values (p_course_id, v_student_id)
  on conflict (course_id, student_id) do nothing;
end;
$$;

-- 6. Create a batch in a valid course section
create or replace function public.create_course_batch(
  p_course_id uuid,
  p_section_id bigint,
  p_name text
)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_batch_id uuid;
begin
  if length(trim(coalesce(p_name, ''))) = 0
    or length(trim(p_name)) > 80 then
    raise exception 'Invalid batch name';
  end if;

  if not exists (
    select 1
    from public.courses c
    join public.profiles f on f.id = c.faculty_id
    join public.sections s on s.department_id = c.department_id
    where c.id = p_course_id
      and c.faculty_id = (select auth.uid())
      and f.role = 'faculty'
      and s.id = p_section_id
  ) then
    raise exception 'Invalid course or section';
  end if;

  insert into public.batches(course_id, section_id, name)
  values (p_course_id, p_section_id, trim(p_name))
  returning id into v_batch_id;

  return v_batch_id;
end;
$$;

-- 7. Add an enrolled student from the correct section
create or replace function public.add_student_to_batch(
  p_batch_id uuid,
  p_student_id uuid
)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.batches b
    join public.courses c on c.id = b.course_id
    join public.profiles f on f.id = c.faculty_id
    join public.enrollments e on e.course_id = c.id
    join public.profiles p on p.id = e.student_id
    where b.id = p_batch_id
      and c.faculty_id = (select auth.uid())
      and f.role = 'faculty'
      and e.student_id = p_student_id
      and p.role = 'student'
      and p.section_id = b.section_id
  ) then
    raise exception 'Student is not eligible for this batch';
  end if;

  insert into public.batch_members(batch_id, student_id)
  values (p_batch_id, p_student_id)
  on conflict (batch_id, student_id) do nothing;
end;
$$;

-- 8. Remove a member from a faculty-owned batch
create or replace function public.remove_student_from_batch(
  p_batch_id uuid,
  p_student_id uuid
)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.batches b
    join public.courses c on c.id = b.course_id
    join public.profiles f on f.id = c.faculty_id
    where b.id = p_batch_id
      and c.faculty_id = (select auth.uid())
      and f.role = 'faculty'
  ) then
    raise exception 'Not authorized for this batch';
  end if;

  delete from public.batch_members
  where batch_id = p_batch_id and student_id = p_student_id;
end;
$$;

-- 9. Only authenticated users may invoke the five checked functions
revoke all on function public.get_course_students(uuid) from public, anon, authenticated;
revoke all on function public.enroll_student_by_email(uuid, text) from public, anon, authenticated;
revoke all on function public.create_course_batch(uuid, bigint, text) from public, anon, authenticated;
revoke all on function public.add_student_to_batch(uuid, uuid) from public, anon, authenticated;
revoke all on function public.remove_student_from_batch(uuid, uuid) from public, anon, authenticated;

grant execute on function public.get_course_students(uuid) to authenticated;
grant execute on function public.enroll_student_by_email(uuid, text) to authenticated;
grant execute on function public.create_course_batch(uuid, bigint, text) to authenticated;
grant execute on function public.add_student_to_batch(uuid, uuid) to authenticated;
grant execute on function public.remove_student_from_batch(uuid, uuid) to authenticated;

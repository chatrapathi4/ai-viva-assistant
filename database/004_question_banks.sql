
-- VivaAI: Migration 004
-- AI Question Banks and Faculty Approval
-- Run after 001_profiles.sql, 002_courses.sql
-- and 003_batches.sql.

-- 1. Create question banks table

create table if not exists public.question_banks (
    id uuid primary key default gen_random_uuid(),

    course_id uuid not null
        references public.courses(id) on delete cascade,

    faculty_id uuid not null
        references public.profiles(id),

    topic text not null
        check (char_length(trim(topic)) between 3 and 150),

    difficulty text not null
        check (difficulty in ('easy', 'medium', 'hard')),

    question_count integer not null
        check (question_count between 1 and 10),

    marks_per_question integer not null
        check (marks_per_question between 1 and 20),

    sets jsonb not null
        check (
            jsonb_typeof(sets) = 'array'
            and jsonb_array_length(sets) = 3
        ),

    status text not null default 'draft'
        check (status in ('draft', 'approved')),

    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

-- 2. Create indexes

create index if not exists question_banks_faculty_idx
on public.question_banks(faculty_id);

create index if not exists question_banks_course_idx
on public.question_banks(course_id);

-- 3. Enable Row Level Security

alter table public.question_banks
enable row level security;

-- 4. Configure table privileges

revoke all on public.question_banks
from anon, authenticated;

grant select, insert, update
on public.question_banks
to authenticated;

-- 5. Faculty can read their own question banks

drop policy if exists
"Faculty read their question banks"
on public.question_banks;

create policy "Faculty read their question banks"
on public.question_banks
for select
to authenticated
using (
    faculty_id = (select auth.uid())
);

-- 6. Faculty can create drafts for their courses

drop policy if exists
"Faculty create draft question banks"
on public.question_banks;

create policy "Faculty create draft question banks"
on public.question_banks
for insert
to authenticated
with check (
    faculty_id = (select auth.uid())
    and status = 'draft'
    and exists (
        select 1
        from public.courses c
        join public.profiles p
            on p.id = c.faculty_id
        where c.id = question_banks.course_id
          and c.faculty_id = (select auth.uid())
          and p.role = 'faculty'
    )
);

-- 7. Faculty can edit their drafts
-- and approve a reviewed question bank

drop policy if exists
"Faculty update their draft question banks"
on public.question_banks;

create policy "Faculty update their draft question banks"
on public.question_banks
for update
to authenticated
using (
    faculty_id = (select auth.uid())
    and status = 'draft'
)
with check (
    faculty_id = (select auth.uid())
    and status in ('draft', 'approved')
    and exists (
        select 1
        from public.courses c
        join public.profiles p
            on p.id = c.faculty_id
        where c.id = question_banks.course_id
          and c.faculty_id = (select auth.uid())
          and p.role = 'faculty'
    )
);

-- 8. Automatically update the modification timestamp

create or replace function public.update_question_bank_timestamp()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

drop trigger if exists
question_bank_updated_at
on public.question_banks;

create trigger question_bank_updated_at
before update on public.question_banks
for each row
execute function public.update_question_bank_timestamp();

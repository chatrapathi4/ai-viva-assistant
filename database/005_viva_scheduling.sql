
-- VivaAI Migration 005: Viva Scheduling

-- 1. Assessment schedule

create table public.assessments (
    id uuid primary key default gen_random_uuid(),

    question_bank_id uuid not null
        references public.question_banks(id),

    batch_id uuid not null
        references public.batches(id),

    faculty_id uuid not null
        references public.profiles(id),

    title text not null
        check (char_length(trim(title)) between 3 and 150),

    starts_at timestamptz not null,
    ends_at timestamptz not null,

    duration_minutes integer not null
        check (duration_minutes between 5 and 120),

    status text not null default 'scheduled'
        check (status in ('scheduled', 'cancelled')),

    created_at timestamptz not null default now(),

    check (ends_at > starts_at)
);

-- 2. Student assignments

create table public.assessment_assignments (
    id uuid primary key default gen_random_uuid(),

    assessment_id uuid not null
        references public.assessments(id) on delete cascade,

    student_id uuid not null
        references public.profiles(id),

    assigned_set text not null
        check (assigned_set in ('A', 'B', 'C')),

    created_at timestamptz not null default now(),

    unique (assessment_id, student_id)
);

create index assessments_faculty_idx
on public.assessments(faculty_id);

create index assessments_batch_idx
on public.assessments(batch_id);

create index assessments_starts_idx
on public.assessments(starts_at);

create index assignments_student_idx
on public.assessment_assignments(student_id);

-- 3. Enable RLS

alter table public.assessments
enable row level security;

alter table public.assessment_assignments
enable row level security;

revoke all on public.assessments
from anon, authenticated;

revoke all on public.assessment_assignments
from anon, authenticated;

grant select on public.assessments to authenticated;

grant select on public.assessment_assignments
to authenticated;

-- 4. Faculty and assigned students can read schedules

create policy "Read authorized assessments"
on public.assessments
for select
to authenticated
using (
    faculty_id = (select auth.uid())
    or exists (
        select 1
        from public.assessment_assignments aa
        where aa.assessment_id = assessments.id
          and aa.student_id = (select auth.uid())
    )
);

-- 5. Students can read only their own assignments

create policy "Students read their assignments"
on public.assessment_assignments
for select
to authenticated
using (
    student_id = (select auth.uid())
);

-- 6. Atomic faculty-only scheduling function

create or replace function public.schedule_viva(
    p_question_bank_id uuid,
    p_batch_id uuid,
    p_title text,
    p_starts_at timestamptz,
    p_ends_at timestamptz,
    p_duration_minutes integer
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_course_id uuid;
    v_assessment_id uuid;
    v_student_count integer;
begin
    -- Validate the title and schedule
    if char_length(trim(coalesce(p_title, '')))
       not between 3 and 150 then
        raise exception 'Invalid assessment title';
    end if;

    if p_starts_at is null
       or p_ends_at is null
       or p_starts_at <= now()
       or p_ends_at <= p_starts_at then
        raise exception 'Invalid assessment schedule';
    end if;

    if p_duration_minutes is null
       or p_duration_minutes not between 5 and 120 then
        raise exception 'Duration must be 5 to 120 minutes';
    end if;

    -- Verify faculty ownership and approved bank
    select qb.course_id
    into v_course_id
    from public.question_banks qb
    join public.courses c
      on c.id = qb.course_id
    join public.profiles f
      on f.id = c.faculty_id
    where qb.id = p_question_bank_id
      and qb.status = 'approved'
      and qb.faculty_id = (select auth.uid())
      and c.faculty_id = (select auth.uid())
      and f.role = 'faculty';

    if v_course_id is null then
        raise exception
          'Approved question bank not found or access denied';
    end if;

    -- Verify batch belongs to the same course
    if not exists (
        select 1
        from public.batches b
        join public.courses c on c.id = b.course_id
        join public.sections s on s.id = b.section_id
        where b.id = p_batch_id
          and b.course_id = v_course_id
          and s.department_id = c.department_id
    ) then
        raise exception 'Invalid batch for this course';
    end if;

    -- Count eligible students
    select count(*)
    into v_student_count
    from public.batch_members bm
    join public.batches b on b.id = bm.batch_id
    join public.profiles p on p.id = bm.student_id
    join public.enrollments e
      on e.student_id = p.id
     and e.course_id = b.course_id
    where bm.batch_id = p_batch_id
      and p.role = 'student'
      and p.section_id = b.section_id;

    if v_student_count = 0 then
        raise exception 'Batch has no eligible students';
    end if;

    -- Create assessment
    insert into public.assessments (
        question_bank_id,
        batch_id,
        faculty_id,
        title,
        starts_at,
        ends_at,
        duration_minutes
    )
    values (
        p_question_bank_id,
        p_batch_id,
        (select auth.uid()),
        trim(p_title),
        p_starts_at,
        p_ends_at,
        p_duration_minutes
    )
    returning id into v_assessment_id;

    -- Assign sets A, B, C evenly in randomized order
    insert into public.assessment_assignments (
        assessment_id,
        student_id,
        assigned_set
    )
    select
        v_assessment_id,
        eligible.student_id,
        case (eligible.rn - 1) % 3
            when 0 then 'A'
            when 1 then 'B'
            else 'C'
        end
    from (
        select
            bm.student_id,
            row_number() over (order by random()) as rn
        from public.batch_members bm
        join public.batches b
          on b.id = bm.batch_id
        join public.profiles p
          on p.id = bm.student_id
        join public.enrollments e
          on e.student_id = p.id
         and e.course_id = b.course_id
        where bm.batch_id = p_batch_id
          and p.role = 'student'
          and p.section_id = b.section_id
    ) eligible;

    return v_assessment_id;
end;
$$;

-- 7. Secure function execution

revoke execute on function public.schedule_viva(
    uuid, uuid, text, timestamptz, timestamptz, integer
)
from public, anon, authenticated;

grant execute on function public.schedule_viva(
    uuid, uuid, text, timestamptz, timestamptz, integer
)
to authenticated;


-- 8. to see which students have been assigned to which viva set, use this query:
select
    a.title,
    a.starts_at,
    a.ends_at,
    aa.student_id,
    p.full_name,
    aa.assigned_set
from public.assessments a
join public.assessment_assignments aa
    on aa.assessment_id = a.id
join public.profiles p
    on p.id = aa.student_id
order by a.created_at desc, aa.assigned_set;

-- VivaAI migration 007: secure AI-assisted grading and result publishing.
-- Execute once after 006_voice_attempts.sql.

create table public.viva_grades (
  attempt_id uuid not null references public.viva_attempts(id) on delete cascade,
  question_number integer not null check (question_number > 0),
  ai_marks numeric(6,2) not null check (ai_marks >= 0),
  final_marks numeric(6,2) not null check (final_marks >= 0),
  max_marks integer not null check (max_marks between 1 and 20),
  ai_feedback text not null,
  faculty_feedback text not null default '',
  reviewed boolean not null default false,
  graded_at timestamptz not null default now(),
  primary key (attempt_id, question_number),
  check (ai_marks <= max_marks and final_marks <= max_marks)
);

create table public.viva_results (
  attempt_id uuid primary key references public.viva_attempts(id) on delete cascade,
  status text not null default 'pending_review'
    check (status in ('pending_review', 'published')),
  published_at timestamptz,
  updated_at timestamptz not null default now()
);

create index viva_results_status_idx on public.viva_results(status);
alter table public.viva_grades enable row level security;
alter table public.viva_results enable row level security;
revoke all on public.viva_grades from anon, authenticated;
revoke all on public.viva_results from anon, authenticated;

-- Do not expose raw grading material or results tables to browser roles.
-- All operations use faculty/student-scoped RPCs.

-- An expired attempt is finalized by the first faculty queue/detail access.
-- Saved answers remain; missing answers are evaluated as blank.
create or replace function public.list_faculty_attempts()
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_rows jsonb;
begin
  if v_user is null or not exists (
    select 1 from public.profiles p where p.id = v_user and p.role = 'faculty'
  ) then raise exception 'Faculty access required'; end if;

  update public.viva_attempts va
  set status = 'submitted', submitted_at = now()
  from public.assessment_assignments aa, public.assessments a
  where va.assignment_id = aa.id and aa.assessment_id = a.id
    and a.faculty_id = v_user and va.status = 'in_progress'
    and now() >= least(a.ends_at, va.started_at + make_interval(mins => a.duration_minutes));

  select coalesce(jsonb_agg(to_jsonb(x) order by x.started_at desc), '[]'::jsonb)
  into v_rows
  from (
    select va.id as attempt_id, p.full_name as student_name,
           a.title as assessment_title, va.started_at, va.submitted_at,
           va.status as attempt_status,
           coalesce(vr.status, 'not_evaluated') as result_status,
           (select count(*) from public.viva_grades g where g.attempt_id = va.id) as graded_questions
    from public.viva_attempts va
    join public.assessment_assignments aa on aa.id = va.assignment_id
    join public.assessments a on a.id = aa.assessment_id
    join public.profiles p on p.id = va.student_id
    left join public.viva_results vr on vr.attempt_id = va.id
    where a.faculty_id = v_user
  ) x;
  return v_rows;
end;
$$;

-- Faculty-only access to reference answers, student transcripts and AI rubrics.
create or replace function public.get_grading_material(p_attempt_id uuid)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v record;
  v_questions jsonb;
  v_grades jsonb;
  v_status text;
begin
  select va.id, va.status as attempt_status, va.started_at, a.title,
         a.ends_at, a.duration_minutes, a.faculty_id, aa.assigned_set,
         qb.sets, qb.marks_per_question, p.full_name as student_name
    into v
  from public.viva_attempts va
  join public.assessment_assignments aa on aa.id = va.assignment_id
  join public.assessments a on a.id = aa.assessment_id
  join public.question_banks qb on qb.id = a.question_bank_id
  join public.profiles p on p.id = va.student_id
  where va.id = p_attempt_id and a.faculty_id = (select auth.uid())
    and exists (select 1 from public.profiles f
                where f.id = (select auth.uid()) and f.role = 'faculty');
  if not found then raise exception 'Not authorized'; end if;

  if v.attempt_status = 'in_progress' and now() >= least(
       v.ends_at, v.started_at + make_interval(mins => v.duration_minutes)) then
    update public.viva_attempts
    set status = 'submitted', submitted_at = now()
    where id = p_attempt_id and status = 'in_progress';
    v.attempt_status := 'submitted';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'number', q.ordinality,
    'question', q.value ->> 'question',
    'reference_answer', q.value ->> 'reference_answer',
    'key_points', q.value -> 'key_points',
    'grading_rubric', q.value ->> 'grading_rubric',
    'answer', coalesce(r.answer_text, ''),
    'max_marks', v.marks_per_question
  ) order by q.ordinality), '[]'::jsonb)
  into v_questions
  from jsonb_array_elements(v.sets) s
  cross join lateral jsonb_array_elements(s.value -> 'questions')
    with ordinality as q(value, ordinality)
  left join public.viva_responses r
    on r.attempt_id = p_attempt_id and r.question_number = q.ordinality
  where s.value ->> 'set_name' = v.assigned_set;

  select coalesce(jsonb_agg(to_jsonb(g) order by g.question_number), '[]'::jsonb)
  into v_grades from public.viva_grades g where g.attempt_id = p_attempt_id;
  select status into v_status from public.viva_results where attempt_id = p_attempt_id;

  return jsonb_build_object(
    'attempt_id', p_attempt_id, 'assessment_title', v.title,
    'student_name', v.student_name, 'attempt_status', v.attempt_status,
    'result_status', coalesce(v_status, 'not_evaluated'),
    'questions', v_questions, 'grades', v_grades
  );
end;
$$;

-- Atomic AI-grade recording; faculty explicitly triggers the operation.
create or replace function public.save_ai_evaluation(p_attempt_id uuid, p_grades jsonb)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v record;
  v_item jsonb;
  v_count integer;
  v_num integer;
  v_marks numeric;
  v_feedback text;
  v_seen integer[] := array[]::integer[];
begin
  select va.status as attempt_status, a.faculty_id, qb.sets,
         aa.assigned_set, qb.marks_per_question
  into v
  from public.viva_attempts va
  join public.assessment_assignments aa on aa.id = va.assignment_id
  join public.assessments a on a.id = aa.assessment_id
  join public.question_banks qb on qb.id = a.question_bank_id
  where va.id = p_attempt_id
    and a.faculty_id = (select auth.uid())
    and exists(select 1 from public.profiles f
               where f.id = (select auth.uid()) and f.role = 'faculty')
  for update of va;
  if not found then raise exception 'Not authorized'; end if;
  if v.attempt_status <> 'submitted' then raise exception 'Attempt not finalized'; end if;
  if exists (select 1 from public.viva_results r
             where r.attempt_id = p_attempt_id and r.status = 'published') then
    raise exception 'Published results are locked';
  end if;

  select jsonb_array_length(s.value -> 'questions') into v_count
  from jsonb_array_elements(v.sets) s
  where s.value ->> 'set_name' = v.assigned_set;
  if v_count is null or jsonb_typeof(p_grades) <> 'array'
     or jsonb_array_length(p_grades) <> v_count then
    raise exception 'Expected one grade for each assigned question';
  end if;

  for v_item in select value from jsonb_array_elements(p_grades) loop
    begin
      v_num := (v_item ->> 'question_number')::integer;
      v_marks := (v_item ->> 'marks')::numeric;
      v_feedback := trim(v_item ->> 'feedback');
    exception when others then
      raise exception 'Invalid grade format';
    end;
    if v_num is null or v_num < 1 or v_num > v_count
       or v_num = any(v_seen) or v_marks is null
       or v_marks < 0 or v_marks > v.marks_per_question
       or v_feedback is null or char_length(v_feedback) not between 1 and 2000 then
      raise exception 'Invalid grade values';
    end if;
    v_seen := array_append(v_seen, v_num);
  end loop;

  -- Re-evaluation resets faculty reviews; require review again.
  delete from public.viva_grades where attempt_id = p_attempt_id;
  for v_item in select value from jsonb_array_elements(p_grades) loop
    insert into public.viva_grades(
      attempt_id, question_number, ai_marks, final_marks,
      max_marks, ai_feedback
    ) values (
      p_attempt_id, (v_item ->> 'question_number')::integer,
      (v_item ->> 'marks')::numeric, (v_item ->> 'marks')::numeric,
      v.marks_per_question, trim(v_item ->> 'feedback')
    );
  end loop;
  insert into public.viva_results(attempt_id, status)
  values (p_attempt_id, 'pending_review')
  on conflict(attempt_id) do update set updated_at = now();
end;
$$;

create or replace function public.review_viva_grade(
  p_attempt_id uuid, p_question_number integer,
  p_final_marks numeric, p_feedback text
)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_max integer;
begin
  if not exists (
    select 1 from public.viva_attempts va
    join public.assessment_assignments aa on aa.id = va.assignment_id
    join public.assessments a on a.id = aa.assessment_id
    join public.profiles f on f.id = a.faculty_id
    where va.id = p_attempt_id and a.faculty_id = (select auth.uid())
      and f.role = 'faculty'
  ) then raise exception 'Not authorized'; end if;
  if exists (select 1 from public.viva_results
             where attempt_id = p_attempt_id and status = 'published') then
    raise exception 'Published results are locked';
  end if;
  select max_marks into v_max from public.viva_grades
  where attempt_id = p_attempt_id and question_number = p_question_number;
  if v_max is null or p_final_marks is null
     or p_final_marks < 0 or p_final_marks > v_max
     or char_length(coalesce(p_feedback, '')) > 2000 then
    raise exception 'Invalid mark or feedback';
  end if;
  update public.viva_grades
  set final_marks = p_final_marks,
      faculty_feedback = coalesce(p_feedback, ''), reviewed = true
  where attempt_id = p_attempt_id and question_number = p_question_number;
end;
$$;

create or replace function public.publish_viva_result(p_attempt_id uuid)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v record;
  v_expected integer;
  v_graded integer;
  v_reviewed integer;
  v_score numeric;
  v_max numeric;
begin
  select va.status, qb.sets, aa.assigned_set, a.faculty_id
  into v from public.viva_attempts va
  join public.assessment_assignments aa on aa.id = va.assignment_id
  join public.assessments a on a.id = aa.assessment_id
  join public.question_banks qb on qb.id = a.question_bank_id
  join public.profiles f on f.id = a.faculty_id
  where va.id = p_attempt_id and a.faculty_id = (select auth.uid())
    and f.role = 'faculty'
  for update of va;
  if not found then raise exception 'Not authorized'; end if;
  if v.status <> 'submitted' then raise exception 'Attempt not finalized'; end if;
  select jsonb_array_length(s.value -> 'questions') into v_expected
  from jsonb_array_elements(v.sets) s
  where s.value ->> 'set_name' = v.assigned_set;
  select count(*), count(*) filter(where reviewed),
         coalesce(sum(final_marks),0), coalesce(sum(max_marks),0)
  into v_graded, v_reviewed, v_score, v_max
  from public.viva_grades where attempt_id = p_attempt_id;
  if v_expected is null or v_graded <> v_expected or v_reviewed <> v_expected then
    raise exception 'Faculty must review every question before publishing';
  end if;
  update public.viva_results
  set status='published', published_at=now(), updated_at=now()
  where attempt_id = p_attempt_id and status='pending_review';
  if not found then raise exception 'Result unavailable or already published'; end if;
  return jsonb_build_object('score', v_score, 'max_marks', v_max, 'status', 'published');
end;
$$;

-- Only published scores and feedback are returned to the authenticated student.
create or replace function public.get_my_viva_results()
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare v_rows jsonb;
begin
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
  select coalesce(jsonb_agg(to_jsonb(x) order by x.published_at desc), '[]'::jsonb)
  into v_rows from (
    select a.title, r.published_at,
           sum(g.final_marks) as score, sum(g.max_marks) as max_marks,
           jsonb_agg(jsonb_build_object(
             'question_number', g.question_number,
             'marks', g.final_marks, 'max_marks', g.max_marks,
             'feedback', case when g.faculty_feedback <> ''
               then g.faculty_feedback else g.ai_feedback end
           ) order by g.question_number) as feedback
    from public.viva_results r
    join public.viva_attempts va on va.id = r.attempt_id
    join public.assessment_assignments aa on aa.id = va.assignment_id
    join public.assessments a on a.id = aa.assessment_id
    join public.viva_grades g on g.attempt_id = va.id
    where va.student_id = (select auth.uid()) and r.status = 'published'
    group by r.attempt_id, a.title, r.published_at
  ) x;
  return v_rows;
end;
$$;

-- Revoke PUBLIC's default EXECUTE privileges, then explicitly grant to signed-in users.
revoke all on function public.list_faculty_attempts() from public, anon, authenticated;
revoke all on function public.get_grading_material(uuid) from public, anon, authenticated;
revoke all on function public.save_ai_evaluation(uuid,jsonb) from public, anon, authenticated;
revoke all on function public.review_viva_grade(uuid,integer,numeric,text) from public, anon, authenticated;
revoke all on function public.publish_viva_result(uuid) from public, anon, authenticated;
revoke all on function public.get_my_viva_results() from public, anon, authenticated;
grant execute on function public.list_faculty_attempts() to authenticated;
grant execute on function public.get_grading_material(uuid) to authenticated;
grant execute on function public.save_ai_evaluation(uuid,jsonb) to authenticated;
grant execute on function public.review_viva_grade(uuid,integer,numeric,text) to authenticated;
grant execute on function public.publish_viva_result(uuid) to authenticated;
grant execute on function public.get_my_viva_results() to authenticated;

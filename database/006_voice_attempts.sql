-- VivaAI migration 006: secure voice-viva attempts
-- Execute once after 005_viva_scheduling.sql.

create table public.viva_attempts (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null unique references public.assessment_assignments(id),
  student_id uuid not null references public.profiles(id),
  started_at timestamptz not null default now(),
  submitted_at timestamptz,
  status text not null default 'in_progress'
    check (status in ('in_progress', 'submitted'))
);

create table public.viva_responses (
  attempt_id uuid not null references public.viva_attempts(id) on delete cascade,
  question_number integer not null check (question_number > 0),
  answer_text text not null check (char_length(answer_text) <= 4000),
  saved_at timestamptz not null default now(),
  primary key (attempt_id, question_number)
);

create index viva_attempts_student_idx on public.viva_attempts(student_id);
alter table public.viva_attempts enable row level security;
alter table public.viva_responses enable row level security;
revoke all on public.viva_attempts from anon, authenticated;
revoke all on public.viva_responses from anon, authenticated;

-- This RPC exposes only questions and the current student's own saved answers.
-- It never returns reference answers, key points or grading rubrics.
create function public.start_voice_viva(p_assignment_id uuid)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_assessment record;
  v_attempt public.viva_attempts%rowtype;
  v_set jsonb;
  v_questions jsonb;
  v_answers jsonb;
  v_deadline timestamptz;
begin
  if v_user is null then raise exception 'Authentication required'; end if;

  select a.id, a.title, a.starts_at, a.ends_at, a.duration_minutes,
         a.status, aa.assigned_set, qb.sets
  into v_assessment
  from public.assessment_assignments aa
  join public.assessments a on a.id = aa.assessment_id
  join public.question_banks qb on qb.id = a.question_bank_id
  where aa.id = p_assignment_id and aa.student_id = v_user;

  if not found then raise exception 'Assignment not found'; end if;
  if v_assessment.status <> 'scheduled' then
    raise exception 'Assessment is unavailable';
  end if;

  select * into v_attempt
  from public.viva_attempts
  where assignment_id = p_assignment_id;

  if not found then
    if now() < v_assessment.starts_at or now() >= v_assessment.ends_at then
      raise exception 'Assessment is outside its scheduled window';
    end if;
    insert into public.viva_attempts(assignment_id, student_id)
    values (p_assignment_id, v_user)
    on conflict (assignment_id) do nothing;
    select * into v_attempt from public.viva_attempts
    where assignment_id = p_assignment_id;
  end if;

  v_deadline := least(
    v_assessment.ends_at,
    v_attempt.started_at + make_interval(mins => v_assessment.duration_minutes)
  );

  if v_attempt.status <> 'in_progress' then
    raise exception 'Attempt already submitted';
  end if;
  if now() >= v_deadline then raise exception 'Attempt time has expired'; end if;

  select value into v_set
  from jsonb_array_elements(v_assessment.sets)
  where value ->> 'set_name' = v_assessment.assigned_set;

  if v_set is null then raise exception 'Assigned question set missing'; end if;

  select coalesce(
    jsonb_agg(jsonb_build_object(
      'number', q.ordinality,
      'question', q.value ->> 'question'
    ) order by q.ordinality),
    '[]'::jsonb
  ) into v_questions
  from jsonb_array_elements(v_set -> 'questions')
    with ordinality as q(value, ordinality);

  select coalesce(
    jsonb_agg(jsonb_build_object(
      'number', r.question_number,
      'answer', r.answer_text
    ) order by r.question_number),
    '[]'::jsonb
  ) into v_answers
  from public.viva_responses r
  where r.attempt_id = v_attempt.id;

  return jsonb_build_object(
    'attempt_id', v_attempt.id,
    'title', v_assessment.title,
    'deadline', v_deadline,
    'server_time', now(),
    'questions', v_questions,
    'answers', v_answers
  );
end;
$$;

create function public.save_voice_answer(
  p_attempt_id uuid,
  p_question_number integer,
  p_answer text
)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_attempt record;
  v_set jsonb;
  v_count integer;
begin
  select va.id, va.status, va.started_at, a.ends_at,
         a.duration_minutes, a.status as assessment_status,
         aa.assigned_set, qb.sets
  into v_attempt
  from public.viva_attempts va
  join public.assessment_assignments aa on aa.id = va.assignment_id
  join public.assessments a on a.id = aa.assessment_id
  join public.question_banks qb on qb.id = a.question_bank_id
  where va.id = p_attempt_id and va.student_id = (select auth.uid())
  for update of va;

  if not found then raise exception 'Attempt not found'; end if;
  if v_attempt.status <> 'in_progress'
     or v_attempt.assessment_status <> 'scheduled'
     or now() >= least(
       v_attempt.ends_at,
       v_attempt.started_at + make_interval(mins => v_attempt.duration_minutes)
     ) then
    raise exception 'Attempt is closed';
  end if;

  select value into v_set
  from jsonb_array_elements(v_attempt.sets)
  where value ->> 'set_name' = v_attempt.assigned_set;
  v_count := jsonb_array_length(v_set -> 'questions');

  if p_question_number is null or p_question_number < 1
     or p_question_number > v_count then
    raise exception 'Invalid question number';
  end if;
  if p_answer is null or char_length(p_answer) > 4000 then
    raise exception 'Answer must be at most 4000 characters';
  end if;

  insert into public.viva_responses (
    attempt_id, question_number, answer_text
  ) values (p_attempt_id, p_question_number, p_answer)
  on conflict (attempt_id, question_number)
  do update set answer_text = excluded.answer_text, saved_at = now();
end;
$$;

create function public.finish_voice_viva(p_attempt_id uuid)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_attempt record;
  v_count integer;
begin
  select va.id, va.status
  into v_attempt
  from public.viva_attempts va
  where va.id = p_attempt_id
    and va.student_id = (select auth.uid())
  for update;

  if not found then raise exception 'Attempt not found'; end if;
  if v_attempt.status = 'submitted' then
    raise exception 'Already submitted';
  end if;

  update public.viva_attempts
  set status = 'submitted', submitted_at = now()
  where id = p_attempt_id;

  select count(*) into v_count
  from public.viva_responses
  where attempt_id = p_attempt_id and length(trim(answer_text)) > 0;

  return jsonb_build_object(
    'status', 'submitted', 'answered_count', v_count
  );
end;
$$;

revoke execute on function public.start_voice_viva(uuid)
  from public, anon, authenticated;
revoke execute on function public.save_voice_answer(uuid, integer, text)
  from public, anon, authenticated;
revoke execute on function public.finish_voice_viva(uuid)
  from public, anon, authenticated;
grant execute on function public.start_voice_viva(uuid) to authenticated;
grant execute on function public.save_voice_answer(uuid, integer, text) to authenticated;
grant execute on function public.finish_voice_viva(uuid) to authenticated;

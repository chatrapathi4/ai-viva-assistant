-- VivaAI Migration 010: Student practice quizzes
-- Execute once AFTER 009_student_progress.sql.
-- Answer keys are stored in a table inaccessible to browser roles.

create table if not exists public.practice_quizzes (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  topic text not null check (char_length(trim(topic)) between 3 and 150),
  difficulty text not null check (difficulty in ('easy', 'medium', 'hard')),
  questions jsonb not null check (jsonb_typeof(questions) = 'array' and jsonb_array_length(questions) between 1 and 10),
  answers jsonb,
  correct_count integer check (correct_count >= 0),
  status text not null default 'in_progress' check (status in ('in_progress', 'completed')),
  created_at timestamptz not null default now(),
  submitted_at timestamptz,
  constraint completed_quiz_has_score check (
    (status = 'in_progress' and answers is null and correct_count is null and submitted_at is null)
    or
    (status = 'completed' and answers is not null and correct_count is not null and submitted_at is not null)
  )
);

create index if not exists practice_quizzes_student_created_idx
  on public.practice_quizzes(student_id, created_at desc);
create index if not exists practice_quizzes_course_idx
  on public.practice_quizzes(course_id);

alter table public.practice_quizzes enable row level security;
revoke all on public.practice_quizzes from anon, authenticated;
-- Deliberately NO browser-readable table grants or policies: contains correct answers.

-- A student can fetch their own quiz, with answers removed while active.
create or replace function public.get_practice_quiz(p_quiz_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_quiz public.practice_quizzes%rowtype;
  v_questions jsonb;
begin
  select * into v_quiz
  from public.practice_quizzes
  where id = p_quiz_id and student_id = (select auth.uid());

  if not found then
    raise exception 'Quiz not found';
  end if;

  if v_quiz.status = 'in_progress' then
    select coalesce(jsonb_agg(q.value - 'correct_index' - 'explanation' order by q.ordinality), '[]'::jsonb)
    into v_questions
    from jsonb_array_elements(v_quiz.questions) with ordinality as q(value, ordinality);
  else
    v_questions := v_quiz.questions;
  end if;

  return jsonb_build_object(
    'id', v_quiz.id,
    'course_id', v_quiz.course_id,
    'topic', v_quiz.topic,
    'difficulty', v_quiz.difficulty,
    'status', v_quiz.status,
    'questions', v_questions,
    'answers', v_quiz.answers,
    'correct_count', v_quiz.correct_count,
    'created_at', v_quiz.created_at,
    'submitted_at', v_quiz.submitted_at
  );
end;
$$;

-- Grade and close the quiz atomically. Students cannot submit twice.
create or replace function public.submit_practice_quiz(p_quiz_id uuid, p_answers jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_quiz public.practice_quizzes%rowtype;
  v_count integer;
  v_correct integer := 0;
  v_i integer;
  v_answer jsonb;
  v_choice integer;
  v_key integer;
begin
  select * into v_quiz
  from public.practice_quizzes
  where id = p_quiz_id and student_id = (select auth.uid())
  for update;

  if not found then raise exception 'Quiz not found'; end if;
  if v_quiz.status <> 'in_progress' then raise exception 'Quiz already submitted'; end if;

  v_count := jsonb_array_length(v_quiz.questions);
  if p_answers is null or jsonb_typeof(p_answers) <> 'array'
     or jsonb_array_length(p_answers) <> v_count then
    raise exception 'Invalid answer count';
  end if;

  for v_i in 0..(v_count - 1) loop
    v_answer := p_answers -> v_i;
    if jsonb_typeof(v_answer) not in ('number', 'null') then
      raise exception 'Invalid answer format';
    end if;
    if jsonb_typeof(v_answer) = 'number' then
      if (v_answer #>> '{}') !~ '^[0-3]$' then
        raise exception 'Invalid answer option';
      end if;
      v_choice := (v_answer #>> '{}')::integer;
    else
      v_choice := null;
    end if;
    v_key := ((v_quiz.questions -> v_i) ->> 'correct_index')::integer;
    if v_choice is not null and v_choice = v_key then
      v_correct := v_correct + 1;
    end if;
  end loop;

  update public.practice_quizzes
  set status = 'completed',
      answers = p_answers,
      correct_count = v_correct,
      submitted_at = now()
  where id = p_quiz_id;

  return public.get_practice_quiz(p_quiz_id);
end;
$$;

-- Return metadata only, without questions or answer keys.
create or replace function public.get_my_practice_quizzes()
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', q.id,
      'course_id', q.course_id,
      'topic', q.topic,
      'difficulty', q.difficulty,
      'status', q.status,
      'question_count', jsonb_array_length(q.questions),
      'correct_count', q.correct_count,
      'created_at', q.created_at,
      'submitted_at', q.submitted_at
    ) order by q.created_at desc
  ), '[]'::jsonb)
  from (
    select * from public.practice_quizzes
    where student_id = (select auth.uid())
    order by created_at desc
    limit 25
  ) q;
$$;

revoke all on function public.get_practice_quiz(uuid) from public, anon, authenticated;
revoke all on function public.submit_practice_quiz(uuid, jsonb) from public, anon, authenticated;
revoke all on function public.get_my_practice_quizzes() from public, anon, authenticated;
grant execute on function public.get_practice_quiz(uuid) to authenticated;
grant execute on function public.submit_practice_quiz(uuid, jsonb) to authenticated;
grant execute on function public.get_my_practice_quizzes() to authenticated;

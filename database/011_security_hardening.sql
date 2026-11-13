
-- VivaAI Migration 011
-- Question Bank Security Hardening
-- Run after migrations 001 through 010.

begin;

-- Keep Row Level Security enabled.

alter table public.question_banks
enable row level security;

-- Validate question banks and protect approved records.

create or replace function
public.validate_question_bank_change()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
    v_set jsonb;
    v_question jsonb;
    v_point jsonb;
    v_index integer := 0;
    v_seen text[] := array[]::text[];
    v_text text;
begin

    -- Approved question banks cannot be modified.
    if tg_op = 'UPDATE' then

        if old.status = 'approved' then
            raise exception
                'Approved question banks cannot be modified';
        end if;

        -- Protect identity and ownership.
        if new.id is distinct from old.id
           or new.faculty_id is distinct from old.faculty_id
           or new.course_id is distinct from old.course_id
           or new.created_at is distinct from old.created_at
        then
            raise exception
                'Question bank ownership and identity cannot change';
        end if;
    end if;

    -- New banks must start as drafts.
    if tg_op = 'INSERT'
       and new.status <> 'draft' then
        raise exception
            'New question banks must be drafts';
    end if;

    -- Validate content before approval.
    if new.status = 'approved' then

        if jsonb_typeof(new.sets) <> 'array'
           or jsonb_array_length(new.sets) <> 3 then
            raise exception
                'Exactly three question sets are required';
        end if;

        for v_set in
            select value
            from jsonb_array_elements(new.sets)
        loop
            v_index := v_index + 1;

            if jsonb_typeof(v_set) <> 'object' then
                raise exception 'Invalid question set';
            end if;

            if v_set ->> 'set_name'
               is distinct from
               (array['A', 'B', 'C'])[v_index] then
                raise exception
                    'Question sets must be ordered A, B, C';
            end if;

            if jsonb_typeof(v_set -> 'questions')
               is distinct from 'array' then
                raise exception
                    'Each set must contain questions';
            end if;

            if jsonb_array_length(
                v_set -> 'questions'
            ) <> new.question_count then
                raise exception
                    'Incorrect question count';
            end if;

            for v_question in
                select value
                from jsonb_array_elements(
                    v_set -> 'questions'
                )
            loop

                if jsonb_typeof(v_question)
                   is distinct from 'object' then
                    raise exception
                        'Invalid question format';
                end if;

                -- Check required text fields.
                if jsonb_typeof(
                    v_question -> 'question'
                ) is distinct from 'string'
                or jsonb_typeof(
                    v_question -> 'reference_answer'
                ) is distinct from 'string'
                or jsonb_typeof(
                    v_question -> 'grading_rubric'
                ) is distinct from 'string' then
                    raise exception
                        'Question, answer and rubric must be text';
                end if;

                if char_length(trim(
                    v_question ->> 'question'
                )) < 10
                or char_length(trim(
                    v_question ->> 'reference_answer'
                )) < 10
                or char_length(trim(
                    v_question ->> 'grading_rubric'
                )) < 10 then
                    raise exception
                        'Incomplete question or grading content';
                end if;

                -- Prevent identical questions across sets.
                v_text := lower(trim(
                    v_question ->> 'question'
                ));

                if v_text = any(v_seen) then
                    raise exception
                        'Duplicate questions are not allowed';
                end if;

                v_seen := array_append(v_seen, v_text);

                -- Check key points.
                if jsonb_typeof(
                    v_question -> 'key_points'
                ) is distinct from 'array' then
                    raise exception
                        'Key points must be an array';
                end if;

                if jsonb_array_length(
                    v_question -> 'key_points'
                ) = 0 then
                    raise exception
                        'At least one key point is required';
                end if;

                for v_point in
                    select value
                    from jsonb_array_elements(
                        v_question -> 'key_points'
                    )
                loop
                    if jsonb_typeof(v_point)
                       is distinct from 'string'
                       or char_length(trim(
                           v_point #>> '{}'
                       )) = 0 then
                        raise exception
                            'Key points cannot be empty';
                    end if;
                end loop;

            end loop;
        end loop;

    end if;

    return new;
end;
$$;

-- Install the trigger.

drop trigger if exists
question_bank_security_trigger
on public.question_banks;

create trigger question_bank_security_trigger
before insert or update
on public.question_banks
for each row
execute function
public.validate_question_bank_change();

-- Restrict direct execution of the trigger function.

revoke all on function
public.validate_question_bank_change()
from public, anon, authenticated;

commit;

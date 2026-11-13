
-- VivaAI Migration 009
-- Student Learning Progress

create or replace function public.get_student_progress()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_student_id uuid;
    v_result jsonb;
begin
    v_student_id := (select auth.uid());

    if not exists (
        select 1
        from public.profiles p
        where p.id = v_student_id
          and p.role = 'student'
    ) then
        raise exception 'Student access required';
    end if;

    with scored_attempts as (
        select
            va.id as attempt_id,
            a.id as assessment_id,
            a.title as assessment_title,
            c.id as course_id,
            c.title as course_title,
            c.code as course_code,
            vr.published_at,
            sum(vg.final_marks) as obtained,
            sum(vg.max_marks) as maximum,
            round(
                100.0 * sum(vg.final_marks)
                / nullif(sum(vg.max_marks), 0),
                1
            ) as percentage
        from public.viva_results vr
        join public.viva_attempts va
          on va.id = vr.attempt_id
        join public.assessment_assignments aa
          on aa.id = va.assignment_id
        join public.assessments a
          on a.id = aa.assessment_id
        join public.question_banks qb
          on qb.id = a.question_bank_id
        join public.courses c
          on c.id = qb.course_id
        join public.viva_grades vg
          on vg.attempt_id = va.id
        where va.student_id = v_student_id
          and vr.status = 'published'
        group by
            va.id,
            a.id,
            a.title,
            c.id,
            c.title,
            c.code,
            vr.published_at
        having sum(vg.max_marks) > 0
    )
    select jsonb_build_object(
        'enrolled_courses',
        (
            select count(*)
            from public.enrollments e
            where e.student_id = v_student_id
        ),
        'completed_vivas',
        (
            select count(*)
            from scored_attempts
        ),
        'average_score',
        (
            select round(avg(percentage), 1)
            from scored_attempts
        ),
        'best_score',
        (
            select max(percentage)
            from scored_attempts
        ),
        'course_performance',
        coalesce(
            (
                select jsonb_agg(
                    jsonb_build_object(
                        'course_id', cp.course_id,
                        'course_title', cp.course_title,
                        'course_code', cp.course_code,
                        'viva_count', cp.viva_count,
                        'average_percentage', cp.average_percentage
                    )
                    order by cp.course_title
                )
                from (
                    select
                        course_id,
                        course_title,
                        course_code,
                        count(*) as viva_count,
                        round(avg(percentage), 1)
                            as average_percentage
                    from scored_attempts
                    group by
                        course_id,
                        course_title,
                        course_code
                ) cp
            ),
            '[]'::jsonb
        ),
        'recent_results',
        coalesce(
            (
                select jsonb_agg(
                    jsonb_build_object(
                        'attempt_id', r.attempt_id,
                        'assessment_title', r.assessment_title,
                        'course_title', r.course_title,
                        'obtained', r.obtained,
                        'maximum', r.maximum,
                        'percentage', r.percentage,
                        'published_at', r.published_at
                    )
                    order by r.published_at desc
                )
                from (
                    select *
                    from scored_attempts
                    order by published_at desc
                    limit 5
                ) r
            ),
            '[]'::jsonb
        )
    )
    into v_result;

    return v_result;
end;
$$;

revoke execute on function
public.get_student_progress()
from public, anon, authenticated;

grant execute on function
public.get_student_progress()
to authenticated;

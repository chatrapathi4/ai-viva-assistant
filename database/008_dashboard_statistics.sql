
-- VivaAI Migration 008
-- Faculty Dashboard Statistics

create or replace function public.get_faculty_dashboard_stats()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_user_id uuid;
    v_result jsonb;
begin
    v_user_id := (select auth.uid());

    if not exists (
        select 1
        from public.profiles
        where id = v_user_id
          and role = 'faculty'
    ) then
        raise exception 'Faculty access required';
    end if;

    select jsonb_build_object(
        'total_courses',
        (
            select count(*)
            from public.courses c
            where c.faculty_id = v_user_id
        ),

        'total_students',
        (
            select count(distinct e.student_id)
            from public.enrollments e
            join public.courses c
              on c.id = e.course_id
            where c.faculty_id = v_user_id
        ),

        'scheduled_vivas',
        (
            select count(*)
            from public.assessments a
            where a.faculty_id = v_user_id
              and a.status = 'scheduled'
              and a.ends_at > now()
        ),

        'submitted_attempts',
        (
            select count(*)
            from public.viva_attempts va
            join public.assessment_assignments aa
              on aa.id = va.assignment_id
            join public.assessments a
              on a.id = aa.assessment_id
            where a.faculty_id = v_user_id
              and va.status = 'submitted'
        )
    )
    into v_result;

    return v_result;
end;
$$;

revoke execute on function
public.get_faculty_dashboard_stats()
from public, anon, authenticated;

grant execute on function
public.get_faculty_dashboard_stats()
to authenticated;

-- VivaAI | 001: Authentication profiles
-- Run first in the Supabase SQL Editor on a fresh project.
-- Supabase Auth manages auth.users; this table stores app-specific fields.

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  role text not null default 'student'
    check (role in ('student', 'faculty')),
  department text,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Users may read their own profile. Ordinary clients cannot assign roles.
revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;

drop policy if exists "Users can view their own profile" on public.profiles;
create policy "Users can view their own profile"
on public.profiles
for select to authenticated
using ((select auth.uid()) = id);

-- A trusted trigger creates a STUDENT profile for each new Auth user.
-- Never accept a faculty role from user-supplied signup metadata.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    'student'
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- Restrict direct calls to this trigger function.
revoke all on function public.handle_new_user() from public, anon, authenticated;

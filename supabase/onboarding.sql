-- supabase/onboarding.sql
-- Run this in the Supabase dashboard → SQL editor

create table if not exists public.user_onboarding (
  id           uuid        primary key default gen_random_uuid(),
  user_id      uuid        not null references auth.users(id) on delete cascade,
  company_id   uuid        not null references public.companies(id) on delete cascade,
  dismissed_at timestamptz,
  wizard_done  boolean     not null default false,
  created_at   timestamptz not null default now(),
  unique (user_id, company_id)
);

alter table public.user_onboarding enable row level security;

drop policy if exists "user_onboarding_select" on public.user_onboarding;
create policy "user_onboarding_select" on public.user_onboarding
  for select using (auth.uid() = user_id);

drop policy if exists "user_onboarding_insert" on public.user_onboarding;
create policy "user_onboarding_insert" on public.user_onboarding
  for insert with check (auth.uid() = user_id);

drop policy if exists "user_onboarding_update" on public.user_onboarding;
create policy "user_onboarding_update" on public.user_onboarding
  for update using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "user_onboarding_delete" on public.user_onboarding;
create policy "user_onboarding_delete" on public.user_onboarding
  for delete using (auth.uid() = user_id);

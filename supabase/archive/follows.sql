-- Following directors
-- Members can follow a director and see new films by them as they're added to Pheelm.
-- Run once in the Supabase SQL Editor. Safe to run again. (Also included in schema.sql.)

create table if not exists public.follows (
  user_id uuid not null references auth.users (id) on delete cascade,
  person_id uuid not null references public.people (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, person_id)
);

alter table public.follows enable row level security;
drop policy if exists "own follows" on public.follows;
create policy "own follows" on public.follows for all using (user_id = auth.uid()) with check (user_id = auth.uid());


-- Members' own collections
-- Everything a member saves is in "All" (their watchlist). On top of that they can make
-- collections of their own and sort saved films into them. Collections are private unless
-- the member makes one public, which gives it a shareable page.
-- Run once in the Supabase SQL Editor. Safe to run again. (Also included in schema.sql.)

create table if not exists public.lists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 80),
  description text check (char_length(description) <= 500),
  is_public boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists lists_user_idx on public.lists (user_id, created_at);

create table if not exists public.list_films (
  list_id uuid not null references public.lists (id) on delete cascade,
  film_id uuid not null references public.films (id) on delete cascade,
  added_at timestamptz not null default now(),
  primary key (list_id, film_id)
);

alter table public.lists enable row level security;
alter table public.list_films enable row level security;

-- Owners do anything with their own collections; anyone can read a public one.
drop policy if exists "read lists" on public.lists;
create policy "read lists" on public.lists for select using (is_public or user_id = auth.uid());
drop policy if exists "own lists" on public.lists;
create policy "own lists" on public.lists for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "read list films" on public.list_films;
create policy "read list films" on public.list_films for select using (
  exists (select 1 from public.lists l where l.id = list_films.list_id and (l.is_public or l.user_id = auth.uid()))
);
drop policy if exists "own list films" on public.list_films;
create policy "own list films" on public.list_films for all
  using (exists (select 1 from public.lists l where l.id = list_films.list_id and l.user_id = auth.uid()))
  with check (exists (select 1 from public.lists l where l.id = list_films.list_id and l.user_id = auth.uid()));

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

-- Films by the directors the signed-in member follows, added since they started following.
create or replace function public.follow_updates()
returns table (
  film_id uuid, slug text, title text, year int, poster_url text,
  director_name text, director_slug text, added_at timestamptz
)
language sql
stable
set search_path = public
as $$
  select f.id, f.slug, f.title, f.year, f.poster_url, p.name, p.slug, f.created_at
  from public.follows fo
  join public.credits c on c.person_id = fo.person_id and c.role = 'director'
  join public.films f on f.id = c.film_id and f.status = 'published'
  join public.people p on p.id = fo.person_id
  where fo.user_id = auth.uid() and f.created_at > fo.created_at
  order by f.created_at desc
  limit 60;
$$;

grant execute on function public.follow_updates() to authenticated;

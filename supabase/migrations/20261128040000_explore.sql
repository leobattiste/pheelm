-- Explore page (/explore).
-- 1. TMDB's worldwide popularity score on each film, for "Most popular" and the weekly picks.
--    Filled and kept fresh by the "Update popularity" job in Admin > Automation.
-- 2. explore_pins: an admin can pin the Movie of the week for a given week (the Monday it starts).
--    Without a pin, the page picks one on its own.

alter table public.films add column if not exists popularity real;
alter table public.films add column if not exists popularity_at timestamptz;
create index if not exists films_popularity on public.films (popularity desc nulls last) where status = 'published';

alter table public.admin_jobs drop constraint if exists admin_jobs_kind_check;
alter table public.admin_jobs add constraint admin_jobs_kind_check
  check (kind in ('posters', 'synopses', 'credits', 'people', 'awards', 'watch', 'popularity'));

create table if not exists public.explore_pins (
  week date primary key,
  film_id uuid not null references public.films(id) on delete cascade,
  pinned_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.explore_pins enable row level security;
-- Everyone reads the pin (the page is public); writes go through the server with the service key.
drop policy if exists "Anyone reads explore pins" on public.explore_pins;
create policy "Anyone reads explore pins" on public.explore_pins for select to anon, authenticated using (true);

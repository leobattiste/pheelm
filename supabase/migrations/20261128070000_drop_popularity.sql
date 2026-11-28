-- The popularity score is no longer used: Explore ranks films by their awards instead.
delete from public.admin_jobs where kind = 'popularity';
alter table public.admin_jobs drop constraint if exists admin_jobs_kind_check;
alter table public.admin_jobs add constraint admin_jobs_kind_check
  check (kind in ('posters', 'synopses', 'credits', 'people', 'awards', 'watch'));
drop index if exists public.films_popularity;
alter table public.films drop column if exists popularity;
alter table public.films drop column if exists popularity_at;

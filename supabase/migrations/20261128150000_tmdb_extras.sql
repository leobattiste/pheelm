-- More from TMDB for each film: themes (keywords), age rating, the series it belongs to, the title
-- logo and a few stills, studios, tagline, budget and box office, and TMDB's recommendations
-- (as TMDB ids, matched to Pheelm films when pages are built). Other titles go into the existing
-- `aka` column. `extras_at` records when a film was last filled, so the job can skip it.
alter table public.films
  add column if not exists keywords text[] not null default '{}',
  add column if not exists certification text,
  add column if not exists certification_country text,
  add column if not exists series jsonb,
  add column if not exists logo_url text,
  add column if not exists stills text[] not null default '{}',
  add column if not exists companies text[] not null default '{}',
  add column if not exists tagline text,
  add column if not exists budget bigint,
  add column if not exists revenue bigint,
  add column if not exists tmdb_recs integer[] not null default '{}',
  add column if not exists extras_at timestamptz;

create index if not exists films_keywords on public.films using gin (keywords);
create index if not exists films_companies on public.films using gin (companies);

alter table public.admin_jobs drop constraint if exists admin_jobs_kind_check;
alter table public.admin_jobs add constraint admin_jobs_kind_check
  check (kind in ('posters', 'synopses', 'credits', 'people', 'awards', 'watch', 'extras', 'changes'));

-- Fuller details for people, from TMDB: birth and death dates, birthplace, the job they're best
-- known for, and their IMDb and Instagram. Safe to run more than once.
alter table public.people
  add column if not exists born date,
  add column if not exists died date,
  add column if not exists birthplace text,
  add column if not exists known_for text,
  add column if not exists imdb_id text,
  add column if not exists instagram text,
  -- When these were last filled from TMDB, so the refresh only fetches people it hasn't yet.
  add column if not exists details_at timestamptz;

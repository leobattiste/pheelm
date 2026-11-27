-- Recorded from the live database, where it was applied on 2026-11-21. Posters no longer carry an
-- accent colour of their own (the poster colour in `color` is used instead).
drop index if exists public.films_accent_missing_idx;
alter table public.films drop column if exists accent;

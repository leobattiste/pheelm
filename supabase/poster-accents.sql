-- The colour a film page is lit with, taken from its poster.
--
-- The existing `color` column holds sharp's dominant-bin answer, which comes back near-black or
-- near-white for most posters: no use as a tint. `accent` holds the poster's characteristic colour
-- instead, measured from the pixels (see lib/poster-accent.ts). It is kept apart from `color` so
-- the card tints that already read `color` are unchanged.
alter table public.films add column if not exists accent text check (accent ~ '^#[0-9a-fA-F]{6}$');

-- Filled a slice at a time by POST /api/internal/accents, which looks for the ones still null.
create index if not exists films_accent_missing_idx on public.films (created_at) where accent is null;

-- Recorded from the live database, where it was applied on 2026-11-27. The first version of the
-- country and language normalisation; 20261127015758_films_normalize_keep_order.sql replaces the
-- function so the order of countries and languages is kept.
create or replace function pheelm_private.normalize_film_lists()
returns trigger language plpgsql set search_path = '' as $$
begin
  -- countries: common full names -> ISO-2
  new.countries := (
    select coalesce(array_agg(distinct v order by v), '{}')
    from (
      select case btrim(c)
        when 'United States' then 'US' when 'United States of America' then 'US' when 'USA' then 'US'
        when 'United Kingdom' then 'GB' when 'UK' then 'GB'
        else upper(btrim(c)) end v
      from unnest(new.countries) c where btrim(c) <> ''
    ) z);
  -- languages: collapse TMDB compound names ("A; B") to one canonical name
  new.languages := (
    select coalesce(array_agg(distinct v order by v), '{}')
    from (
      select case btrim(l)
        when 'Haitian; Haitian Creole' then 'Haitian Creole'
        when 'Chichewa; Nyanja' then 'Chichewa'
        when 'Nyanja' then 'Chichewa'
        else btrim(split_part(l, ';', 1)) end v
      from unnest(new.languages) l where btrim(l) <> ''
    ) z);
  return new;
end $$;

drop trigger if exists normalize_film_lists on public.films;
create trigger normalize_film_lists
  before insert or update of countries, languages on public.films
  for each row execute function pheelm_private.normalize_film_lists();

alter table public.films drop constraint if exists films_countries_iso2;
alter table public.films
  add constraint films_countries_iso2
  check (array_to_string(countries, ',') ~ '^([A-Z]{2}(,[A-Z]{2})*)?$');

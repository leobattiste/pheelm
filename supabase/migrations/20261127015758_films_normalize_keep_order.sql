-- Films: keep countries as ISO-3166 alpha-2 codes and languages as single names.
-- TMDB's spoken_languages english_name has compound values ("Haitian; Haitian Creole",
-- "Chichewa; Nyanja"); hand edits have used full country names ("United States").
-- Values are normalised on save (order kept, duplicates dropped) rather than rejected,
-- so imports never fail on a language name; countries must end up as two capital letters.

create or replace function pheelm_private.normalize_film_lists()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.countries := (
    select coalesce(array_agg(v order by first_pos), '{}')
    from (
      select v, min(pos) first_pos from (
        select case btrim(c)
          when 'United States' then 'US' when 'United States of America' then 'US' when 'USA' then 'US'
          when 'United Kingdom' then 'GB' when 'UK' then 'GB'
          else upper(btrim(c)) end v, pos
        from unnest(new.countries) with ordinality as t(c, pos) where btrim(c) <> ''
      ) a group by v
    ) z);
  new.languages := (
    select coalesce(array_agg(v order by first_pos), '{}')
    from (
      select v, min(pos) first_pos from (
        select case btrim(l)
          when 'Haitian; Haitian Creole' then 'Haitian Creole'
          when 'Chichewa; Nyanja' then 'Chichewa'
          when 'Nyanja' then 'Chichewa'
          else btrim(split_part(l, ';', 1)) end v, pos
        from unnest(new.languages) with ordinality as t(l, pos) where btrim(l) <> ''
      ) a group by v
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

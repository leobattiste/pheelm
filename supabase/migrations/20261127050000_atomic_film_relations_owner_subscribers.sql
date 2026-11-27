-- 1. Saving a film replaced its credits and collections in separate requests: delete everything,
--    then insert. If an insert failed, the film was left with no director (and the collection
--    changes were never checked). Now both are replaced in one transaction, or not at all.
--
--    p_credits: [{ "person_id": uuid, "role": text, "character": text|null }] in display order.
--    Runs as the caller, so the admin policies on credits and collection_films still apply.
create or replace function public.admin_save_film_relations(p_film uuid, p_credits jsonb, p_collections uuid[] default '{}')
returns void language plpgsql security invoker set search_path = '' as $$
declare film_year int;
begin
  if not public.is_admin() then raise exception 'Admin access required' using errcode = '42501'; end if;
  if jsonb_typeof(p_credits) is distinct from 'array' then raise exception 'Credits must be a list'; end if;
  select year into film_year from public.films where id = p_film;
  if not found then raise exception 'That film no longer exists'; end if;

  delete from public.credits where film_id = p_film;
  insert into public.credits (film_id, person_id, role, "character", sort)
  select distinct on ((c ->> 'person_id')::uuid, c ->> 'role')
    p_film, (c ->> 'person_id')::uuid, c ->> 'role', nullif(c ->> 'character', ''), (n - 1)::int
  from jsonb_array_elements(p_credits) with ordinality as t(c, n)
  order by (c ->> 'person_id')::uuid, c ->> 'role', n;

  delete from public.collection_films where film_id = p_film;
  insert into public.collection_films (collection_id, film_id, sort)
  select distinct c, p_film, coalesce(film_year, 0) from unnest(coalesce(p_collections, '{}')) as c;
end $$;
revoke all on function public.admin_save_film_relations(uuid, jsonb, uuid[]) from public, anon;
grant execute on function public.admin_save_film_relations(uuid, jsonb, uuid[]) to authenticated, service_role;

-- 2. The raw newsletter list is the owner's, like its export and Admin → Inbox → Newsletter
--    (admin_newsletter, email_confirmed_subscribers). Admins could still read every address
--    straight from the table.
drop policy if exists "Admins read subscribers" on public.subscribers;
drop policy if exists "Owner reads subscribers" on public.subscribers;
create policy "Owner reads subscribers" on public.subscribers as permissive for select to authenticated
  using ((select public.is_owner()));

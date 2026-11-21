-- Admin Films filter "Missing director": the films that have no director credit. Safe to run twice.
create or replace function public.admin_films_without_director() returns setof uuid
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'Admin access required' using errcode = '42501'; end if;
  return query
    select f.id from public.films f
    where not exists (select 1 from public.credits c where c.film_id = f.id and c.role = 'director')
    limit 500;
end $$;
revoke all on function public.admin_films_without_director() from public, anon;
grant execute on function public.admin_films_without_director() to authenticated;

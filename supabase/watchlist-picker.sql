-- Atomic picker actions, executed with the member's existing RLS permissions.
create or replace function public.save_film_to_collection(fid uuid, lid uuid default null, collection_title text default null)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare target uuid := lid; owner_id uuid;
begin
  if auth.uid() is null then raise exception 'Sign in first.' using errcode = '42501'; end if;
  if target is null then
    if collection_title is null or char_length(btrim(collection_title)) not between 1 and 80 then
      raise exception 'Enter a collection name.' using errcode = '22023';
    end if;
    insert into public.lists (user_id, title) values (auth.uid(), btrim(collection_title)) returning id into target;
  end if;
  select user_id into owner_id from public.lists where id = target;
  if owner_id is null then raise exception 'Collection not available.' using errcode = '42501'; end if;
  insert into public.list_films (list_id, film_id) values (target, fid) on conflict do nothing;
  if owner_id = auth.uid() then
    insert into public.watchlist (user_id, film_id) values (auth.uid(), fid) on conflict do nothing;
  end if;
  return target;
end $$;
revoke all on function public.save_film_to_collection(uuid, uuid, text) from public, anon;
grant execute on function public.save_film_to_collection(uuid, uuid, text) to authenticated;

create or replace function public.remove_film_from_watchlist(fid uuid)
returns void language plpgsql security invoker set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Sign in first.' using errcode = '42501'; end if;
  delete from public.list_films lf using public.lists l
    where lf.list_id = l.id and l.user_id = auth.uid() and lf.film_id = fid;
  delete from public.watchlist where user_id = auth.uid() and film_id = fid;
end $$;
revoke all on function public.remove_film_from_watchlist(uuid) from public, anon;
grant execute on function public.remove_film_from_watchlist(uuid) to authenticated;

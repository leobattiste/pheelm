-- Following collections, and keeping some directors out of the directory. Run after
-- follow-notifications.sql. Safe to run more than once.
--
-- 1. Following a collection is the existing "save" (public.list_saves). When a film is added to a
--    public collection, everyone who follows it (except whoever added the film) gets one
--    "collection_film" notification for that film in that collection.
-- 2. people.in_directory: false keeps a person in the credits of their films but out of the
--    Directors page, its counts and search (for co-directors who aren't Black filmmakers).

alter table public.people add column if not exists in_directory boolean not null default true;

alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications add constraint notifications_type_check check (type in ('invite', 'request',
  'invite_accepted', 'invite_declined', 'request_accepted', 'request_declined', 'removed', 'comment', 'reply',
  'mention', 'new_film', 'collection_film'));

create or replace function public.on_list_film_added() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.notifications (user_id, actor_id, type, list_id, film_id)
  select s.user_id, new.added_by, 'collection_film', new.list_id, new.film_id
  from public.list_saves s
  join public.lists l on l.id = s.list_id and l.is_public and not l.hidden
  join public.films f on f.id = new.film_id and f.status = 'published'
  join public.profiles pr on pr.id = s.user_id
  where s.list_id = new.list_id
    and s.user_id is distinct from new.added_by
    and not exists (select 1 from public.notifications n
      where n.user_id = s.user_id and n.type = 'collection_film' and n.list_id = new.list_id and n.film_id = new.film_id);
  return null;
end $$;
revoke execute on function public.on_list_film_added() from public, anon, authenticated;
drop trigger if exists list_film_added_notify on public.list_films;
create trigger list_film_added_notify after insert on public.list_films
  for each row execute function public.on_list_film_added();

-- 3. Who a member follows shows on their profile, unless the profile is private.
drop policy if exists "public follows" on public.follows;
create policy "public follows" on public.follows for select to anon, authenticated
  using (exists (select 1 from public.profiles p where p.id = follows.user_id and not coalesce(p.is_private, false)));

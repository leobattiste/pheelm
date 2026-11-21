-- Following directors, with notifications. Run after collaboration.sql. Safe to run more than once.
--
-- A member follows a director (public.follows, which already exists). When a film by that
-- director is published, or a director credit is added to a published film, each follower gets
-- one "new_film" notification for it.

alter table public.notifications add column if not exists film_id uuid references public.films(id) on delete cascade;
alter table public.notifications add column if not exists person_id uuid references public.people(id) on delete cascade;
create index if not exists notifications_film_idx on public.notifications (film_id);
create index if not exists notifications_person_idx on public.notifications (person_id);

alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications add constraint notifications_type_check check (type in ('invite', 'request',
  'invite_accepted', 'invite_declined', 'request_accepted', 'request_declined', 'removed', 'comment', 'reply',
  'mention', 'new_film'));

-- Follows: each member's own rows, faster policy form.
drop policy if exists "own follows" on public.follows;
create policy "own follows" on public.follows for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- Notify followers of one film's directors, once per member and film.
create or replace function public.notify_new_film(fid uuid) returns void
language sql security definer set search_path = public as $$
  insert into public.notifications (user_id, type, film_id, person_id)
  select distinct on (fo.user_id) fo.user_id, 'new_film', fid, fo.person_id
  from public.credits c
  join public.follows fo on fo.person_id = c.person_id
  join public.profiles pr on pr.id = fo.user_id
  join public.films f on f.id = c.film_id and f.status = 'published'
  where c.film_id = fid and c.role = 'director'
    and not exists (select 1 from public.notifications n where n.user_id = fo.user_id and n.type = 'new_film' and n.film_id = fid)
  order by fo.user_id, c.sort nulls last;
$$;
revoke execute on function public.notify_new_film(uuid) from public, anon, authenticated;

create or replace function public.on_film_published() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'published' and (tg_op = 'INSERT' or old.status is distinct from 'published') then
    perform public.notify_new_film(new.id);
  end if;
  return null;
end $$;
revoke execute on function public.on_film_published() from public, anon, authenticated;
drop trigger if exists film_published_notify on public.films;
create trigger film_published_notify after insert or update of status on public.films
  for each row execute function public.on_film_published();

create or replace function public.on_director_credit() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.role = 'director' then perform public.notify_new_film(new.film_id); end if;
  return null;
end $$;
revoke execute on function public.on_director_credit() from public, anon, authenticated;
drop trigger if exists director_credit_notify on public.credits;
create trigger director_credit_notify after insert on public.credits
  for each row execute function public.on_director_credit();

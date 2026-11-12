-- Comments on films, alongside comments on watchlists, in the same table so likes, reports,
-- removal, notifications, blocks, suspension and the rate limit all work the same way.
-- Run after comments.sql, collaboration.sql and admins-watched-blocks.sql. Safe to run more than once.
--
-- A comment belongs to exactly one watchlist or one film. On films:
--   read     anyone who can see the film (published, or an admin)
--   comment  signed-in members with a profile
--   delete   your own, or an admin (a film has no owner to moderate it)
--   spoiler  a comment can be marked as containing spoilers; the page hides it until tapped

alter table public.list_comments alter column list_id drop not null;
alter table public.list_comments add column if not exists film_id uuid references public.films(id) on delete cascade;
alter table public.list_comments add column if not exists spoiler boolean not null default false;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'list_comments_one_target' and conrelid = 'public.list_comments'::regclass) then
    alter table public.list_comments add constraint list_comments_one_target check (num_nonnulls(list_id, film_id) = 1);
  end if;
end $$;
create index if not exists list_comments_film_idx on public.list_comments (film_id, created_at) where film_id is not null;
create index if not exists list_comments_user_created_idx on public.list_comments (user_id, created_at desc);

-- Who can see, post, edit and delete.
drop policy if exists "read comments" on public.list_comments;
drop policy if exists "post comments" on public.list_comments;
drop policy if exists "delete comments" on public.list_comments;

-- The lists and films tables' own rules decide who can see the comments.
create policy "read comments" on public.list_comments for select to anon, authenticated
  using (
    (list_id is not null and exists (select 1 from public.lists l where l.id = list_id))
    or (film_id is not null and exists (select 1 from public.films f where f.id = film_id))
  );
create policy "post comments" on public.list_comments for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.member_profiles m where m.id = (select auth.uid()))
    and (
      (list_id is not null and exists (select 1 from public.lists l where l.id = list_id and l.is_public and not l.hidden and l.comments_enabled))
      or (film_id is not null and exists (select 1 from public.films f where f.id = film_id and f.status = 'published'))
    )
  );
create policy "delete comments" on public.list_comments for delete to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()) or (list_id is not null and public.can_edit_list(list_id)));

-- Replies stay one level deep and on the same watchlist or film; edits only touch the text and
-- the spoiler mark; and a member can post at most 6 comments a minute.
create or replace function public.guard_comment() returns trigger
language plpgsql security definer set search_path = public as $$
declare p public.list_comments;
begin
  if tg_op = 'INSERT' then
    if new.parent_id is not null then
      select * into p from public.list_comments where id = new.parent_id;
      if p.id is null or p.list_id is distinct from new.list_id or p.film_id is distinct from new.film_id or p.removed_at is not null then
        raise exception 'Reply to a comment on this page.' using errcode = 'check_violation';
      end if;
      if p.parent_id is not null then new.parent_id := p.parent_id; end if;
    end if;
    if (select count(*) from public.list_comments
        where user_id = new.user_id and created_at > now() - interval '1 minute') >= 6 then
      raise exception 'You''re commenting very fast. Wait a minute and try again.' using errcode = 'check_violation';
    end if;
    new.body := btrim(new.body);
    new.created_at := now();
    new.edited_at := null;
    new.removed_at := null;
    if new.list_id is not null then new.spoiler := false; end if;
  else
    new.id := old.id; new.list_id := old.list_id; new.film_id := old.film_id; new.user_id := old.user_id;
    new.parent_id := old.parent_id; new.created_at := old.created_at;
    new.body := btrim(new.body);
    if new.list_id is not null then new.spoiler := false; end if;
    if new.removed_at is null then new.removed_at := old.removed_at; end if;
    if new.removed_at is null and new.body is distinct from old.body then new.edited_at := now(); else new.edited_at := old.edited_at; end if;
  end if;
  return new;
end $$;
revoke execute on function public.guard_comment() from public, anon, authenticated;

-- No commenting on a blocked member's watchlist, or replying to someone either of you blocked.
create or replace function public.guard_blocked_comment() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.list_id is not null and public.is_blocked((select user_id from public.lists where id = new.list_id), new.user_id) then
    raise exception 'You can''t comment on this collection.';
  end if;
  if new.parent_id is not null and public.is_blocked((select user_id from public.list_comments where id = new.parent_id), new.user_id) then
    raise exception 'You can''t reply to this comment.';
  end if;
  return new;
end $$;
revoke execute on function public.guard_blocked_comment() from public, anon, authenticated;

-- Who hears about a new comment: the person replied to, anyone @mentioned, and on a watchlist
-- its owner and co-curators. Film comments carry the film so the notification can link to it.
create or replace function public.notify_comment() returns trigger
language plpgsql security definer set search_path = public as $$
declare told uuid[] := array[new.user_id]; r uuid; parent_author uuid;
begin
  if new.parent_id is not null then
    select user_id into parent_author from public.list_comments where id = new.parent_id;
    if parent_author is not null and not parent_author = any(told) then
      if new.film_id is not null then
        insert into public.notifications (user_id, actor_id, type, film_id, comment_id) values (parent_author, new.user_id, 'reply', new.film_id, new.id);
      else
        perform public.notify(parent_author, 'reply', new.user_id, new.list_id, new.id);
      end if;
      told := told || parent_author;
    end if;
  end if;
  for r in
    select distinct m.id from public.member_profiles m
    where m.handle in (select lower(rm.x[1]) from regexp_matches(new.body, '@([A-Za-z0-9_]{3,24})', 'g') as rm(x))
    limit 10
  loop
    if not r = any(told) then
      if new.film_id is not null then
        insert into public.notifications (user_id, actor_id, type, film_id, comment_id) values (r, new.user_id, 'mention', new.film_id, new.id);
      else
        perform public.notify(r, 'mention', new.user_id, new.list_id, new.id);
      end if;
      told := told || r;
    end if;
  end loop;
  if new.list_id is not null then
    for r in
      select user_id from public.lists where id = new.list_id
      union select user_id from public.list_members where list_id = new.list_id and status = 'active'
    loop
      if not r = any(told) then
        perform public.notify(r, 'comment', new.user_id, new.list_id, new.id);
        told := told || r;
      end if;
    end loop;
  end if;
  return null;
end $$;
revoke execute on function public.notify_comment() from public, anon, authenticated;

-- Reports tell the admins which watchlist or film the comment is on.
create or replace function public.notify_admins_comment_report() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.notifications (user_id, actor_id, type, list_id, film_id, comment_id, ref_id, detail)
  select a.id, new.user_id, 'comment_report', c.list_id, c.film_id, new.comment_id, new.id, left(new.reason, 200)
  from public.profiles a, public.list_comments c where a.is_admin and c.id = new.comment_id;
  return null;
end $$;
revoke execute on function public.notify_admins_comment_report() from public, anon, authenticated;

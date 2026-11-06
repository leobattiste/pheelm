-- Comments on members' public collections, with one level of replies and likes.
-- Run after list-tags.sql. Safe to run more than once.
--
-- Who can do what:
--   read     anyone who can see the collection
--   comment  signed-in members with a profile (handle), on public, visible collections
--   edit     your own comments
--   delete   your own, any on your collection (the curator moderates), or an admin
--   like     signed-in members, once per comment

create table if not exists public.list_comments (
  id uuid primary key default gen_random_uuid(),
  list_id uuid not null references public.lists(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  parent_id uuid references public.list_comments(id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 1000),
  created_at timestamptz not null default now(),
  edited_at timestamptz
);
create index if not exists list_comments_list_idx on public.list_comments (list_id, created_at);
create index if not exists list_comments_user_idx on public.list_comments (user_id);
create index if not exists list_comments_parent_idx on public.list_comments (parent_id);
alter table public.list_comments enable row level security;

create table if not exists public.comment_likes (
  comment_id uuid not null references public.list_comments(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (comment_id, user_id)
);
create index if not exists comment_likes_user_idx on public.comment_likes (user_id);
alter table public.comment_likes enable row level security;

drop policy if exists "read comments" on public.list_comments;
drop policy if exists "post comments" on public.list_comments;
drop policy if exists "edit own comments" on public.list_comments;
drop policy if exists "delete comments" on public.list_comments;

-- The lists table's own rules decide who can see the collection, so they decide the comments too.
create policy "read comments" on public.list_comments for select to anon, authenticated
  using (exists (select 1 from public.lists l where l.id = list_id));
create policy "post comments" on public.list_comments for insert to authenticated
  with check (user_id = (select auth.uid())
    and exists (select 1 from public.lists l where l.id = list_id and l.is_public and not l.hidden)
    and exists (select 1 from public.member_profiles m where m.id = (select auth.uid())));
create policy "edit own comments" on public.list_comments for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "delete comments" on public.list_comments for delete to authenticated
  using (user_id = (select auth.uid())
    or (select public.is_admin())
    or exists (select 1 from public.lists l where l.id = list_id and l.user_id = (select auth.uid())));

drop policy if exists "read likes" on public.comment_likes;
drop policy if exists "like" on public.comment_likes;
drop policy if exists "unlike" on public.comment_likes;
create policy "read likes" on public.comment_likes for select to anon, authenticated
  using (exists (select 1 from public.list_comments c where c.id = comment_id));
create policy "like" on public.comment_likes for insert to authenticated
  with check (user_id = (select auth.uid()) and exists (select 1 from public.list_comments c where c.id = comment_id));
create policy "unlike" on public.comment_likes for delete to authenticated
  using (user_id = (select auth.uid()));

-- Replies stay one level deep and on the same collection; edits only touch the text; and a
-- member can post at most 6 comments a minute.
create or replace function public.guard_comment() returns trigger
language plpgsql security definer set search_path = public as $$
declare p public.list_comments;
begin
  if tg_op = 'INSERT' then
    if new.parent_id is not null then
      select * into p from public.list_comments where id = new.parent_id;
      if p.id is null or p.list_id <> new.list_id then
        raise exception 'Reply to a comment on this collection.' using errcode = 'check_violation';
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
  else
    new.id := old.id; new.list_id := old.list_id; new.user_id := old.user_id;
    new.parent_id := old.parent_id; new.created_at := old.created_at;
    new.body := btrim(new.body);
    if new.body is distinct from old.body then new.edited_at := now(); else new.edited_at := old.edited_at; end if;
  end if;
  return new;
end $$;
revoke execute on function public.guard_comment() from public, anon, authenticated;
drop trigger if exists guard_comment on public.list_comments;
create trigger guard_comment before insert or update on public.list_comments
  for each row execute function public.guard_comment();

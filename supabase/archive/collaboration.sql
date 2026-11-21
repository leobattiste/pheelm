-- Collaboration on collections, notifications, and comment moderation.
-- Run after comments.sql. Safe to run more than once.
--
-- Roles on a collection:
--   owner         everything: privacy, delete, people, pin, turn comments off
--   collaborator  add and remove films, edit title and description, remove comments, leave
-- People join by invite (owner -> member accepts) or request (member asks -> owner approves).
-- Membership changes go through the functions below, which check who may do what and send
-- the notifications; nobody writes to list_members directly.

-- Tagging is replaced by collaboration.
drop table if exists public.list_tags cascade;
drop function if exists public.limit_list_tags();

-- Members ---------------------------------------------------------------------------------------

create table if not exists public.list_members (
  list_id uuid not null references public.lists(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  status text not null check (status in ('invited', 'requested', 'active', 'declined')),
  note text check (char_length(note) <= 280),
  invited_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  primary key (list_id, user_id)
);
create index if not exists list_members_user_idx on public.list_members (user_id, status);
create index if not exists list_members_invited_by_idx on public.list_members (invited_by);
alter table public.list_members enable row level security;

-- Helpers that read memberships without going through RLS (the lists and list_members rules
-- refer to each other, and would otherwise loop).
create or replace function public.is_list_owner(lid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.lists where id = lid and user_id = auth.uid());
$$;
create or replace function public.is_list_collaborator(lid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.list_members where list_id = lid and user_id = auth.uid() and status = 'active');
$$;
create or replace function public.can_edit_list(lid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_list_owner(lid) or public.is_list_collaborator(lid);
$$;

drop policy if exists "read members" on public.list_members;
create policy "read members" on public.list_members for select to anon, authenticated
  using (user_id = (select auth.uid())
    or (select public.is_admin())
    or public.is_list_owner(list_id)
    or (status = 'active' and exists (select 1 from public.lists l where l.id = list_id)));

-- Collections: collaborators can see and edit them --------------------------------------------

alter table public.lists add column if not exists comments_enabled boolean not null default true;
alter table public.lists add column if not exists pinned_comment_id uuid references public.list_comments(id) on delete set null;
create index if not exists lists_pinned_comment_idx on public.lists (pinned_comment_id);

drop policy if exists "read lists" on public.lists;
create policy "read lists" on public.lists for select to anon, authenticated
  using ((is_public and not hidden) or user_id = (select auth.uid()) or (select public.is_admin()) or public.is_list_collaborator(id));
drop policy if exists "update lists" on public.lists;
create policy "update lists" on public.lists for update to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()) or public.is_list_collaborator(id))
  with check (user_id = (select auth.uid()) or (select public.is_admin()) or public.is_list_collaborator(id));

-- Collaborators change the words only; the owner can't hand the collection to someone else.
create or replace function public.guard_list_owner_fields() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if public.is_admin() then return new; end if;
  new.user_id := old.user_id;
  if old.user_id is distinct from auth.uid() then
    new.is_public := old.is_public;
    new.comments_enabled := old.comments_enabled;
    -- Anyone who can remove a comment may clear the pin it held; only the owner pins.
    if new.pinned_comment_id is not null then new.pinned_comment_id := old.pinned_comment_id; end if;
  end if;
  if new.pinned_comment_id is not null and new.pinned_comment_id is distinct from old.pinned_comment_id
     and not exists (select 1 from public.list_comments where id = new.pinned_comment_id and list_id = new.id and parent_id is null) then
    raise exception 'Pin a comment from this collection.' using errcode = 'check_violation';
  end if;
  return new;
end $$;
revoke execute on function public.guard_list_owner_fields() from public, anon, authenticated;
drop trigger if exists guard_list_owner_fields on public.lists;
create trigger guard_list_owner_fields before update on public.lists
  for each row execute function public.guard_list_owner_fields();

-- Films in a collection: who added each one, and collaborators can add and remove.
alter table public.list_films add column if not exists added_by uuid references public.profiles(id) on delete set null default auth.uid();
create index if not exists list_films_added_by_idx on public.list_films (added_by);
update public.list_films lf set added_by = l.user_id from public.lists l where l.id = lf.list_id and lf.added_by is null;

drop policy if exists "read list films" on public.list_films;
drop policy if exists "insert own list films" on public.list_films;
drop policy if exists "update own list films" on public.list_films;
drop policy if exists "delete own list films" on public.list_films;
create policy "read list films" on public.list_films for select to anon, authenticated
  using (exists (select 1 from public.lists l where l.id = list_id));
create policy "insert own list films" on public.list_films for insert to authenticated
  with check (public.can_edit_list(list_id) and added_by = (select auth.uid()));
create policy "update own list films" on public.list_films for update to authenticated
  using (public.can_edit_list(list_id)) with check (public.can_edit_list(list_id));
create policy "delete own list films" on public.list_films for delete to authenticated
  using (public.can_edit_list(list_id));

-- Notifications ---------------------------------------------------------------------------------

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete cascade,
  type text not null check (type in ('invite', 'request', 'invite_accepted', 'invite_declined',
    'request_accepted', 'request_declined', 'removed', 'comment', 'reply', 'mention')),
  list_id uuid references public.lists(id) on delete cascade,
  comment_id uuid references public.list_comments(id) on delete cascade,
  created_at timestamptz not null default now(),
  read_at timestamptz
);
create index if not exists notifications_user_idx on public.notifications (user_id, created_at desc);
create index if not exists notifications_actor_idx on public.notifications (actor_id);
create index if not exists notifications_list_idx on public.notifications (list_id);
create index if not exists notifications_comment_idx on public.notifications (comment_id);
alter table public.notifications enable row level security;

drop policy if exists "read own notifications" on public.notifications;
drop policy if exists "mark own notifications" on public.notifications;
drop policy if exists "clear own notifications" on public.notifications;
create policy "read own notifications" on public.notifications for select to authenticated
  using (user_id = (select auth.uid()));
create policy "mark own notifications" on public.notifications for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "clear own notifications" on public.notifications for delete to authenticated
  using (user_id = (select auth.uid()));

create or replace function public.notify(recipient uuid, kind text, actor uuid, lid uuid, cid uuid default null) returns void
language plpgsql security definer set search_path = public as $$
begin
  if recipient is null or recipient = actor then return; end if;
  insert into public.notifications (user_id, actor_id, type, list_id, comment_id) values (recipient, actor, kind, lid, cid);
end $$;
revoke execute on function public.notify(uuid, text, uuid, uuid, uuid) from public, anon, authenticated;

-- Membership actions ---------------------------------------------------------------------------

-- The owner invites a member with a public profile, by handle. Up to 10 people per collection.
create or replace function public.invite_collaborator(lid uuid, who text) returns text
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); target uuid; cur text;
begin
  if not exists (select 1 from public.lists where id = lid and user_id = me) then
    raise exception 'Only the owner can invite people.' using errcode = 'insufficient_privilege';
  end if;
  select id into target from public.member_profiles where handle = lower(ltrim(btrim(who), '@')) and not is_private;
  if target is null then raise exception 'There''s no public profile with that handle.' using errcode = 'no_data_found'; end if;
  if target = me then raise exception 'That''s you.' using errcode = 'check_violation'; end if;
  select status into cur from public.list_members where list_id = lid and user_id = target;
  if cur = 'active' then raise exception 'They already collaborate on this collection.' using errcode = 'unique_violation'; end if;
  if cur = 'invited' then raise exception 'They''re already invited.' using errcode = 'unique_violation'; end if;
  if cur = 'requested' then
    -- They asked already: inviting them is the same as approving.
    update public.list_members set status = 'active', responded_at = now(), invited_by = me where list_id = lid and user_id = target;
    perform public.notify(target, 'request_accepted', me, lid);
    return 'active';
  end if;
  if (select count(*) from public.list_members where list_id = lid and status in ('active', 'invited')) >= 10 then
    raise exception 'A collection can have up to 10 collaborators.' using errcode = 'check_violation';
  end if;
  insert into public.list_members (list_id, user_id, status, invited_by, created_at, responded_at, note)
  values (lid, target, 'invited', me, now(), null, null)
  on conflict (list_id, user_id) do update set status = 'invited', invited_by = me, created_at = now(), responded_at = null, note = null;
  perform public.notify(target, 'invite', me, lid);
  return 'invited';
end $$;

-- A member with a profile asks to collaborate on a public collection. One request at a time,
-- and not again for 30 days after a decline.
create or replace function public.request_collaboration(lid uuid, message text default null) returns text
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); owner uuid; cur public.list_members;
begin
  select user_id into owner from public.lists where id = lid and is_public and not hidden;
  if owner is null then raise exception 'You can only ask to join public collections.' using errcode = 'insufficient_privilege'; end if;
  if owner = me then raise exception 'It''s your collection.' using errcode = 'check_violation'; end if;
  if not exists (select 1 from public.member_profiles where id = me) then
    raise exception 'Create your profile first.' using errcode = 'insufficient_privilege';
  end if;
  select * into cur from public.list_members where list_id = lid and user_id = me;
  if cur.status = 'active' then raise exception 'You already collaborate on this collection.' using errcode = 'unique_violation'; end if;
  if cur.status = 'invited' then raise exception 'You''re already invited: accept the invite instead.' using errcode = 'unique_violation'; end if;
  if cur.status = 'requested' then raise exception 'Your request is waiting for an answer.' using errcode = 'unique_violation'; end if;
  if cur.status = 'declined' and cur.responded_at > now() - interval '30 days' then
    raise exception 'You can ask again 30 days after a request is declined.' using errcode = 'check_violation';
  end if;
  insert into public.list_members (list_id, user_id, status, note, created_at, responded_at, invited_by)
  values (lid, me, 'requested', nullif(left(btrim(message), 280), ''), now(), null, null)
  on conflict (list_id, user_id) do update set status = 'requested', note = excluded.note, created_at = now(), responded_at = null, invited_by = null;
  perform public.notify(owner, 'request', me, lid);
  return 'requested';
end $$;

-- The invited member accepts or declines.
create or replace function public.respond_to_invite(lid uuid, accept boolean) returns text
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); m public.list_members;
begin
  select * into m from public.list_members where list_id = lid and user_id = me and status = 'invited';
  if m.list_id is null then raise exception 'This invite is no longer open.' using errcode = 'no_data_found'; end if;
  update public.list_members set status = case when accept then 'active' else 'declined' end, responded_at = now()
  where list_id = lid and user_id = me;
  perform public.notify(coalesce(m.invited_by, (select user_id from public.lists where id = lid)),
    case when accept then 'invite_accepted' else 'invite_declined' end, me, lid);
  update public.notifications set read_at = now() where user_id = me and list_id = lid and type = 'invite' and read_at is null;
  return case when accept then 'active' else 'declined' end;
end $$;

-- The owner approves or declines a request.
create or replace function public.respond_to_request(lid uuid, who uuid, accept boolean) returns text
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid();
begin
  if not exists (select 1 from public.lists where id = lid and user_id = me) then
    raise exception 'Only the owner can answer requests.' using errcode = 'insufficient_privilege';
  end if;
  if not exists (select 1 from public.list_members where list_id = lid and user_id = who and status = 'requested') then
    raise exception 'This request is no longer open.' using errcode = 'no_data_found';
  end if;
  if accept and (select count(*) from public.list_members where list_id = lid and status in ('active', 'invited')) >= 10 then
    raise exception 'A collection can have up to 10 collaborators.' using errcode = 'check_violation';
  end if;
  update public.list_members set status = case when accept then 'active' else 'declined' end, responded_at = now(), invited_by = me
  where list_id = lid and user_id = who;
  perform public.notify(who, case when accept then 'request_accepted' else 'request_declined' end, me, lid);
  update public.notifications set read_at = now() where user_id = me and list_id = lid and actor_id = who and type = 'request' and read_at is null;
  return case when accept then 'active' else 'declined' end;
end $$;

-- The owner removes someone (or cancels an invite); anyone can leave or withdraw their request.
-- Films they added stay.
create or replace function public.remove_collaborator(lid uuid, who uuid default null) returns void
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); target uuid := coalesce(who, auth.uid()); was text; owner uuid;
begin
  select user_id into owner from public.lists where id = lid;
  if target <> me and owner is distinct from me then
    raise exception 'Only the owner can remove people.' using errcode = 'insufficient_privilege';
  end if;
  select status into was from public.list_members where list_id = lid and user_id = target;
  delete from public.list_members where list_id = lid and user_id = target and status <> 'declined';
  delete from public.notifications where list_id = lid and type in ('invite', 'request') and read_at is null
    and ((user_id = target and actor_id = owner) or (user_id = owner and actor_id = target));
  if target <> me and was = 'active' then perform public.notify(target, 'removed', me, lid); end if;
end $$;

revoke execute on function public.invite_collaborator(uuid, text) from public, anon;
revoke execute on function public.request_collaboration(uuid, text) from public, anon;
revoke execute on function public.respond_to_invite(uuid, boolean) from public, anon;
revoke execute on function public.respond_to_request(uuid, uuid, boolean) from public, anon;
revoke execute on function public.remove_collaborator(uuid, uuid) from public, anon;
grant execute on function public.invite_collaborator(uuid, text) to authenticated;
grant execute on function public.request_collaboration(uuid, text) to authenticated;
grant execute on function public.respond_to_invite(uuid, boolean) to authenticated;
grant execute on function public.respond_to_request(uuid, uuid, boolean) to authenticated;
grant execute on function public.remove_collaborator(uuid, uuid) to authenticated;
revoke execute on function public.is_list_owner(uuid) from public;
revoke execute on function public.is_list_collaborator(uuid) from public;
revoke execute on function public.can_edit_list(uuid) from public;
grant execute on function public.is_list_owner(uuid) to anon, authenticated;
grant execute on function public.is_list_collaborator(uuid) to anon, authenticated;
grant execute on function public.can_edit_list(uuid) to anon, authenticated;

-- Comments: moderation, removed placeholders, reports, turning comments off --------------------

alter table public.list_comments add column if not exists removed_at timestamptz;

drop policy if exists "post comments" on public.list_comments;
create policy "post comments" on public.list_comments for insert to authenticated
  with check (user_id = (select auth.uid())
    and exists (select 1 from public.lists l where l.id = list_id and l.is_public and not l.hidden and l.comments_enabled)
    and exists (select 1 from public.member_profiles m where m.id = (select auth.uid())));
drop policy if exists "edit own comments" on public.list_comments;
create policy "edit own comments" on public.list_comments for update to authenticated
  using (user_id = (select auth.uid()) and removed_at is null) with check (user_id = (select auth.uid()));
drop policy if exists "delete comments" on public.list_comments;
create policy "delete comments" on public.list_comments for delete to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()) or public.can_edit_list(list_id));

-- Removing a comment: if it has replies it stays as "Comment removed" so the thread still reads;
-- otherwise it's deleted. Its author, the owner, collaborators and admins can remove it.
create or replace function public.remove_comment(cid uuid) returns text
language plpgsql security definer set search_path = public as $$
declare c public.list_comments;
begin
  select * into c from public.list_comments where id = cid;
  if c.id is null then return 'gone'; end if;
  if not (c.user_id = auth.uid() or public.is_admin()
          or exists (select 1 from public.lists where id = c.list_id and user_id = auth.uid())
          or exists (select 1 from public.list_members where list_id = c.list_id and user_id = auth.uid() and status = 'active')) then
    raise exception 'You can''t remove this comment.' using errcode = 'insufficient_privilege';
  end if;
  if c.parent_id is null and exists (select 1 from public.list_comments where parent_id = cid) then
    update public.list_comments set removed_at = now(), body = 'removed' where id = cid;
    delete from public.comment_likes where comment_id = cid;
    update public.lists set pinned_comment_id = null where pinned_comment_id = cid;
    return 'removed';
  end if;
  delete from public.list_comments where id = cid;
  return 'deleted';
end $$;
revoke execute on function public.remove_comment(uuid) from public, anon;
grant execute on function public.remove_comment(uuid) to authenticated;

-- Updates by the system (remove_comment) shouldn't count as edits.
create or replace function public.guard_comment() returns trigger
language plpgsql security definer set search_path = public as $$
declare p public.list_comments;
begin
  if tg_op = 'INSERT' then
    if new.parent_id is not null then
      select * into p from public.list_comments where id = new.parent_id;
      if p.id is null or p.list_id <> new.list_id or p.removed_at is not null then
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
    new.removed_at := null;
  else
    new.id := old.id; new.list_id := old.list_id; new.user_id := old.user_id;
    new.parent_id := old.parent_id; new.created_at := old.created_at;
    new.body := btrim(new.body);
    if new.removed_at is null then new.removed_at := old.removed_at; end if;
    if new.removed_at is null and new.body is distinct from old.body then new.edited_at := now(); else new.edited_at := old.edited_at; end if;
  end if;
  return new;
end $$;
revoke execute on function public.guard_comment() from public, anon, authenticated;

-- New comments notify: the person replied to, anyone @mentioned, then the owner and
-- collaborators. One notification per person per comment.
create or replace function public.notify_comment() returns trigger
language plpgsql security definer set search_path = public as $$
declare told uuid[] := array[new.user_id]; r uuid; parent_author uuid;
begin
  if new.parent_id is not null then
    select user_id into parent_author from public.list_comments where id = new.parent_id;
    if parent_author is not null and not parent_author = any(told) then
      perform public.notify(parent_author, 'reply', new.user_id, new.list_id, new.id);
      told := told || parent_author;
    end if;
  end if;
  for r in
    select distinct m.id from public.member_profiles m
    where m.handle in (select lower(rm.x[1]) from regexp_matches(new.body, '@([A-Za-z0-9_]{3,24})', 'g') as rm(x))
    limit 10
  loop
    if not r = any(told) then
      perform public.notify(r, 'mention', new.user_id, new.list_id, new.id);
      told := told || r;
    end if;
  end loop;
  for r in
    select user_id from public.lists where id = new.list_id
    union select user_id from public.list_members where list_id = new.list_id and status = 'active'
  loop
    if not r = any(told) then
      perform public.notify(r, 'comment', new.user_id, new.list_id, new.id);
      told := told || r;
    end if;
  end loop;
  return null;
end $$;
revoke execute on function public.notify_comment() from public, anon, authenticated;
drop trigger if exists notify_comment on public.list_comments;
create trigger notify_comment after insert on public.list_comments
  for each row execute function public.notify_comment();

create table if not exists public.comment_reports (
  id uuid primary key default gen_random_uuid(),
  comment_id uuid not null references public.list_comments(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete set null default auth.uid(),
  reason text check (char_length(reason) <= 500),
  resolved boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists comment_reports_comment_idx on public.comment_reports (comment_id);
create index if not exists comment_reports_user_idx on public.comment_reports (user_id);
alter table public.comment_reports enable row level security;
drop policy if exists "report comments" on public.comment_reports;
drop policy if exists "admins read comment reports" on public.comment_reports;
drop policy if exists "admins update comment reports" on public.comment_reports;
drop policy if exists "admins delete comment reports" on public.comment_reports;
create policy "report comments" on public.comment_reports for insert to authenticated
  with check (resolved = false and user_id = (select auth.uid()) and exists (select 1 from public.list_comments c where c.id = comment_id));
create policy "admins read comment reports" on public.comment_reports for select to authenticated using ((select public.is_admin()));
create policy "admins update comment reports" on public.comment_reports for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "admins delete comment reports" on public.comment_reports for delete to authenticated using ((select public.is_admin()));

-- Featured collections, the owner and limited admins, admin notifications, Watched films,
-- privacy switches and blocking. Safe to run more than once.

-- 1. Featured: admins feature community collections; staff picks count as featured too.
alter table public.lists add column if not exists featured boolean not null default false;

create or replace function public.guard_list_flags() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then
    if tg_op = 'INSERT' then
      new.hidden := false;
      new.staff_pick := false;
      new.featured := false;
    else
      new.hidden := old.hidden;
      new.staff_pick := old.staff_pick;
      new.featured := old.featured;
    end if;
  end if;
  return new;
end $$;

-- 2. The owner (full control) and admins (films, people, submissions, community, inbox).
alter table public.profiles add column if not exists is_owner boolean not null default false;
alter table public.profiles add column if not exists hide_watched boolean not null default false;
alter table public.profiles add column if not exists hide_following boolean not null default false;

create or replace function public.is_owner() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select is_owner from public.profiles where id = auth.uid()), false);
$$;

drop policy if exists "update own profile" on public.profiles;
create policy "update own profile" on public.profiles for update
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()) and is_admin = (select public.is_admin()) and is_owner = (select public.is_owner()));

update public.profiles set is_owner = true, is_admin = true where handle = 'leo';

-- Only the owner makes or removes admins, and never changes the owner.
create or replace function public.set_admin(who uuid, make boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_owner() then raise exception 'Only the owner can change admins.'; end if;
  update public.profiles set is_admin = make where id = who and not is_owner;
end $$;
revoke all on function public.set_admin(uuid, boolean) from public, anon;
grant execute on function public.set_admin(uuid, boolean) to authenticated;

-- Everyone who has signed up, for the admin Members page. Email only for the owner.
create or replace function public.admin_members()
returns table (id uuid, handle text, display_name text, email text, created_at timestamptz, last_seen timestamptz,
  is_admin boolean, is_owner boolean, is_private boolean, lists bigint, saved bigint, comments bigint)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Only admins can see members.'; end if;
  return query
    select p.id, p.handle, p.display_name,
      case when public.is_owner() then u.email::text end,
      p.created_at, u.last_sign_in_at, p.is_admin, p.is_owner, coalesce(p.is_private, false),
      (select count(*) from public.lists l where l.user_id = p.id),
      (select count(*) from public.watchlist w where w.user_id = p.id),
      (select count(*) from public.list_comments c where c.user_id = p.id and c.removed_at is null)
    from public.profiles p left join auth.users u on u.id = p.id
    order by p.created_at desc;
end $$;
revoke all on function public.admin_members() from public, anon;
grant execute on function public.admin_members() to authenticated;

-- 3. Notifications for admins: reports, suggestions, messages, new members.
alter table public.notifications add column if not exists ref_id uuid;
alter table public.notifications add column if not exists detail text;
alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications add constraint notifications_type_check check (type in (
  'invite', 'request', 'invite_accepted', 'invite_declined', 'request_accepted', 'request_declined', 'removed',
  'comment', 'reply', 'mention', 'new_film', 'collection_film',
  'report', 'comment_report', 'submission', 'message', 'new_member', 'featured'));

create or replace function public.notify_admins_list_report() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.notifications (user_id, actor_id, type, list_id, ref_id, detail)
  select a.id, case when exists (select 1 from public.profiles where id = new.user_id) then new.user_id end,
    'report', new.list_id, new.id, left(new.reason, 200)
  from public.profiles a where a.is_admin;
  return null;
end $$;
drop trigger if exists list_report_notify on public.list_reports;
create trigger list_report_notify after insert on public.list_reports for each row execute function public.notify_admins_list_report();

create or replace function public.notify_admins_comment_report() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.notifications (user_id, actor_id, type, list_id, comment_id, ref_id, detail)
  select a.id, new.user_id, 'comment_report', c.list_id, new.comment_id, new.id, left(new.reason, 200)
  from public.profiles a, public.list_comments c where a.is_admin and c.id = new.comment_id;
  return null;
end $$;
drop trigger if exists comment_report_notify on public.comment_reports;
create trigger comment_report_notify after insert on public.comment_reports for each row execute function public.notify_admins_comment_report();

create or replace function public.notify_admins_submission() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.notifications (user_id, actor_id, type, ref_id, detail)
  select a.id, new.user_id, 'submission', new.id, left(new.title || coalesce(' (' || new.year || ')', ''), 200)
  from public.profiles a where a.is_admin and a.id is distinct from new.user_id;
  return null;
end $$;
drop trigger if exists submission_notify on public.submissions;
create trigger submission_notify after insert on public.submissions for each row execute function public.notify_admins_submission();

create or replace function public.notify_admins_message() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.notifications (user_id, type, ref_id, detail)
  select a.id, 'message', new.id, left(coalesce(nullif(new.name, ''), 'Someone') || ' • ' || coalesce(new.topic, 'message') || ': ' || new.body, 200)
  from public.profiles a where a.is_admin;
  return null;
end $$;
drop trigger if exists message_notify on public.messages;
create trigger message_notify after insert on public.messages for each row execute function public.notify_admins_message();

create or replace function public.notify_owner_new_member() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.notifications (user_id, actor_id, type, detail)
  select o.id, new.id, 'new_member', new.display_name from public.profiles o where o.is_owner and o.id <> new.id;
  return null;
end $$;
drop trigger if exists new_member_notify on public.profiles;
create trigger new_member_notify after insert on public.profiles for each row execute function public.notify_owner_new_member();

-- Tell a curator when their collection is featured.
create or replace function public.notify_featured() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.featured and not old.featured and new.user_id is distinct from auth.uid() then
    insert into public.notifications (user_id, actor_id, type, list_id) values (new.user_id, auth.uid(), 'featured', new.id);
  end if;
  return null;
end $$;
drop trigger if exists list_featured_notify on public.lists;
create trigger list_featured_notify after update of featured on public.lists for each row execute function public.notify_featured();

-- 4. Watched films, public on public profiles unless hidden.
create table if not exists public.watched (
  user_id uuid not null references public.profiles (id) on delete cascade,
  film_id uuid not null references public.films (id) on delete cascade,
  watched_at timestamptz not null default now(),
  primary key (user_id, film_id)
);
alter table public.watched enable row level security;

create or replace function public.shows_watched(uid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = uid and not coalesce(is_private, false) and not hide_watched);
$$;
create or replace function public.shows_following(uid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = uid and not coalesce(is_private, false) and not hide_following);
$$;

drop policy if exists "own watched" on public.watched;
create policy "own watched" on public.watched for all using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
drop policy if exists "public watched" on public.watched;
create policy "public watched" on public.watched for select using (public.shows_watched(user_id));

drop policy if exists "public follows" on public.follows;
create policy "public follows" on public.follows for select to anon, authenticated using (public.shows_following(user_id));

-- 5. Blocking.
create table if not exists public.blocks (
  blocker_id uuid not null references public.profiles (id) on delete cascade,
  blocked_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);
alter table public.blocks enable row level security;
drop policy if exists "own blocks" on public.blocks;
create policy "own blocks" on public.blocks for all using (blocker_id = (select auth.uid())) with check (blocker_id = (select auth.uid()));

create or replace function public.is_blocked(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.blocks where (blocker_id = a and blocked_id = b) or (blocker_id = b and blocked_id = a));
$$;

-- No comments on a collection whose curator blocked you (or you them).
create or replace function public.guard_blocked_comment() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if public.is_blocked((select user_id from public.lists where id = new.list_id), new.user_id) then
    raise exception 'You can''t comment on this collection.';
  end if;
  return new;
end $$;
drop trigger if exists blocked_comment_guard on public.list_comments;
create trigger blocked_comment_guard before insert on public.list_comments for each row execute function public.guard_blocked_comment();

-- No invites or requests between people who blocked each other.
create or replace function public.guard_blocked_member() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if public.is_blocked((select user_id from public.lists where id = new.list_id), new.user_id) then
    raise exception 'That isn''t possible for this collection.';
  end if;
  return new;
end $$;
drop trigger if exists blocked_member_guard on public.list_members;
create trigger blocked_member_guard before insert on public.list_members for each row execute function public.guard_blocked_member();

-- No notifications from someone you blocked.
create or replace function public.skip_blocked_notification() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.actor_id is not null and exists (select 1 from public.blocks where blocker_id = new.user_id and blocked_id = new.actor_id) then
    return null;
  end if;
  return new;
end $$;
drop trigger if exists blocked_notification_skip on public.notifications;
create trigger blocked_notification_skip before insert on public.notifications for each row execute function public.skip_blocked_notification();

-- Blocking ends co-curating between the two, and their follows of each other's collections.
create or replace function public.on_block() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  delete from public.list_members m using public.lists l
    where l.id = m.list_id and ((l.user_id = new.blocker_id and m.user_id = new.blocked_id) or (l.user_id = new.blocked_id and m.user_id = new.blocker_id));
  delete from public.list_saves s using public.lists l
    where l.id = s.list_id and ((l.user_id = new.blocker_id and s.user_id = new.blocked_id) or (l.user_id = new.blocked_id and s.user_id = new.blocker_id));
  return null;
end $$;
drop trigger if exists block_cleanup on public.blocks;
create trigger block_cleanup after insert on public.blocks for each row execute function public.on_block();

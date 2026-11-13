-- Security fixes from the November 2026 review. Safe to run twice. Run after every other file.

-- 1. A member can't change their own suspension. Only an admin (through admin_set_suspended) or a
--    server job can set or clear it.
create or replace function pheelm_private.guard_profile_moderation() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  -- Admins can't lift their own suspension either (the owner suspends admins).
  if auth.uid() is null or (coalesce(public.is_admin(), false) and new.id is distinct from auth.uid()) then return new; end if;
  if tg_op = 'INSERT' then
    new.suspended_at := null; new.suspended_reason := null; new.suspended_by := null;
  else
    new.suspended_at := old.suspended_at; new.suspended_reason := old.suspended_reason; new.suspended_by := old.suspended_by;
  end if;
  return new;
end $$;
drop trigger if exists guard_profile_moderation on public.profiles;
create trigger guard_profile_moderation before insert or update on public.profiles
  for each row execute function pheelm_private.guard_profile_moderation();

-- 2. Asking to collaborate: at most 3 requests a day for one watchlist and 20 an hour overall, even
--    if the member withdraws and asks again. Suspended members can't ask, invite or answer.
create table if not exists pheelm_private.collaboration_requests (
  list_id uuid not null, user_id uuid not null, created_at timestamptz not null default now()
);
create index if not exists collaboration_requests_recent on pheelm_private.collaboration_requests (user_id, created_at);
alter table pheelm_private.collaboration_requests enable row level security;
revoke all on pheelm_private.collaboration_requests from public, anon, authenticated;

create or replace function public.request_collaboration(lid uuid, message text default null) returns text
language plpgsql security definer set search_path = 'public' as $$
declare me uuid := auth.uid(); owner uuid; cur public.list_members;
begin
  if me is null then raise exception 'Sign in first.' using errcode = 'insufficient_privilege'; end if;
  if public.is_suspended(me) then raise exception 'Your account is suspended.' using errcode = 'insufficient_privilege'; end if;
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
  if (select count(*) from pheelm_private.collaboration_requests where user_id = me and list_id = lid and created_at > now() - interval '1 day') >= 3
     or (select count(*) from pheelm_private.collaboration_requests where user_id = me and created_at > now() - interval '1 hour') >= 20 then
    raise exception 'You''ve asked a few times already. Try again tomorrow.' using errcode = 'check_violation';
  end if;
  delete from pheelm_private.collaboration_requests where created_at < now() - interval '2 days';
  insert into pheelm_private.collaboration_requests (list_id, user_id) values (lid, me);
  insert into public.list_members (list_id, user_id, status, note, created_at, responded_at, invited_by)
  values (lid, me, 'requested', nullif(left(btrim(message), 280), ''), now(), null, null)
  on conflict (list_id, user_id) do update set status = 'requested', note = excluded.note, created_at = now(), responded_at = null, invited_by = null;
  perform public.notify(owner, 'request', me, lid);
  return 'requested';
end $$;

create or replace function public.invite_collaborator(lid uuid, who text) returns text
language plpgsql security definer set search_path = 'public' as $$
declare me uuid := auth.uid(); target uuid; cur text;
begin
  if public.is_suspended(me) then raise exception 'Your account is suspended.' using errcode = 'insufficient_privilege'; end if;
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

create or replace function public.respond_to_invite(lid uuid, accept boolean) returns text
language plpgsql security definer set search_path = 'public' as $$
declare me uuid := auth.uid(); m public.list_members;
begin
  if accept and public.is_suspended(me) then raise exception 'Your account is suspended.' using errcode = 'insufficient_privilege'; end if;
  select * into m from public.list_members where list_id = lid and user_id = me and status = 'invited';
  if m.list_id is null then raise exception 'This invite is no longer open.' using errcode = 'no_data_found'; end if;
  update public.list_members set status = case when accept then 'active' else 'declined' end, responded_at = now()
  where list_id = lid and user_id = me;
  perform public.notify(coalesce(m.invited_by, (select user_id from public.lists where id = lid)),
    case when accept then 'invite_accepted' else 'invite_declined' end, me, lid);
  update public.notifications set read_at = now() where user_id = me and list_id = lid and type = 'invite' and read_at is null;
  return case when accept then 'active' else 'declined' end;
end $$;

create or replace function public.respond_to_request(lid uuid, who uuid, accept boolean) returns text
language plpgsql security definer set search_path = 'public' as $$
declare me uuid := auth.uid();
begin
  if accept and public.is_suspended(me) then raise exception 'Your account is suspended.' using errcode = 'insufficient_privilege'; end if;
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

-- A suspended member can still remove their own comments, but not other people's.
create or replace function public.remove_comment(cid uuid) returns text
language plpgsql security definer set search_path = 'public' as $$
declare c public.list_comments;
begin
  select * into c from public.list_comments where id = cid;
  if c.id is null then return 'gone'; end if;
  if not (c.user_id = auth.uid() or public.is_admin()
          or (not public.is_suspended(auth.uid()) and (
               exists (select 1 from public.lists where id = c.list_id and user_id = auth.uid())
            or exists (select 1 from public.list_members where list_id = c.list_id and user_id = auth.uid() and status = 'active')))) then
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

-- Collaboration emails: at most 5 an hour per member, like activity emails.
create or replace function pheelm_email.notification_event() returns trigger language plpgsql security definer set search_path='' as $$
declare address text; collaboration boolean; activity boolean;
begin
 if new.type not in ('invite','request','invite_accepted','invite_declined','request_accepted','request_declined','removed','comment','reply','mention','new_film') then return new; end if;
 select email into address from auth.users where id=new.user_id and email_confirmed_at is not null and (banned_until is null or banned_until<now());
 select collaboration_emails,activity_emails into collaboration,activity from public.email_preferences where user_id=new.user_id;
 if exists(select 1 from public.notification_preferences where user_id=new.user_id and new.type=any(disabled_types)) then return new; end if;
 insert into public.email_preferences(user_id) values(new.user_id) on conflict do nothing;
 if new.type in ('comment','reply','mention','new_film') then
  if activity is false then return new; end if;
  if (select count(*) from pheelm_email.outbox where user_id=new.user_id and template='activity-update' and created_at>now()-interval '1 hour')>=5 then return new; end if;
  perform pheelm_email.enqueue('notification:'||new.id,new.user_id,address,'activity-update',
   case new.type when 'reply' then 'Someone replied to your comment. Sign in to read it.' when 'mention' then 'Someone mentioned you in a comment. Sign in to read it.' when 'comment' then 'Someone commented on one of your watchlists. Sign in to read it.' else 'A new film by a director you follow was added to Pheelm. Sign in to see it.' end,'/notifications','optional');
  return new;
 end if;
 if collaboration is false then return new; end if;
 if (select count(*) from pheelm_email.outbox where user_id=new.user_id and template in ('collection-invitation','collaboration-update') and created_at>now()-interval '1 hour')>=5 then return new; end if;
 perform pheelm_email.enqueue('notification:'||new.id,new.user_id,address,case when new.type='invite' then 'collection-invitation' else 'collaboration-update' end,
 case new.type when 'invite' then 'You have been invited to help curate a collection. Sign in to review and accept or decline.' when 'request' then 'A member requested to help curate your collection. Sign in to review the request.' when 'removed' then 'Your membership of a collection changed. Sign in to review the update.' else 'There is an update on your collection collaboration. Sign in to review it.' end,'/notifications','collaboration');return new;
end $$;

-- 3. The newsletter and contact forms are saved by the site's server after the bot check, never
--    straight from a browser. Reports need a signed-in member.
drop policy if exists "Anyone can subscribe" on public.subscribers;
drop policy if exists "Anyone can send a message" on public.messages;
revoke insert on public.subscribers, public.messages from anon, authenticated;
drop policy if exists "anyone reports" on public.list_reports;
drop policy if exists "members report" on public.list_reports;
create policy "members report" on public.list_reports for insert to authenticated
  with check (resolved = false and user_id = (select auth.uid())
    and exists (select 1 from public.lists l where l.id = list_reports.list_id and l.is_public));
revoke insert on public.list_reports from anon;

-- 4. Only the owner deletes films, people and newsletter subscribers, matching the admin pages.
drop policy if exists "admin delete" on public.films;
create policy "admin delete" on public.films for delete to authenticated using ((select public.is_owner()));
drop policy if exists "admin delete" on public.people;
create policy "admin delete" on public.people for delete to authenticated using ((select public.is_owner()));
drop policy if exists "Admins remove subscribers" on public.subscribers;
create policy "Admins remove subscribers" on public.subscribers for delete to authenticated using ((select public.is_owner()));

-- 9. The banned-word check keeps at most 30 refusals an hour per member in the moderation log.
create or replace function public.check_text(p_field text, p_text text) returns text
language plpgsql security definer set search_path = '' as $$
declare w text;
begin
  if auth.uid() is null then raise exception 'Sign in first' using errcode = '42501'; end if;
  if p_field not in ('comment', 'bio', 'watchlist_description') or char_length(coalesce(p_text, '')) > 10000 then
    raise exception 'Invalid text check' using errcode = '22023';
  end if;
  w := private.first_banned_word(p_text);
  if w is not null and (select count(*) from private.moderation_refusals where actor_id = auth.uid() and created_at > now() - interval '1 hour') < 30 then
    delete from private.moderation_refusals where created_at < now() - interval '90 days';
    insert into private.moderation_refusals (actor_id, field, excerpt, reason)
      values (auth.uid(), p_field, left(btrim(p_text), 300), 'Banned word: ' || w);
  end if;
  return case when w is null then null else private.banned_word_message(w) end;
end $$;

-- 11. Nobody needs to empty a whole table through the API.
revoke truncate on all tables in schema public from anon, authenticated;
alter default privileges for role postgres in schema public revoke truncate on tables from anon, authenticated;

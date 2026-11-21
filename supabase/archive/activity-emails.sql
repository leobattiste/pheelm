-- Emails for activity: a reply to your comment, a mention, a comment on your watchlist and a new
-- film from a director you follow. Each one is a notification the member already gets in the app;
-- this also sends an email unless they've turned "Replies, mentions and new films" off in Account
-- settings or turned that type off in their notification settings. The email says what kind of
-- thing happened, never who or what was said. No more than 5 an hour per member. Safe to run twice.
-- Run after email-system.sql and catalog-digest.sql.

alter table public.email_preferences add column if not exists activity_emails boolean not null default true;
grant select (activity_emails), insert (activity_emails), update (activity_emails) on public.email_preferences to authenticated;

-- The link at the bottom of an optional email turns off everything optional, this included.
create or replace function public.email_token_action(token_value text,action text) returns boolean language plpgsql security definer set search_path='' as $$
declare address text;
begin
 if length(token_value)<>64 then return false; end if;
 if action='confirm' then
 update pheelm_email.subscriptions s set confirmed_at=now() where token=token_value and unsubscribed_at is null and requested_at>now()-interval '7 days' and exists(select 1 from public.subscribers p where lower(p.email)=s.email) returning email into address;return found;
 elsif action='unsubscribe' then
 update pheelm_email.subscriptions set unsubscribed_at=now(),confirmed_at=null where token=token_value returning email into address;
 if address is not null then delete from public.subscribers where lower(email)=address;return true;end if;
 update public.email_preferences set collaboration_emails=false,activity_emails=false,digest_frequency='off',updated_at=now() where unsubscribe_token=token_value;return found;
 end if;return false;
end $$;
revoke all on function public.email_token_action(text,text) from public,anon,authenticated;
grant execute on function public.email_token_action(text,text) to service_role;

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
  -- A busy hour, or a director with many new films, is one email run, not a flood.
  if (select count(*) from pheelm_email.outbox where user_id=new.user_id and template='activity-update' and created_at>now()-interval '1 hour')>=5 then return new; end if;
  perform pheelm_email.enqueue('notification:'||new.id,new.user_id,address,'activity-update',
   case new.type when 'reply' then 'Someone replied to your comment. Sign in to read it.' when 'mention' then 'Someone mentioned you in a comment. Sign in to read it.' when 'comment' then 'Someone commented on one of your watchlists. Sign in to read it.' else 'A new film by a director you follow was added to Pheelm. Sign in to see it.' end,'/notifications','optional');
  return new;
 end if;
 if collaboration is false then return new; end if;
 perform pheelm_email.enqueue('notification:'||new.id,new.user_id,address,case when new.type='invite' then 'collection-invitation' else 'collaboration-update' end,
 case new.type when 'invite' then 'You have been invited to help curate a watchlist. Sign in to review and accept or decline.' when 'request' then 'A member requested to help curate your watchlist. Sign in to review the request.' when 'removed' then 'Your membership of a watchlist changed. Sign in to review the update.' else 'There is an update on your watchlist collaboration. Sign in to review it.' end,'/notifications','collaboration');return new;
end $$;

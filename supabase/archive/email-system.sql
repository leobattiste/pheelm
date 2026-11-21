-- Pheelm outbound mail. Queue content and credentials are never readable by public clients.
create schema if not exists pheelm_email;
revoke all on schema pheelm_email from public, anon, authenticated;
create table pheelm_email.outbox (
 id uuid primary key default gen_random_uuid(), event_key text not null unique,
 user_id uuid, recipient text not null, template text not null, message text not null,
 action_path text not null default '/account', category text not null default 'transactional',
 state text not null default 'pending' check(state in ('pending','processing','sent','failed','suppressed')),
 attempts int not null default 0, available_at timestamptz not null default now(),
 created_at timestamptz not null default now(), sent_at timestamptz, provider_id text,
 last_error text, lease uuid
);
alter table pheelm_email.outbox enable row level security;
create index outbox_due on pheelm_email.outbox(available_at) where state in ('pending','processing');
create index outbox_recipient_created on pheelm_email.outbox(lower(recipient),created_at desc);
create table pheelm_email.suppressions(email text primary key, reason text not null, created_at timestamptz not null default now());
alter table pheelm_email.suppressions enable row level security;
create table pheelm_email.events(id text primary key, type text not null, created_at timestamptz not null default now());
alter table pheelm_email.events enable row level security;
create table pheelm_email.subscriptions (
 email text primary key, token text not null unique default encode(extensions.gen_random_bytes(32),'hex'),
 confirmed_at timestamptz, requested_at timestamptz not null default now(), unsubscribed_at timestamptz
);
alter table pheelm_email.subscriptions enable row level security;
create table public.email_preferences (
 user_id uuid primary key references auth.users(id) on delete cascade,
 collaboration_emails boolean not null default true,
 digest_frequency text not null default 'off' check(digest_frequency in ('off','daily','weekly')),
 updated_at timestamptz not null default now(),
 unsubscribe_token text not null unique default encode(extensions.gen_random_bytes(32),'hex')
);
alter table public.email_preferences enable row level security;
revoke all on public.email_preferences from public, anon, authenticated;
grant select(user_id,collaboration_emails,digest_frequency,updated_at),insert(user_id,collaboration_emails,digest_frequency,updated_at),update(collaboration_emails,digest_frequency,updated_at) on public.email_preferences to authenticated;
create policy "Read own email preferences" on public.email_preferences for select to authenticated using(user_id=(select auth.uid()));
create policy "Insert own email preferences" on public.email_preferences for insert to authenticated with check(user_id=(select auth.uid()));
create policy "Update own email preferences" on public.email_preferences for update to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));

create function pheelm_email.enqueue(k text, uid uuid, address text, tid text, body text, path text default '/account', kind text default 'transactional') returns void
language plpgsql security definer set search_path='' as $$
begin
 if address is null or address !~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' or length(address)>254 then return; end if;
 if exists(select 1 from pheelm_email.suppressions where email=lower(address)) then return; end if;
 -- Anonymous acknowledgments are deliberately bounded, even if a client bypasses the form.
 if tid in ('contact-received','newsletter-confirmation') and
 (exists(select 1 from pheelm_email.outbox where lower(recipient)=lower(address) and template=tid and created_at>now()-interval '1 hour')
 or (select count(*) from pheelm_email.outbox where template=tid and created_at>now()-interval '1 hour')>=50) then return; end if;
 insert into pheelm_email.outbox(event_key,user_id,recipient,template,message,action_path,category)
 values(k,uid,lower(address),tid,left(body,6000),path,kind) on conflict(event_key) do nothing;
end $$;
revoke all on function pheelm_email.enqueue(text,uuid,text,text,text,text,text) from public,anon,authenticated;

create function pheelm_email.account_event() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if TG_OP='DELETE' then
  delete from pheelm_email.outbox where user_id=old.id and state in ('pending','processing');
  delete from public.subscribers where lower(email)=lower(old.email);
  delete from pheelm_email.subscriptions where email=lower(old.email);
  perform pheelm_email.enqueue('deleted:'||old.id,null,old.email,'account-deleted','Your Pheelm account has been deleted. If you did not request this, contact Pheelm.','/contact');
  return old;
 end if;
 if new.email_confirmed_at is not null and (TG_OP='INSERT' or old.email_confirmed_at is null) then
  perform pheelm_email.enqueue('welcome:'||new.id,new.id,new.email,'welcome','Discover films, make watchlists, and follow directors. Your Pheelm account is ready.','/films');
 end if;
 if TG_OP='UPDATE' and new.email is distinct from old.email and old.email_confirmed_at is not null then
  perform pheelm_email.enqueue('email-change-old:'||new.id||':'||new.updated_at,new.id,old.email,'security-notice','The sign-in email on your Pheelm account changed. If this was not you, contact Pheelm immediately.','/contact');
  perform pheelm_email.enqueue('email-change-new:'||new.id||':'||new.updated_at,new.id,new.email,'security-notice','The sign-in email on your Pheelm account changed. If this was not you, contact Pheelm immediately.','/account');
 end if;
 return new;
end $$;
create trigger pheelm_email_account after insert or update of email_confirmed_at,email or delete on auth.users for each row execute function pheelm_email.account_event();

create function pheelm_email.submission_event() returns trigger language plpgsql security definer set search_path='' as $$
declare address text;
begin
 select email into address from auth.users where id=new.user_id and email_confirmed_at is not null;
 if TG_OP='INSERT' then
  perform pheelm_email.enqueue('submission:'||new.id,new.user_id,address,'submission-received','We received your film submission: '||new.title||'. It is awaiting review; it has not been published. Reference: '||new.id,'/account?tab=submissions');
 elsif new.status is distinct from old.status then
  perform pheelm_email.enqueue('submission-update:'||new.id||':'||new.status||':'||coalesce(new.reviewed_at::text,''),new.user_id,address,'submission-update','Your submission “'||new.title||'” has an update. Current status: '||new.status||'. Sign in to see the review notes.','/account?tab=submissions');
 end if;return new;
end $$;
create trigger pheelm_email_submission after insert or update of status on public.submissions for each row execute function pheelm_email.submission_event();

create function pheelm_email.message_event() returns trigger language plpgsql security definer set search_path='' as $$
begin
 perform pheelm_email.enqueue('message:'||new.id,null,new.email,'contact-received','We received your '||case when new.topic='partnership' then 'partnership enquiry' when new.topic in ('feedback','correction') then 'feedback' else 'message' end||'. Keep this reference if you contact us again: '||new.id||'. We do not promise a specific response time.','/contact');return new;
end $$;
create trigger pheelm_email_message after insert on public.messages for each row execute function pheelm_email.message_event();

create function pheelm_email.notification_event() returns trigger language plpgsql security definer set search_path='' as $$
declare address text; collaboration boolean;
begin
 if new.type not in ('invite','request','invite_accepted','invite_declined','request_accepted','request_declined','removed') then return new; end if;
 select email into address from auth.users where id=new.user_id and email_confirmed_at is not null and (banned_until is null or banned_until<now());
 select collaboration_emails into collaboration from public.email_preferences where user_id=new.user_id;
 if collaboration is false then return new; end if;
 if exists(select 1 from public.notification_preferences where user_id=new.user_id and new.type=any(disabled_types)) then return new; end if;
 insert into public.email_preferences(user_id) values(new.user_id) on conflict do nothing;
 perform pheelm_email.enqueue('notification:'||new.id,new.user_id,address,case when new.type='invite' then 'collection-invitation' else 'collaboration-update' end,
 case new.type when 'invite' then 'You have been invited to help curate a watchlist. Sign in to review and accept or decline.' when 'request' then 'A member requested to help curate your watchlist. Sign in to review the request.' when 'removed' then 'Your membership of a watchlist changed. Sign in to review the update.' else 'There is an update on your watchlist collaboration. Sign in to review it.' end,'/notifications','collaboration');return new;
end $$;
create trigger pheelm_email_notification after insert on public.notifications for each row execute function pheelm_email.notification_event();

create function pheelm_email.newsletter_event() returns trigger language plpgsql security definer set search_path='' as $$
declare token_value text;
begin
 if TG_OP='DELETE' then update pheelm_email.subscriptions set unsubscribed_at=now(),confirmed_at=null where email=lower(old.email);return old; end if;
 insert into pheelm_email.subscriptions(email) values(lower(new.email)) on conflict(email) do update set token=encode(extensions.gen_random_bytes(32),'hex'),confirmed_at=null,requested_at=now(),unsubscribed_at=null returning token into token_value;
 perform pheelm_email.enqueue('newsletter-confirm:'||token_value,null,new.email,'newsletter-confirmation','Confirm that you want to receive the Pheelm newsletter. If you did not request this, ignore this email; you will not be subscribed.','/newsletter-confirm?token='||token_value,'confirmation');return new;
end $$;
create trigger pheelm_email_newsletter after insert or delete on public.subscribers for each row execute function pheelm_email.newsletter_event();

-- These RPCs are intentionally service-role-only; tokens never grant queue access.
create function public.email_delivery_config() returns jsonb language sql security definer set search_path='' as $$
 select coalesce(jsonb_object_agg(name,decrypted_secret),'{}'::jsonb) from vault.decrypted_secrets where name in ('pheelm_resend_api_key','pheelm_email_worker_secret','pheelm_resend_webhook_secret','pheelm_postal_address');
$$;
create function public.email_claim(batch_size int default 20) returns setof pheelm_email.outbox language plpgsql security definer set search_path='' as $$
begin
 update pheelm_email.outbox set state='failed',last_error='Delivery expired; manual review required.' where state in ('pending','processing') and created_at<now()-interval '12 hours';
 update pheelm_email.outbox o set state='suppressed',message='',last_error='Suppressed or preference disabled' where o.state in ('pending','processing') and
 (exists(select 1 from pheelm_email.suppressions s where s.email=lower(o.recipient)) or
 (o.category='collaboration' and exists(select 1 from public.email_preferences p where p.user_id=o.user_id and not p.collaboration_emails)) or
 (o.category='optional' and not exists(select 1 from public.email_preferences p where p.user_id=o.user_id and p.digest_frequency<>'off')) or
 (o.category='confirmation' and not exists(select 1 from pheelm_email.subscriptions s where s.email=lower(o.recipient) and s.confirmed_at is null and s.unsubscribed_at is null and o.action_path='/newsletter-confirm?token='||s.token)));
 return query with due as (
 select id from pheelm_email.outbox where (state='pending' or (state='processing' and available_at<now())) and available_at<=now() and attempts<6 order by created_at for update skip locked limit greatest(1,least(batch_size,20))
 ) update pheelm_email.outbox o set state='processing',attempts=o.attempts+1,available_at=now()+interval '15 minutes',lease=gen_random_uuid() from due where o.id=due.id returning o.*;
end $$;
create function public.email_complete(job_id uuid,lease_id uuid,provider text default null,failure text default null,retryable boolean default false) returns void language sql security definer set search_path='' as $$
 update pheelm_email.outbox set state=case when failure is null then 'sent' when retryable and attempts<6 then 'pending' else 'failed' end,
 provider_id=coalesce(provider,provider_id),sent_at=case when failure is null then now() else sent_at end,last_error=left(failure,200),
 available_at=now()+make_interval(secs=>least(3600,60*power(2,attempts)::int)),lease=null where id=job_id and lease=lease_id and state='processing';
$$;
create function public.email_record_event(event_id text,event_type text,email_id text) returns void language plpgsql security definer set search_path='' as $$
declare address text;
begin
 insert into pheelm_email.events(id,type) values(event_id,event_type) on conflict do nothing;if not found then return; end if;
 if event_type in ('email.bounced','email.complained','email.suppressed') then
 select recipient into address from pheelm_email.outbox where provider_id=email_id;
 if address is not null then
 insert into pheelm_email.suppressions(email,reason) values(lower(address),event_type) on conflict(email) do update set reason=excluded.reason;
 update pheelm_email.outbox set state='suppressed',message='' where lower(recipient)=lower(address) and state in ('pending','processing');
 end if;
 end if;
end $$;
create function public.email_token_action(token_value text,action text) returns boolean language plpgsql security definer set search_path='' as $$
declare address text;
begin
 if length(token_value)<>64 then return false; end if;
 if action='confirm' then
 update pheelm_email.subscriptions s set confirmed_at=now() where token=token_value and unsubscribed_at is null and requested_at>now()-interval '7 days' and exists(select 1 from public.subscribers p where lower(p.email)=s.email) returning email into address;return found;
 elsif action='unsubscribe' then
 update pheelm_email.subscriptions set unsubscribed_at=now(),confirmed_at=null where token=token_value returning email into address;
 if address is not null then delete from public.subscribers where lower(email)=address;return true;end if;
 update public.email_preferences set collaboration_emails=false,digest_frequency='off',updated_at=now() where unsubscribe_token=token_value;return found;
 end if;return false;
end $$;
create function public.email_prepare_digests() returns void language plpgsql security definer set search_path='' as $$
declare p record; cnt int; bucket text;
begin
 for p in select ep.*,u.email,u.email_confirmed_at from public.email_preferences ep join auth.users u on u.id=ep.user_id where ep.digest_frequency<>'off' and u.email_confirmed_at is not null and (u.banned_until is null or u.banned_until<now()) loop
 bucket:=case when p.digest_frequency='weekly' then to_char(date_trunc('week',now()),'YYYY-MM-DD') else to_char(now(),'YYYY-MM-DD') end;
 if p.digest_frequency='weekly' and extract(isodow from now())<>1 then continue;end if;
 select count(*) into cnt from public.notifications n where n.user_id=p.user_id and n.read_at is null and n.type not in ('invite','request','invite_accepted','invite_declined','request_accepted','request_declined','removed') and n.created_at>now()-case when p.digest_frequency='weekly' then interval '7 days' else interval '1 day' end and not exists(select 1 from public.notification_preferences np where np.user_id=p.user_id and n.type=any(np.disabled_types));
 if cnt>0 then perform pheelm_email.enqueue('digest:'||p.user_id||':'||bucket,p.user_id,p.email,'activity-digest','You have '||cnt||' unread Pheelm updates. Sign in to see the latest activity.','/notifications','optional');end if;
 end loop;
 delete from pheelm_email.outbox where created_at<now()-interval '14 days';
 delete from pheelm_email.events where created_at<now()-interval '14 days';
end $$;
create function public.email_job_preferences(uid uuid) returns jsonb language sql security definer set search_path='' as $$
 select jsonb_build_object('token',unsubscribe_token,'collaboration',collaboration_emails,'digest',digest_frequency) from public.email_preferences where user_id=uid;
$$;
create function public.email_reply_to_message(message_id uuid,reply text) returns void language plpgsql security definer set search_path='' as $$
declare m record;
begin
 if not public.is_admin() then raise exception 'Admin access required' using errcode='42501';end if;
 if length(trim(reply)) not between 1 and 5000 then raise exception 'Write a reply of 1–5000 characters';end if;
 select * into m from public.messages where id=message_id;if not found then raise exception 'Message not found';end if;
 perform pheelm_email.enqueue('reply:'||gen_random_uuid(),null,m.email,'support-response',trim(reply)||E'\n\nReference: '||m.id,'/contact');
end $$;
revoke all on function public.email_reply_to_message(uuid,text) from public,anon;
grant execute on function public.email_reply_to_message(uuid,text) to authenticated;
-- Blanket grants are not used: each privileged RPC is explicitly restricted.
revoke all on function public.email_delivery_config(),public.email_claim(int),public.email_complete(uuid,uuid,text,text,boolean),public.email_record_event(text,text,text),public.email_token_action(text,text),public.email_prepare_digests(),public.email_job_preferences(uuid) from public,anon,authenticated;
grant execute on function public.email_delivery_config(),public.email_claim(int),public.email_complete(uuid,uuid,text,text,boolean),public.email_record_event(text,text,text),public.email_token_action(text,text),public.email_prepare_digests(),public.email_job_preferences(uuid) to service_role;
revoke all on all functions in schema pheelm_email from public,anon,authenticated;

-- Export only confirmed, currently subscribed, unsuppressed newsletter recipients.
create function public.email_confirmed_subscribers() returns table(email text,source text,created_at timestamptz)
language plpgsql security definer set search_path='' as $$
begin
 if not public.is_owner() then raise exception 'Owner access required' using errcode='42501';end if;
 return query select p.email,p.source,p.created_at from public.subscribers p join pheelm_email.subscriptions s on s.email=lower(p.email) where s.confirmed_at is not null and s.unsubscribed_at is null and not exists(select 1 from pheelm_email.suppressions b where b.email=lower(p.email)) order by p.created_at,p.email;
end $$;
revoke all on function public.email_confirmed_subscribers() from public,anon;
grant execute on function public.email_confirmed_subscribers() to authenticated;

create function public.email_newsletter_status() returns text language sql stable security definer set search_path='' as $$
 select case when exists(select 1 from public.subscribers p join pheelm_email.subscriptions s on s.email=lower(p.email) where lower(p.email)=lower((select email from auth.users where id=(select auth.uid()))) and s.confirmed_at is not null and s.unsubscribed_at is null) then 'confirmed'
 when exists(select 1 from public.subscribers where lower(email)=lower((select email from auth.users where id=(select auth.uid())))) then 'pending' else 'off' end;
$$;
revoke all on function public.email_newsletter_status() from public,anon;
grant execute on function public.email_newsletter_status() to authenticated;

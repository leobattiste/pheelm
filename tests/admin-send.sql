-- Admin → Send (supabase/migrations/20261121223002_admin_send.sql). Runs after the email archive
-- scripts and tests/admin-send-bootstrap.sql in a disposable database.
\set ON_ERROR_STOP on
begin;
delete from pheelm_email.outbox; delete from public.notifications;
insert into auth.users(id, email, email_confirmed_at) values
  ('00000000-0000-0000-0000-0000000000a1', 'delivered+owner@resend.dev', now()),
  ('00000000-0000-0000-0000-0000000000a2', 'delivered+admin@resend.dev', now()),
  ('00000000-0000-0000-0000-0000000000b1', 'delivered+fan@resend.dev', now()),
  ('00000000-0000-0000-0000-0000000000b2', 'delivered+quiet@resend.dev', now()),
  ('00000000-0000-0000-0000-0000000000b3', 'delivered+bounced@resend.dev', now()),
  ('00000000-0000-0000-0000-0000000000b4', 'delivered+suspended@resend.dev', now()),
  ('00000000-0000-0000-0000-0000000000b5', 'delivered+unconfirmed-send@resend.dev', null)
on conflict (id) do nothing;
insert into public.profiles(id, display_name, handle, is_admin, is_owner, suspended_at) values
  ('00000000-0000-0000-0000-0000000000a1', 'Owner', 'owner', true, true, null),
  ('00000000-0000-0000-0000-0000000000a2', 'Admin', 'admin', true, false, null),
  ('00000000-0000-0000-0000-0000000000b1', 'Fan', 'fan', false, false, null),
  ('00000000-0000-0000-0000-0000000000b2', 'Quiet', 'quiet', false, false, null),
  ('00000000-0000-0000-0000-0000000000b3', 'Bounced', 'bounced', false, false, null),
  ('00000000-0000-0000-0000-0000000000b4', 'Suspended', 'suspended', false, false, now()),
  ('00000000-0000-0000-0000-0000000000b5', 'Unconfirmed', 'unconfirmed', false, false, null);
delete from pheelm_email.outbox; -- welcome emails from the inserts above
insert into public.people(id, name, slug) values ('00000000-0000-0000-0000-0000000000d1', 'A Director', 'a-director');
insert into public.films(id, title, slug, status) values ('00000000-0000-0000-0000-0000000000f1', 'A Film', 'a-film', 'draft');
insert into public.follows(user_id, person_id) values ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000d1'), ('00000000-0000-0000-0000-0000000000b4', '00000000-0000-0000-0000-0000000000d1');
insert into public.watchlist(user_id, film_id) values ('00000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-0000000000f1');
-- Quiet turned announcement emails off and muted announcements in-app; Bounced is suppressed.
insert into public.email_preferences(user_id, announcement_emails) values ('00000000-0000-0000-0000-0000000000b2', false)
  on conflict (user_id) do update set announcement_emails = false;
insert into public.notification_preferences(user_id, disabled_types) values ('00000000-0000-0000-0000-0000000000b2', array['announcement'])
  on conflict (user_id) do update set disabled_types = excluded.disabled_types;
insert into pheelm_email.suppressions(email, reason) values ('delivered+bounced@resend.dev', 'email.bounced') on conflict do nothing;
-- One confirmed newsletter subscriber who isn't a member, one who left.
insert into public.subscribers(email) values ('delivered+reader@resend.dev'), ('delivered+left@resend.dev');
update pheelm_email.subscriptions set confirmed_at = now() where email = 'delivered+reader@resend.dev';
update pheelm_email.subscriptions set unsubscribed_at = now() where email = 'delivered+left@resend.dev';
delete from pheelm_email.outbox;

-- Members who aren't admins can't preview, test or send.
set local request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000b1';
do $$begin
  begin perform public.admin_campaign_preview('announcement', 'members', null, array['in_app','email']); raise exception 'member previewed'; exception when insufficient_privilege then null; end;
  begin perform public.admin_campaign_test('announcement', 'Hello there', 'Body'); raise exception 'member tested'; exception when insufficient_privilege then null; end;
  begin perform public.admin_campaign_send('announcement', 'Hello there', 'Body', '/', null, 'members', null, array['in_app'], 1); raise exception 'member sent'; exception when insufficient_privilege then null; end;
end$$;

-- An admin can preview and test, but only the owner sends.
set local request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000a2';
do $$declare r jsonb;begin
  -- All members: owner, admin, fan, quiet, bounced (not suspended, not unconfirmed) = 5.
  r := public.admin_campaign_preview('announcement', 'members', null, array['in_app','email']);
  if r <> '{"audience":5,"recipients":4,"in_app":4,"emails":3}'::jsonb then raise exception 'announcement preview %', r; end if;
  -- A service notice ignores the opt-outs but never emails a bounced address.
  r := public.admin_campaign_preview('service', 'members', null, array['in_app','email']);
  if r <> '{"audience":5,"recipients":5,"in_app":5,"emails":4}'::jsonb then raise exception 'service preview %', r; end if;
  r := public.admin_campaign_preview('announcement', 'followers', '00000000-0000-0000-0000-0000000000d1', array['email']);
  if r <> '{"audience":1,"recipients":1,"in_app":0,"emails":1}'::jsonb then raise exception 'followers preview %', r; end if;
  r := public.admin_campaign_preview('announcement', 'watchlisted', '00000000-0000-0000-0000-0000000000f1', array['in_app','email']);
  if r <> '{"audience":1,"recipients":0,"in_app":0,"emails":0}'::jsonb then raise exception 'watchlisted preview %', r; end if;
  r := public.admin_campaign_preview('newsletter', 'subscribers', null, array['email']);
  if r <> '{"audience":1,"recipients":1,"in_app":0,"emails":1}'::jsonb then raise exception 'newsletter preview %', r; end if;
  begin perform public.admin_campaign_preview('newsletter', 'members', null, array['email']); raise exception 'newsletter to members'; exception when raise_exception then if sqlerrm not like 'A newsletter goes%' then raise; end if; end;
  begin perform public.admin_campaign_preview('newsletter', 'subscribers', null, array['in_app','email']); raise exception 'newsletter in-app'; exception when raise_exception then if sqlerrm not like 'A newsletter is sent%' then raise; end if; end;
  begin perform public.admin_campaign_preview('announcement', 'followers', null, array['email']); raise exception 'no director'; exception when raise_exception then if sqlerrm not like 'Choose the director%' then raise; end if; end;

  if public.admin_campaign_test('announcement', '  A test subject ', 'Line one
Line two', '/films', 'See films') <> 'delivered+admin@resend.dev' then raise exception 'test address'; end if;
  begin perform public.admin_campaign_test('announcement', 'Elsewhere', 'Body', 'https://evil.test'); raise exception 'external link'; exception when raise_exception then if sqlerrm not like 'The button link%' then raise; end if; end;
  begin perform public.admin_campaign_test('announcement', 'Elsewhere', 'Body', '//evil.test'); raise exception 'protocol-relative link'; exception when raise_exception then if sqlerrm not like 'The button link%' then raise; end if; end;
  begin perform public.admin_campaign_send('announcement', 'Hello there', 'Body', '/', null, 'members', null, array['in_app'], 4); raise exception 'admin sent'; exception when insufficient_privilege then null; end;
end$$;
do $$begin
  if not exists (select 1 from pheelm_email.outbox where category = 'test' and template = 'campaign-announcement' and subject = 'A test subject' and action_path = '/films' and action_label = 'See films' and recipient = 'delivered+admin@resend.dev' and campaign_id is null) then raise exception 'test email not queued'; end if;
  if exists (select 1 from public.notifications where type in ('announcement','service_notice')) then raise exception 'a test made notifications'; end if;
end$$;

-- The owner sends: the count must match what they confirmed.
set local request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000a1';
do $$declare r jsonb;begin
  begin perform public.admin_campaign_send('announcement', 'Big news', 'We added a thing.', '/films', 'See it', 'members', null, array['in_app','email'], 5); raise exception 'stale count accepted'; exception when raise_exception then if sqlerrm not like 'The audience changed to 4%' then raise; end if; end;
  r := public.admin_campaign_send('announcement', 'Big news', 'We added a thing.', '/films', 'See it', 'members', null, array['in_app','email'], 4);
  if (r->>'in_app')::int <> 4 or (r->>'emails')::int <> 3 then raise exception 'announcement result %', r; end if;
  if (select count(*) from public.notifications where type = 'announcement' and detail = 'Big news' and ref_id = (r->>'id')::uuid) <> 4 then raise exception 'in-app count'; end if;
  if exists (select 1 from public.notifications where type = 'announcement' and user_id = '00000000-0000-0000-0000-0000000000b2') then raise exception 'muted member notified'; end if;
  if (select count(*) from pheelm_email.outbox where campaign_id = (r->>'id')::uuid and category = 'announcement' and template = 'campaign-announcement' and subject = 'Big news' and action_label = 'See it') <> 3 then raise exception 'emails queued'; end if;
  if exists (select 1 from pheelm_email.outbox where campaign_id = (r->>'id')::uuid and recipient in ('delivered+quiet@resend.dev','delivered+bounced@resend.dev','delivered+suspended@resend.dev')) then raise exception 'opted-out member emailed'; end if;
  -- A double tap doesn't send twice.
  begin perform public.admin_campaign_send('announcement', 'Big news', 'We added a thing.', '/films', 'See it', 'members', null, array['in_app','email'], 4); raise exception 'sent twice'; exception when raise_exception then if sqlerrm not like 'This subject was just sent%' then raise; end if; end;

  r := public.admin_campaign_send('service', 'Terms are changing', 'From January.', null, null, 'members', null, array['in_app','email'], 5);
  if (r->>'in_app')::int <> 5 or (r->>'emails')::int <> 4 then raise exception 'service result %', r; end if;
  if (select count(*) from public.notifications where type = 'service_notice' and ref_id = (r->>'id')::uuid) <> 5 then raise exception 'service in-app'; end if;
  if not exists (select 1 from pheelm_email.outbox where campaign_id = (r->>'id')::uuid and recipient = 'delivered+quiet@resend.dev' and category = 'transactional' and template = 'campaign-service' and action_path = '/' and action_label = 'Open Pheelm') then raise exception 'service email to opted-out member'; end if;

  r := public.admin_campaign_send('newsletter', 'Discoveries this month', 'Films to watch.', '/films', null, 'subscribers', null, array['email'], 1);
  if (r->>'emails')::int <> 1 or not exists (select 1 from pheelm_email.outbox where campaign_id = (r->>'id')::uuid and recipient = 'delivered+reader@resend.dev' and category = 'marketing' and user_id is null) then raise exception 'newsletter result %', r; end if;

  r := public.admin_campaign_send('announcement', 'Just for you', 'Hi.', '/', null, 'member', '00000000-0000-0000-0000-0000000000b1', array['email'], 1);
  if (select audience_label from pheelm_email.campaigns where id = (r->>'id')::uuid) <> 'Fan' then raise exception 'member label'; end if;
end$$;

-- History counts what happened to each email.
do $$declare h record;begin
  update pheelm_email.outbox set state = 'sent', provider_id = 'p-' || recipient where campaign_id = (select id from pheelm_email.campaigns where subject = 'Big news');
  perform public.email_record_event('evt-1', 'email.delivered', 'p-delivered+owner@resend.dev');
  perform public.email_record_event('evt-2', 'email.bounced', 'p-delivered+fan@resend.dev');
  perform public.email_record_event('evt-3', 'email.delivered', 'p-delivered+fan@resend.dev'); -- a later delivered doesn't hide the bounce
  update public.notifications set read_at = now() where type = 'announcement' and user_id = '00000000-0000-0000-0000-0000000000a1';
  select * into h from public.admin_campaigns(10) where subject = 'Big news';
  if h.emails <> 3 or h.sent <> 3 or h.delivered <> 1 or h.bounced <> 1 or h.queued <> 0 or h.in_app <> 4 or h.in_app_read <> 1 or h.sender <> 'Owner' then raise exception 'history %', row_to_json(h); end if;
  if (select count(*) from public.admin_campaigns(10)) <> 4 then raise exception 'history rows'; end if;
end$$;

-- Members read an announcement they were sent, and nobody else's.
do $$declare id uuid := (select c.id from pheelm_email.campaigns c where c.subject = 'Big news');begin
  if public.my_announcement(id)->>'message' <> 'We added a thing.' then raise exception 'owner reads own'; end if;
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b2', true);
  if public.my_announcement(id) is not null then raise exception 'muted member reads it'; end if;
end$$;

-- Worker side: the claim skips anyone who opted out after queueing.
update pheelm_email.outbox set state = 'pending', available_at = now() - interval '1 minute', provider_id = null;
insert into public.email_preferences(user_id, announcement_emails) values ('00000000-0000-0000-0000-0000000000a2', false) on conflict (user_id) do update set announcement_emails = false;
update pheelm_email.subscriptions set unsubscribed_at = now(), confirmed_at = null where email = 'delivered+reader@resend.dev';
do $$begin perform public.email_claim(20); end$$;
do $$begin
  if (select state from pheelm_email.outbox where recipient = 'delivered+admin@resend.dev' and category = 'announcement') <> 'suppressed' then raise exception 'announcement opt-out after queueing'; end if;
  if (select state from pheelm_email.outbox where recipient = 'delivered+reader@resend.dev' and category = 'marketing') <> 'suppressed' then raise exception 'newsletter unsubscribe after queueing'; end if;
  if (select state from pheelm_email.outbox where recipient = 'delivered+admin@resend.dev' and category = 'transactional' and template = 'campaign-service') <> 'processing' then raise exception 'service notice claimed'; end if;
  if (select state from pheelm_email.outbox where category = 'test') <> 'processing' then raise exception 'test claimed'; end if;
end$$;

-- Activity emails follow their own switch, not the Digest's.
delete from pheelm_email.outbox;
update public.email_preferences set digest_frequency = 'off', activity_emails = true where user_id = '00000000-0000-0000-0000-0000000000b2';
insert into pheelm_email.outbox(event_key, user_id, recipient, template, message, category) values
  ('a1', '00000000-0000-0000-0000-0000000000b2', 'delivered+quiet@resend.dev', 'activity-update', 'x', 'optional'),
  ('a2', '00000000-0000-0000-0000-0000000000b2', 'delivered+quiet@resend.dev', 'activity-digest', 'x', 'optional');
insert into public.email_preferences(user_id, activity_emails) values ('00000000-0000-0000-0000-0000000000a1', false) on conflict (user_id) do update set activity_emails = false;
insert into pheelm_email.outbox(event_key, user_id, recipient, template, message, category) values
  ('a3', '00000000-0000-0000-0000-0000000000a1', 'delivered+owner@resend.dev', 'activity-update', 'x', 'optional');
do $$begin perform public.email_claim(20); end$$;
do $$begin
  if (select state from pheelm_email.outbox where event_key = 'a1') <> 'processing' then raise exception 'activity email dropped with Digest off'; end if;
  if (select state from pheelm_email.outbox where event_key = 'a2') <> 'suppressed' then raise exception 'digest with Digest off'; end if;
  if (select state from pheelm_email.outbox where event_key = 'a3') <> 'suppressed' then raise exception 'activity email with activity off'; end if;
end$$;

-- A member's unsubscribe link turns announcement emails off too.
do $$declare t text;begin
  insert into public.email_preferences(user_id) values ('00000000-0000-0000-0000-0000000000b1') on conflict do nothing;
  select unsubscribe_token into t from public.email_preferences where user_id = '00000000-0000-0000-0000-0000000000b1';
  if (select announcement_emails from public.email_preferences where user_id = '00000000-0000-0000-0000-0000000000b1') is not true then raise exception 'announcements default on'; end if;
  if not public.email_token_action(t, 'unsubscribe') then raise exception 'unsubscribe'; end if;
  if (select announcement_emails from public.email_preferences where user_id = '00000000-0000-0000-0000-0000000000b1') then raise exception 'announcements still on'; end if;
end$$;

-- Nothing here is open to members or visitors directly.
do $$begin
  if has_function_privilege('anon', 'public.admin_campaign_send(text,text,text,text,text,text,uuid,text[],int)', 'execute') then raise exception 'anon can send'; end if;
  if has_function_privilege('authenticated', 'public.email_newsletter_token(text)', 'execute') then raise exception 'tokens readable'; end if;
  if has_function_privilege('authenticated', 'pheelm_email.campaign_audience(text,text,uuid)', 'execute') then raise exception 'audience readable'; end if;
  if pheelm_email.safe_path('/films?x=1') <> '/films?x=1' or pheelm_email.safe_path('') <> '/' or pheelm_email.safe_path('/\evil') is not null
    or pheelm_email.safe_path('/a b') is not null or pheelm_email.safe_path('/email?action=unsubscribe') is not null then raise exception 'safe_path'; end if;
end$$;
rollback;
\echo 'PASS: Send reaches the chosen members by the chosen channels, respects opt-outs and bounces, is owner-only, counts delivery, and activity emails follow their own switch.'

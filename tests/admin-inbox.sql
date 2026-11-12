-- Checks for supabase/admin-inbox.sql. Run after tests/admin-inbox-bootstrap.sql and the migration.
begin;
-- Senders can't choose a status, notes or deadline.
insert into public.messages(name, email, topic, body, handled, notes) values ('Spoof', 'a@example.com', 'general', 'Hello', true, 'injected');
do $$declare m record;begin select * into m from public.messages where email='a@example.com';
  if m.status<>'new' or m.handled or m.notes is not null then raise exception 'Insert state not forced: % % %', m.status, m.handled, m.notes;end if;end$$;
-- Partnerships start at "new"; privacy requests get a 30-day deadline.
insert into public.messages(email, topic, body, partnership_type, website) values ('p@example.com','partnership','Proposal','Film festival or screening','https://example.com');
insert into public.messages(email, topic, body) values ('x@example.com','privacy','Delete my data');
do $$begin
  if (select stage from public.messages where email='p@example.com')<>'new' then raise exception 'Partnership stage missing';end if;
  if (select due_at::date - created_at::date from public.messages where email='x@example.com')<>30 then raise exception 'Privacy deadline wrong';end if;
  if (select due_at from public.messages where email='p@example.com') is not null then raise exception 'Deadline on a partnership';end if;
end$$;
-- Status and the old "handled" flag stay in step, both ways, and closing is stamped.
update public.messages set status='done' where email='a@example.com';
do $$declare m record;begin select * into m from public.messages where email='a@example.com';
  if not m.handled or m.closed_at is null then raise exception 'Done not reflected';end if;end$$;
update public.messages set handled=false where email='a@example.com';
do $$declare m record;begin select * into m from public.messages where email='a@example.com';
  if m.status<>'open' or m.closed_at is not null then raise exception 'Reopen via handled not reflected: %', m.status;end if;end$$;
update public.messages set status='spam' where email='a@example.com';
do $$begin if not (select handled from public.messages where email='a@example.com') then raise exception 'Spam should count as handled';end if;end$$;
do $$begin begin update public.messages set status='archived' where email='a@example.com';raise exception 'Bad status accepted';exception when check_violation then null;end;end$$;
-- Replies need an admin, are emailed, kept, and update the message.
do $$begin begin perform public.email_reply_to_message((select id from public.messages where email='p@example.com'),'Hi');raise exception 'Non-admin replied';exception when insufficient_privilege then null;end;end$$;
select set_config('test.is_admin','true',true), set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000a',true);
select public.email_reply_to_message((select id from public.messages where email='p@example.com'), '  Thanks, let''s talk.  ');
do $$declare m record;begin select * into m from public.messages where email='p@example.com';
  if m.status<>'open' or m.replied_at is null then raise exception 'Reply did not mark read: %', m.status;end if;
  if (select count(*) from public.message_replies where message_id=m.id and body='Thanks, let''s talk.' and author_id='00000000-0000-0000-0000-00000000000a')<>1 then raise exception 'Reply not kept';end if;
  if (select count(*) from pheelm_email.outbox where template='support-response' and recipient='p@example.com')<>1 then raise exception 'Reply not queued';end if;
end$$;
select public.email_reply_to_message((select id from public.messages where email='x@example.com'), 'Done.', true);
do $$begin if (select status from public.messages where email='x@example.com')<>'done' then raise exception 'Reply and close failed';end if;end$$;
-- Deleting a message deletes its replies.
delete from public.messages where email='p@example.com';
do $$begin if exists(select 1 from public.message_replies) and (select count(*) from public.message_replies)<>1 then raise exception 'Replies not removed with message';end if;end$$;
-- Newsletter: counts for admins, the list and removal for the owner only.
insert into public.subscribers(email) values ('one@example.com'),('two@example.com'),('three@example.com'),('four@example.com');
insert into pheelm_email.subscriptions values ('one@example.com', now(), null), ('three@example.com', now(), now()), ('four@example.com', now(), null);
insert into pheelm_email.suppressions values ('four@example.com', 'bounced');
do $$declare c jsonb := public.admin_newsletter_counts();begin
  if c->>'confirmed'<>'1' or c->>'pending'<>'1' or c->>'unsubscribed'<>'1' or c->>'suppressed'<>'1' or c->>'total'<>'4' then raise exception 'Counts wrong: %', c;end if;end$$;
do $$begin begin perform * from public.admin_newsletter();raise exception 'Admin saw addresses';exception when insufficient_privilege then null;end;end$$;
select set_config('test.is_owner','true',true);
do $$begin
  if (select count(*) from public.admin_newsletter(null,'confirmed'))<>1 then raise exception 'State filter wrong';end if;
  if (select total from public.admin_newsletter('TWO',null) limit 1)<>1 then raise exception 'Search wrong';end if;
  if (select count(*) from public.admin_newsletter('%',null))<>4 then raise exception 'Wildcards should be ignored';end if;
end$$;
select public.admin_remove_subscriber('ONE@example.com');
do $$begin
  if exists(select 1 from public.subscribers where email='one@example.com') then raise exception 'Not removed';end if;
  if (select unsubscribed_at from pheelm_email.subscriptions where email='one@example.com') is null then raise exception 'Not unsubscribed';end if;
end$$;
-- Nothing new is callable without signing in.
do $$begin
  if has_function_privilege('anon','public.email_reply_to_message(uuid,text,boolean)','execute') or has_function_privilege('anon','public.admin_newsletter(text,text,integer,integer)','execute')
    or has_function_privilege('anon','public.admin_remove_subscriber(text)','execute') or has_function_privilege('anon','public.admin_newsletter_counts()','execute') then raise exception 'Exposed to anon';end if;
end$$;
rollback;

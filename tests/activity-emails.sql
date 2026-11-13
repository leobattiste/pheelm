\set ON_ERROR_STOP on
begin;
insert into auth.users(id,email,email_confirmed_at) values
 ('00000000-0000-0000-0000-000000000011','delivered+activity@resend.dev',now()),
 ('00000000-0000-0000-0000-000000000012','delivered+unconfirmed@resend.dev',null);
delete from pheelm_email.outbox where template='welcome';

-- Each activity type is emailed, and says what happened without saying who or what.
insert into public.notifications(user_id,type) values
 ('00000000-0000-0000-0000-000000000011','reply'),('00000000-0000-0000-0000-000000000011','mention'),
 ('00000000-0000-0000-0000-000000000011','comment'),('00000000-0000-0000-0000-000000000011','new_film');
do $$begin
 if (select count(*) from pheelm_email.outbox where template='activity-update' and category='optional')<>4 then raise exception 'Activity emails missing'; end if;
 if not exists(select 1 from pheelm_email.outbox where template='activity-update' and message like 'Someone replied to your comment%') then raise exception 'Reply wording'; end if;
 if exists(select 1 from pheelm_email.outbox where template='activity-update' and (message ilike '%@%' or message ilike '%“%')) then raise exception 'Emails must not name people or quote text'; end if;
end$$;

-- No more than 5 an hour.
insert into public.notifications(user_id,type) values
 ('00000000-0000-0000-0000-000000000011','reply'),('00000000-0000-0000-0000-000000000011','reply'),('00000000-0000-0000-0000-000000000011','reply');
do $$begin if (select count(*) from pheelm_email.outbox where template='activity-update')<>5 then raise exception 'Hourly limit'; end if; end$$;

-- Collaboration emails are unchanged, and not counted against the limit.
insert into public.notifications(user_id,type) values ('00000000-0000-0000-0000-000000000011','invite');
do $$begin if (select count(*) from pheelm_email.outbox where template='collection-invitation')<>1 then raise exception 'Invitation missing'; end if; end$$;

-- Turning it off stops them; so does turning the type off in notification settings.
delete from pheelm_email.outbox where template='activity-update';
update public.email_preferences set activity_emails=false where user_id='00000000-0000-0000-0000-000000000011';
insert into public.notifications(user_id,type) values ('00000000-0000-0000-0000-000000000011','reply');
do $$begin if exists(select 1 from pheelm_email.outbox where template='activity-update') then raise exception 'Preference ignored'; end if; end$$;
update public.email_preferences set activity_emails=true where user_id='00000000-0000-0000-0000-000000000011';
insert into public.notification_preferences(user_id,disabled_types) values ('00000000-0000-0000-0000-000000000011',array['mention']);
insert into public.notifications(user_id,type) values ('00000000-0000-0000-0000-000000000011','mention');
do $$begin if exists(select 1 from pheelm_email.outbox where template='activity-update') then raise exception 'Disabled type was emailed'; end if; end$$;

-- Unconfirmed addresses get nothing.
insert into public.notifications(user_id,type) values ('00000000-0000-0000-0000-000000000012','reply');
do $$begin if exists(select 1 from pheelm_email.outbox where user_id='00000000-0000-0000-0000-000000000012' and template='activity-update') then raise exception 'Unconfirmed address emailed'; end if; end$$;

-- The unsubscribe link in an email turns activity emails off too.
update public.email_preferences set activity_emails=true where user_id='00000000-0000-0000-0000-000000000011';
select public.email_token_action(unsubscribe_token,'unsubscribe') from public.email_preferences where user_id='00000000-0000-0000-0000-000000000011';
do $$begin if (select activity_emails from public.email_preferences where user_id='00000000-0000-0000-0000-000000000011') then raise exception 'Unsubscribe link left activity emails on'; end if; end$$;
rollback;
select 'PASS: activity emails, hourly limit, preferences, unsubscribe' as result;

-- Just enough of Supabase and the existing schema for supabase/admin-inbox.sql to run against.
do $$begin create role anon;exception when duplicate_object then null;end$$;
do $$begin create role authenticated;exception when duplicate_object then null;end$$;
create schema if not exists auth;
create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
create table auth.users(id uuid primary key, email text);
create function public.is_admin() returns boolean language sql as $$select coalesce(current_setting('test.is_admin',true),'')='true'$$;
create function public.is_owner() returns boolean language sql as $$select coalesce(current_setting('test.is_owner',true),'')='true'$$;
create table public.messages(
  id uuid primary key default gen_random_uuid(), name text, email text not null, organization text, topic text not null default 'general',
  body text not null, handled boolean not null default false, created_at timestamptz not null default now(), page text, page_title text
);
create table public.subscribers(email text primary key, source text, created_at timestamptz not null default now());
create schema pheelm_email;
create table pheelm_email.outbox(event_key text primary key, recipient text, template text, message text);
create table pheelm_email.subscriptions(email text primary key, confirmed_at timestamptz, unsubscribed_at timestamptz);
create table pheelm_email.suppressions(email text primary key, reason text);
create function pheelm_email.enqueue(k text, uid uuid, address text, tid text, body text, path text default '/account', kind text default 'transactional') returns void
language sql as $$insert into pheelm_email.outbox values (k, address, tid, body)$$;
insert into auth.users values ('00000000-0000-0000-0000-00000000000a', 'admin@example.com');

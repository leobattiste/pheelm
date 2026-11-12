-- Just enough of Supabase and the existing schema for supabase/admin-community.sql to run against.
do $$begin create role anon;exception when duplicate_object then null;end$$;
do $$begin create role authenticated;exception when duplicate_object then null;end$$;
do $$begin create role service_role;exception when duplicate_object then null;end$$;
create schema if not exists auth;
create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
create table auth.users(id uuid primary key, email text, last_sign_in_at timestamptz);
create table public.profiles(id uuid primary key references auth.users(id), handle text, display_name text, is_admin boolean not null default false,
  is_owner boolean not null default false, is_private boolean, bio text, created_at timestamptz not null default now());
create function public.is_admin() returns boolean language sql stable as $$select coalesce((select is_admin from public.profiles where id = auth.uid()), false)$$;
create function public.is_owner() returns boolean language sql stable as $$select coalesce((select is_owner from public.profiles where id = auth.uid()), false)$$;
create table public.lists(id uuid primary key default gen_random_uuid(), user_id uuid not null, title text, is_public boolean not null default true, hidden boolean not null default false);
alter table public.lists enable row level security;
create table public.list_comments(id uuid primary key default gen_random_uuid(), list_id uuid, user_id uuid, body text, removed_at timestamptz);
create table public.list_films(list_id uuid, film_id uuid);
create table public.comment_likes(comment_id uuid, user_id uuid);
create table public.submissions(id uuid primary key default gen_random_uuid(), user_id uuid, title text);
create table public.watchlist(user_id uuid, film_id uuid);
insert into auth.users(id, email) values
  ('00000000-0000-0000-0000-00000000000a','owner@example.com'), ('00000000-0000-0000-0000-00000000000b','admin@example.com'),
  ('00000000-0000-0000-0000-00000000000c','member@example.com'), ('00000000-0000-0000-0000-00000000000d','other@example.com');
insert into public.profiles(id, handle, is_admin, is_owner) values
  ('00000000-0000-0000-0000-00000000000a','owner',true,true), ('00000000-0000-0000-0000-00000000000b','admin',true,false),
  ('00000000-0000-0000-0000-00000000000c','member',false,false), ('00000000-0000-0000-0000-00000000000d','other',false,false);
insert into public.lists(user_id, title) values ('00000000-0000-0000-0000-00000000000c','Public list');
insert into public.lists(user_id, title, is_public) values ('00000000-0000-0000-0000-00000000000c','Private list', false);

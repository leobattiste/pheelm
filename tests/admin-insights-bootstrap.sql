-- Just enough of the schema for supabase/admin-insights.sql to run against.
do $$begin create role anon;exception when duplicate_object then null;end$$;
do $$begin create role authenticated;exception when duplicate_object then null;end$$;
create function public.is_admin() returns boolean language sql as $$select coalesce(current_setting('test.is_admin',true),'')='true'$$;
create table public.films(id serial primary key, year int, countries text[], genres text[], created_at timestamptz not null default now());
create table public.profiles(id serial primary key, created_at timestamptz not null default now());
create table public.lists(id serial primary key, created_at timestamptz not null default now());
create table public.list_saves(id serial primary key, created_at timestamptz not null default now());
insert into public.films(year, countries, genres, created_at) values
  (2019, '{SN,FR}', '{Drama,Romance}', now()), (2016, '{US}', '{Drama}', now() - interval '2 months'),
  (1991, null, null, now() - interval '2 years'), (null, '{}', '{}', now());
insert into public.profiles(created_at) values (now()), (now()), (now() - interval '1 month');
insert into public.lists(created_at) values (now());

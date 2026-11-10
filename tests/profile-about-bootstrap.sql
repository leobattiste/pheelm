create role anon;create role authenticated;
create table public.profiles(id uuid primary key,handle text,display_name text,is_private boolean default false,is_owner boolean not null default false,country text,bio text,avatar_url text);
create table public.member_profiles(like public.profiles including all);

do $$begin create role anon;exception when duplicate_object then null;end$$;do $$begin create role authenticated;exception when duplicate_object then null;end$$;do $$begin create role service_role;exception when duplicate_object then null;end$$;
create schema auth;create schema extensions;create extension pgcrypto with schema extensions;create schema vault;
create table vault.decrypted_secrets(name text,decrypted_secret text);
create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,banned_until timestamptz,updated_at timestamptz default now());
create table public.subscribers(email text primary key,source text,created_at timestamptz default now());
create table public.messages(id uuid primary key default gen_random_uuid(),email text,topic text);
create table public.submissions(id uuid primary key default gen_random_uuid(),user_id uuid,title text,status text default 'pending',reviewed_at timestamptz);
create table public.notifications(id uuid primary key default gen_random_uuid(),user_id uuid,type text,read_at timestamptz,created_at timestamptz default now());
create table public.notification_preferences(user_id uuid primary key,disabled_types text[]);
create function public.is_admin() returns boolean language sql as $$select current_setting('test.is_admin',true)='true'$$;

create function public.is_owner() returns boolean language sql as $$select public.is_admin()$$;

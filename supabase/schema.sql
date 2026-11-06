-- Database schema
-- Run this once in the Supabase SQL editor, then storage.sql, then seed.sql. Safe to run again.

-- Catalog --------------------------------------------------------------------

create table if not exists public.films (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  title text not null,
  original_title text,
  year int not null check (year between 1890 and 2100),
  type text not null default 'feature' check (type in ('feature', 'documentary', 'short', 'animation')),
  countries text[] not null default '{}',
  languages text[] not null default '{}',
  genres text[] not null default '{}',
  runtime int,
  synopsis text,
  poster_url text,
  backdrop_url text,
  trailer_url text,
  -- [{ "award": "Cannes Film Festival", "category": "Grand Prix", "result": "won", "year": 2019 }]
  awards jsonb not null default '[]',
  -- [{ "provider": "Criterion Channel", "url": "https://…", "kind": "stream", "region": "US" }]
  watch jsonb not null default '[]',
  tmdb_id int unique,
  status text not null default 'published' check (status in ('draft', 'published')),
  featured boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- The film's colour, taken from its poster, tints its page. Added after launch, so it's an alter.
alter table public.films add column if not exists color text check (color ~ '^#[0-9a-fA-F]{6}$');

create index if not exists films_year_idx on public.films (year desc, title);

create table if not exists public.people (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  bio text,
  country text,
  birth_year int,
  photo_url text,
  tmdb_id int unique,
  created_at timestamptz not null default now()
);

-- Who did what on each film. A person can have several roles on one film.
create table if not exists public.credits (
  film_id uuid not null references public.films (id) on delete cascade,
  person_id uuid not null references public.people (id) on delete cascade,
  role text not null check (role in ('director', 'writer', 'producer', 'cinematographer', 'editor', 'composer', 'cast')),
  character text,
  sort int not null default 0,
  primary key (film_id, person_id, role)
);

create index if not exists credits_person_idx on public.credits (person_id);

create table if not exists public.collections (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  title text not null,
  description text,
  kind text not null default 'theme' check (kind in ('country', 'decade', 'movement', 'theme', 'genre')),
  featured boolean not null default false,
  sort_order int not null default 99,
  created_at timestamptz not null default now()
);

create table if not exists public.collection_films (
  collection_id uuid not null references public.collections (id) on delete cascade,
  film_id uuid not null references public.films (id) on delete cascade,
  sort int not null default 0,
  primary key (collection_id, film_id)
);

create table if not exists public.articles (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  title text not null,
  dek text,
  kind text not null default 'essay' check (kind in ('essay', 'interview', 'history', 'story', 'news')),
  author text,
  cover_url text,
  body text not null default '',
  film_ids uuid[] not null default '{}',
  status text not null default 'draft' check (status in ('draft', 'published')),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Accounts -------------------------------------------------------------------

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  is_admin boolean not null default false,
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select coalesce((select is_admin from public.profiles where id = auth.uid()), false);
$$;

-- Each member's watchlist. "seen" marks films they've watched.
create table if not exists public.watchlist (
  user_id uuid not null references auth.users (id) on delete cascade,
  film_id uuid not null references public.films (id) on delete cascade,
  seen boolean not null default false,
  added_at timestamptz not null default now(),
  primary key (user_id, film_id)
);

create table if not exists public.submissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete set null,
  title text not null check (char_length(title) between 1 and 200),
  director text not null check (char_length(director) between 1 and 200),
  year int check (year between 1890 and 2100),
  link text check (char_length(link) <= 500),
  note text check (char_length(note) <= 2000),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  film_id uuid references public.films (id) on delete set null,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);

create index if not exists submissions_status_idx on public.submissions (status, created_at desc);

-- Row level security ---------------------------------------------------------

alter table public.films enable row level security;
alter table public.people enable row level security;
alter table public.credits enable row level security;
alter table public.collections enable row level security;
alter table public.collection_films enable row level security;
alter table public.articles enable row level security;
alter table public.profiles enable row level security;
alter table public.watchlist enable row level security;
alter table public.submissions enable row level security;

-- The catalog is public to read (drafts only for admins); only admins change it.
drop policy if exists "read films" on public.films;
create policy "read films" on public.films for select using (status = 'published' or public.is_admin());
drop policy if exists "admin films" on public.films;
create policy "admin films" on public.films for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "read people" on public.people;
create policy "read people" on public.people for select using (true);
drop policy if exists "admin people" on public.people;
create policy "admin people" on public.people for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "read credits" on public.credits;
create policy "read credits" on public.credits for select using (true);
drop policy if exists "admin credits" on public.credits;
create policy "admin credits" on public.credits for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "read collections" on public.collections;
create policy "read collections" on public.collections for select using (true);
drop policy if exists "admin collections" on public.collections;
create policy "admin collections" on public.collections for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "read collection films" on public.collection_films;
create policy "read collection films" on public.collection_films for select using (true);
drop policy if exists "admin collection films" on public.collection_films;
create policy "admin collection films" on public.collection_films for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "read articles" on public.articles;
create policy "read articles" on public.articles for select using (status = 'published' or public.is_admin());
drop policy if exists "admin articles" on public.articles;
create policy "admin articles" on public.articles for all using (public.is_admin()) with check (public.is_admin());

-- Profiles: members read and rename their own. Nobody can make themselves admin.
drop policy if exists "read own profile" on public.profiles;
create policy "read own profile" on public.profiles for select using (id = auth.uid() or public.is_admin());
drop policy if exists "update own profile" on public.profiles;
create policy "update own profile" on public.profiles for update using (id = auth.uid())
  with check (id = auth.uid() and is_admin = (select p.is_admin from public.profiles p where p.id = auth.uid()));

-- Watchlists are private to their owner.
drop policy if exists "own watchlist" on public.watchlist;
create policy "own watchlist" on public.watchlist for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Submissions: signed-in members add and read their own; admins review all.
drop policy if exists "add submission" on public.submissions;
create policy "add submission" on public.submissions for insert to authenticated
  with check (user_id = auth.uid() and status = 'pending' and reviewed_at is null and film_id is null);
drop policy if exists "read submissions" on public.submissions;
create policy "read submissions" on public.submissions for select using (user_id = auth.uid() or public.is_admin());
drop policy if exists "review submissions" on public.submissions;
create policy "review submissions" on public.submissions for update using (public.is_admin()) with check (public.is_admin());
drop policy if exists "delete submissions" on public.submissions;
create policy "delete submissions" on public.submissions for delete using (public.is_admin());

-- Members' own collections (same as supabase/member-collections.sql) --------------
create table if not exists public.lists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 80),
  description text check (char_length(description) <= 500),
  is_public boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists lists_user_idx on public.lists (user_id, created_at);

create table if not exists public.list_films (
  list_id uuid not null references public.lists (id) on delete cascade,
  film_id uuid not null references public.films (id) on delete cascade,
  added_at timestamptz not null default now(),
  primary key (list_id, film_id)
);

alter table public.lists enable row level security;
alter table public.list_films enable row level security;

-- Owners do anything with their own collections; anyone can read a public one.
drop policy if exists "read lists" on public.lists;
create policy "read lists" on public.lists for select using (is_public or user_id = auth.uid());
drop policy if exists "own lists" on public.lists;
create policy "own lists" on public.lists for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "read list films" on public.list_films;
create policy "read list films" on public.list_films for select using (
  exists (select 1 from public.lists l where l.id = list_films.list_id and (l.is_public or l.user_id = auth.uid()))
);
drop policy if exists "own list films" on public.list_films;
create policy "own list films" on public.list_films for all
  using (exists (select 1 from public.lists l where l.id = list_films.list_id and l.user_id = auth.uid()))
  with check (exists (select 1 from public.lists l where l.id = list_films.list_id and l.user_id = auth.uid()));

-- Following directors (same as supabase/follows.sql) -------------------------------
create table if not exists public.follows (
  user_id uuid not null references auth.users (id) on delete cascade,
  person_id uuid not null references public.people (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, person_id)
);

alter table public.follows enable row level security;
drop policy if exists "own follows" on public.follows;
create policy "own follows" on public.follows for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Films by the directors the signed-in member follows, added since they started following.
create or replace function public.follow_updates()
returns table (
  film_id uuid, slug text, title text, year int, poster_url text,
  director_name text, director_slug text, added_at timestamptz
)
language sql
stable
set search_path = public
as $$
  select f.id, f.slug, f.title, f.year, f.poster_url, p.name, p.slug, f.created_at
  from public.follows fo
  join public.credits c on c.person_id = fo.person_id and c.role = 'director'
  join public.films f on f.id = c.film_id and f.status = 'published'
  join public.people p on p.id = fo.person_id
  where fo.user_id = auth.uid() and f.created_at > fo.created_at
  order by f.created_at desc
  limit 60;
$$;

grant execute on function public.follow_updates() to authenticated;

-- Fuller details for people, from TMDB: birth and death dates, birthplace, the job they're best
-- known for, and their IMDb and Instagram. Safe to run more than once.
alter table public.people
  add column if not exists born date,
  add column if not exists died date,
  add column if not exists birthplace text,
  add column if not exists known_for text,
  add column if not exists imdb_id text,
  add column if not exists instagram text,
  -- When these were last filled from TMDB, so the refresh only fetches people it hasn't yet.
  add column if not exists details_at timestamptz;

-- The newsletter list and the contact inbox. Anyone can sign up or send a message; only admins
-- can read them. Safe to run more than once.

create table if not exists public.subscribers (
  email text primary key check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' and length(email) <= 254),
  source text,
  created_at timestamptz not null default now()
);
alter table public.subscribers enable row level security;
drop policy if exists "Anyone can subscribe" on public.subscribers;
create policy "Anyone can subscribe" on public.subscribers for insert to anon, authenticated with check (true);
drop policy if exists "Admins read subscribers" on public.subscribers;
create policy "Admins read subscribers" on public.subscribers for select using (public.is_admin());
drop policy if exists "Admins remove subscribers" on public.subscribers;
create policy "Admins remove subscribers" on public.subscribers for delete using (public.is_admin());

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  name text check (length(name) <= 200),
  email text not null check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' and length(email) <= 254),
  organization text check (length(organization) <= 200),
  topic text not null default 'general' check (topic in ('general', 'correction', 'partnership', 'press', 'privacy')),
  body text not null check (length(body) between 1 and 5000),
  handled boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.messages enable row level security;
drop policy if exists "Anyone can send a message" on public.messages;
create policy "Anyone can send a message" on public.messages for insert to anon, authenticated with check (handled = false);
drop policy if exists "Admins read messages" on public.messages;
create policy "Admins read messages" on public.messages for select using (public.is_admin());
drop policy if exists "Admins update messages" on public.messages;
create policy "Admins update messages" on public.messages for update using (public.is_admin());
drop policy if exists "Admins delete messages" on public.messages;
create policy "Admins delete messages" on public.messages for delete using (public.is_admin());

-- Community collections: public member names, saving other people's collections, staff picks,
-- hiding and reports. Run after member-collections.sql. Safe to run more than once.

-- 1. Public names. A member picks a handle (like @leo) to show on their collections and get a page.
alter table public.profiles add column if not exists handle text;
do $$ begin
  alter table public.profiles add constraint profiles_handle_format check (handle ~ '^[a-z0-9_]{3,24}$');
exception when duplicate_object then null; end $$;
create unique index if not exists profiles_handle_key on public.profiles (handle);

-- Only names and handles are public, through this view; emails and admin flags stay private.
create or replace view public.member_profiles as
  select id, handle, display_name from public.profiles where handle is not null;
grant select on public.member_profiles to anon, authenticated;

-- 2. Collections can be hidden by an admin, or picked by staff. Members can't set either.
alter table public.lists add column if not exists hidden boolean not null default false;
alter table public.lists add column if not exists staff_pick boolean not null default false;

create or replace function public.guard_list_flags()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then
    if tg_op = 'INSERT' then
      new.hidden := false;
      new.staff_pick := false;
    else
      new.hidden := old.hidden;
      new.staff_pick := old.staff_pick;
    end if;
  end if;
  return new;
end $$;
drop trigger if exists guard_list_flags on public.lists;
create trigger guard_list_flags before insert or update on public.lists for each row execute function public.guard_list_flags();

-- Hidden collections disappear for everyone but their owner and admins.
drop policy if exists "read lists" on public.lists;
create policy "read lists" on public.lists for select
  using ((is_public and not hidden) or user_id = auth.uid() or public.is_admin());
drop policy if exists "admins manage lists" on public.lists;
create policy "admins manage lists" on public.lists for update using (public.is_admin());

drop policy if exists "read list films" on public.list_films;
create policy "read list films" on public.list_films for select using (
  exists (select 1 from public.lists l where l.id = list_films.list_id
          and ((l.is_public and not l.hidden) or l.user_id = auth.uid() or public.is_admin()))
);

-- 3. Saving someone's collection. Saves are private; only the counts are public.
create table if not exists public.list_saves (
  list_id uuid not null references public.lists (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  created_at timestamptz not null default now(),
  primary key (list_id, user_id)
);
alter table public.list_saves enable row level security;
drop policy if exists "own saves" on public.list_saves;
create policy "own saves" on public.list_saves for all using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "admins read saves" on public.list_saves;
create policy "admins read saves" on public.list_saves for select using (public.is_admin());

create or replace view public.list_save_counts as
  select list_id, count(*)::int as saves from public.list_saves group by list_id;
grant select on public.list_save_counts to anon, authenticated;

-- 4. Reports. Anyone can flag a collection; only admins read them.
create table if not exists public.list_reports (
  id uuid primary key default gen_random_uuid(),
  list_id uuid not null references public.lists (id) on delete cascade,
  user_id uuid references auth.users (id) on delete set null default auth.uid(),
  reason text not null check (length(reason) between 1 and 500),
  resolved boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.list_reports enable row level security;
drop policy if exists "anyone reports" on public.list_reports;
create policy "anyone reports" on public.list_reports for insert to anon, authenticated with check (resolved = false);
drop policy if exists "admins manage reports" on public.list_reports;
create policy "admins manage reports" on public.list_reports for all using (public.is_admin());


-- Security and performance hardening (November 2026).
-- Safe to run more than once.

-- 1. Trigger and event-trigger functions should never be callable through the API.
revoke execute on function public.guard_list_flags() from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;

-- 2. Replace the two security-definer views with small tables kept in sync by triggers.
--    They hold only what is meant to be public: a member's id, handle and name, and save counts.
drop view if exists public.member_profiles;
drop view if exists public.list_save_counts;

create table if not exists public.member_profiles (
  id uuid primary key references public.profiles(id) on delete cascade,
  handle text not null unique,
  display_name text
);
alter table public.member_profiles enable row level security;
drop policy if exists "read member profiles" on public.member_profiles;
create policy "read member profiles" on public.member_profiles for select to anon, authenticated using (true);

create table if not exists public.list_save_counts (
  list_id uuid primary key references public.lists(id) on delete cascade,
  saves integer not null default 0
);
alter table public.list_save_counts enable row level security;
drop policy if exists "read save counts" on public.list_save_counts;
create policy "read save counts" on public.list_save_counts for select to anon, authenticated using (true);

create or replace function public.sync_member_profile() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.handle is null then
    delete from public.member_profiles where id = new.id;
  else
    insert into public.member_profiles (id, handle, display_name) values (new.id, new.handle, new.display_name)
    on conflict (id) do update set handle = excluded.handle, display_name = excluded.display_name;
  end if;
  return new;
end $$;
revoke execute on function public.sync_member_profile() from public, anon, authenticated;
drop trigger if exists sync_member_profile on public.profiles;
create trigger sync_member_profile after insert or update of handle, display_name on public.profiles
  for each row execute function public.sync_member_profile();

create or replace function public.sync_save_count() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    insert into public.list_save_counts (list_id, saves) values (new.list_id, 1)
    on conflict (list_id) do update set saves = public.list_save_counts.saves + 1;
  else
    update public.list_save_counts set saves = greatest(saves - 1, 0) where list_id = old.list_id;
  end if;
  return null;
end $$;
revoke execute on function public.sync_save_count() from public, anon, authenticated;
drop trigger if exists sync_save_count on public.list_saves;
create trigger sync_save_count after insert or delete on public.list_saves
  for each row execute function public.sync_save_count();

-- Backfill.
insert into public.member_profiles (id, handle, display_name)
  select id, handle, display_name from public.profiles where handle is not null
  on conflict (id) do update set handle = excluded.handle, display_name = excluded.display_name;
insert into public.list_save_counts (list_id, saves)
  select list_id, count(*)::int from public.list_saves group by list_id
  on conflict (list_id) do update set saves = excluded.saves;

-- 3. Limits on member-written profile fields, and handles that look official.
update public.profiles set display_name = left(display_name, 60) where char_length(display_name) > 60;
alter table public.profiles drop constraint if exists profiles_display_name_length;
alter table public.profiles add constraint profiles_display_name_length check (char_length(display_name) <= 60);
alter table public.profiles drop constraint if exists profiles_handle_reserved;
alter table public.profiles add constraint profiles_handle_reserved check (handle not in (
  'admin','administrator','pheelm','staff','team','support','help','official','moderator','mod',
  'root','system','security','press','contact','about','account','login','logout','signin','signup',
  'settings','me','api','auth','www','mail','directors','films','collections','journal','submit'
));

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, left(coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)), 60))
  on conflict (id) do nothing;
  return new;
end $$;
revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- 4. Indexes for foreign keys.
create index if not exists collection_films_film_id_idx on public.collection_films (film_id);
create index if not exists follows_person_id_idx on public.follows (person_id);
create index if not exists list_films_film_id_idx on public.list_films (film_id);
create index if not exists list_reports_list_id_idx on public.list_reports (list_id);
create index if not exists list_reports_user_id_idx on public.list_reports (user_id);
create index if not exists list_saves_user_id_idx on public.list_saves (user_id);
create index if not exists submissions_film_id_idx on public.submissions (film_id);
create index if not exists submissions_user_id_idx on public.submissions (user_id);
create index if not exists watchlist_film_id_idx on public.watchlist (film_id);

-- 5. Policies: one policy per action, and auth.uid() / is_admin() evaluated once per query.

-- Catalog tables: everyone reads, admins write.
do $$
declare t text;
begin
  foreach t in array array['collection_films','collections','credits','people'] loop
    execute format('drop policy if exists "admin %s" on public.%I', replace(t, '_', ' '), t);
    execute format('drop policy if exists "read %s" on public.%I', replace(t, '_', ' '), t);
    execute format('drop policy if exists "read" on public.%I', t);
    execute format('drop policy if exists "admin insert" on public.%I', t);
    execute format('drop policy if exists "admin update" on public.%I', t);
    execute format('drop policy if exists "admin delete" on public.%I', t);
    execute format('create policy "read" on public.%I for select to anon, authenticated using (true)', t);
    execute format('create policy "admin insert" on public.%I for insert to authenticated with check ((select public.is_admin()))', t);
    execute format('create policy "admin update" on public.%I for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()))', t);
    execute format('create policy "admin delete" on public.%I for delete to authenticated using ((select public.is_admin()))', t);
  end loop;
  foreach t in array array['articles','films'] loop
    execute format('drop policy if exists "admin %s" on public.%I', t, t);
    execute format('drop policy if exists "read %s" on public.%I', t, t);
    execute format('drop policy if exists "read" on public.%I', t);
    execute format('drop policy if exists "admin insert" on public.%I', t);
    execute format('drop policy if exists "admin update" on public.%I', t);
    execute format('drop policy if exists "admin delete" on public.%I', t);
    execute format($p$create policy "read" on public.%I for select to anon, authenticated using (status = 'published' or (select public.is_admin()))$p$, t);
    execute format('create policy "admin insert" on public.%I for insert to authenticated with check ((select public.is_admin()))', t);
    execute format('create policy "admin update" on public.%I for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()))', t);
    execute format('create policy "admin delete" on public.%I for delete to authenticated using ((select public.is_admin()))', t);
  end loop;
end $$;

-- Follows and watchlist: each member's own rows only.
drop policy if exists "own follows" on public.follows;
create policy "own follows" on public.follows for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
drop policy if exists "own watchlist" on public.watchlist;
create policy "own watchlist" on public.watchlist for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- Lists.
drop policy if exists "read lists" on public.lists;
drop policy if exists "own lists" on public.lists;
drop policy if exists "admins manage lists" on public.lists;
drop policy if exists "insert own lists" on public.lists;
drop policy if exists "update lists" on public.lists;
drop policy if exists "delete own lists" on public.lists;
create policy "read lists" on public.lists for select to anon, authenticated
  using ((is_public and not hidden) or user_id = (select auth.uid()) or (select public.is_admin()));
create policy "insert own lists" on public.lists for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "update lists" on public.lists for update to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()))
  with check (user_id = (select auth.uid()) or (select public.is_admin()));
create policy "delete own lists" on public.lists for delete to authenticated
  using (user_id = (select auth.uid()));

-- Films in lists.
drop policy if exists "read list films" on public.list_films;
drop policy if exists "own list films" on public.list_films;
drop policy if exists "insert own list films" on public.list_films;
drop policy if exists "update own list films" on public.list_films;
drop policy if exists "delete own list films" on public.list_films;
create policy "read list films" on public.list_films for select to anon, authenticated
  using (exists (select 1 from public.lists l where l.id = list_id
    and ((l.is_public and not l.hidden) or l.user_id = (select auth.uid()) or (select public.is_admin()))));
create policy "insert own list films" on public.list_films for insert to authenticated
  with check (exists (select 1 from public.lists l where l.id = list_id and l.user_id = (select auth.uid())));
create policy "update own list films" on public.list_films for update to authenticated
  using (exists (select 1 from public.lists l where l.id = list_id and l.user_id = (select auth.uid())))
  with check (exists (select 1 from public.lists l where l.id = list_id and l.user_id = (select auth.uid())));
create policy "delete own list films" on public.list_films for delete to authenticated
  using (exists (select 1 from public.lists l where l.id = list_id and l.user_id = (select auth.uid())));

-- Saves: only public, visible collections can be saved.
drop policy if exists "own saves" on public.list_saves;
drop policy if exists "admins read saves" on public.list_saves;
drop policy if exists "read saves" on public.list_saves;
drop policy if exists "save public lists" on public.list_saves;
drop policy if exists "remove own saves" on public.list_saves;
create policy "read saves" on public.list_saves for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));
create policy "save public lists" on public.list_saves for insert to authenticated
  with check (user_id = (select auth.uid())
    and exists (select 1 from public.lists l where l.id = list_id and l.is_public and not l.hidden));
create policy "remove own saves" on public.list_saves for delete to authenticated
  using (user_id = (select auth.uid()));

-- Reports: anyone files one, admins handle them.
drop policy if exists "admins manage reports" on public.list_reports;
drop policy if exists "anyone reports" on public.list_reports;
drop policy if exists "admins read reports" on public.list_reports;
drop policy if exists "admins update reports" on public.list_reports;
drop policy if exists "admins delete reports" on public.list_reports;
create policy "anyone reports" on public.list_reports for insert to anon, authenticated
  with check (resolved = false
    and exists (select 1 from public.lists l where l.id = list_id and l.is_public));
create policy "admins read reports" on public.list_reports for select to authenticated using ((select public.is_admin()));
create policy "admins update reports" on public.list_reports for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "admins delete reports" on public.list_reports for delete to authenticated using ((select public.is_admin()));

-- Messages and subscribers: admin side.
drop policy if exists "Admins read messages" on public.messages;
drop policy if exists "Admins update messages" on public.messages;
drop policy if exists "Admins delete messages" on public.messages;
create policy "Admins read messages" on public.messages for select to authenticated using ((select public.is_admin()));
create policy "Admins update messages" on public.messages for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "Admins delete messages" on public.messages for delete to authenticated using ((select public.is_admin()));
drop policy if exists "Admins read subscribers" on public.subscribers;
drop policy if exists "Admins remove subscribers" on public.subscribers;
create policy "Admins read subscribers" on public.subscribers for select to authenticated using ((select public.is_admin()));
create policy "Admins remove subscribers" on public.subscribers for delete to authenticated using ((select public.is_admin()));

-- Profiles.
drop policy if exists "read own profile" on public.profiles;
drop policy if exists "update own profile" on public.profiles;
create policy "read own profile" on public.profiles for select to authenticated
  using (id = (select auth.uid()) or (select public.is_admin()));
-- is_admin() reads the caller's current status without going through RLS, so members can't
-- change their own admin flag (a subquery on profiles here would recurse).
create policy "update own profile" on public.profiles for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()) and is_admin = (select public.is_admin()));

-- Submissions.
drop policy if exists "add submission" on public.submissions;
drop policy if exists "read submissions" on public.submissions;
drop policy if exists "review submissions" on public.submissions;
drop policy if exists "delete submissions" on public.submissions;
create policy "add submission" on public.submissions for insert to authenticated
  with check (user_id = (select auth.uid()) and status = 'pending' and reviewed_at is null and film_id is null);
create policy "read submissions" on public.submissions for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));
create policy "review submissions" on public.submissions for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "delete submissions" on public.submissions for delete to authenticated
  using ((select public.is_admin()));


-- Profile pages: a private setting, a country and a short bio.
-- Run after hardening.sql. Safe to run more than once.

alter table public.profiles add column if not exists is_private boolean not null default false;
alter table public.member_profiles add column if not exists is_private boolean not null default false;
alter table public.profiles add column if not exists country text;
alter table public.member_profiles add column if not exists country text;
alter table public.profiles drop constraint if exists profiles_country_code;
alter table public.profiles add constraint profiles_country_code check (country ~ '^[A-Z]{2}$');
alter table public.profiles add column if not exists bio text;
alter table public.member_profiles add column if not exists bio text;
alter table public.profiles drop constraint if exists profiles_bio_length;
alter table public.profiles add constraint profiles_bio_length check (char_length(bio) <= 300);

create or replace function public.sync_member_profile() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.handle is null then
    delete from public.member_profiles where id = new.id;
  else
    insert into public.member_profiles (id, handle, display_name, is_private, country, bio)
    values (new.id, new.handle, new.display_name, new.is_private, new.country, new.bio)
    on conflict (id) do update set handle = excluded.handle, display_name = excluded.display_name,
      is_private = excluded.is_private, country = excluded.country, bio = excluded.bio;
  end if;
  return new;
end $$;
revoke execute on function public.sync_member_profile() from public, anon, authenticated;
drop trigger if exists sync_member_profile on public.profiles;
create trigger sync_member_profile after insert or update of handle, display_name, is_private, country, bio on public.profiles
  for each row execute function public.sync_member_profile();

update public.member_profiles m set is_private = p.is_private, country = p.country, bio = p.bio from public.profiles p where p.id = m.id;


-- Comments on members' public collections, with one level of replies and likes.
-- Run after profiles-private.sql. Safe to run more than once.
--
-- Who can do what:
--   read     anyone who can see the collection
--   comment  signed-in members with a profile (handle), on public, visible collections
--   edit     your own comments
--   delete   your own, any on your collection (the curator moderates), or an admin
--   like     signed-in members, once per comment

create table if not exists public.list_comments (
  id uuid primary key default gen_random_uuid(),
  list_id uuid not null references public.lists(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  parent_id uuid references public.list_comments(id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 1000),
  created_at timestamptz not null default now(),
  edited_at timestamptz
);
create index if not exists list_comments_list_idx on public.list_comments (list_id, created_at);
create index if not exists list_comments_user_idx on public.list_comments (user_id);
create index if not exists list_comments_parent_idx on public.list_comments (parent_id);
alter table public.list_comments enable row level security;

create table if not exists public.comment_likes (
  comment_id uuid not null references public.list_comments(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (comment_id, user_id)
);
create index if not exists comment_likes_user_idx on public.comment_likes (user_id);
alter table public.comment_likes enable row level security;

drop policy if exists "read comments" on public.list_comments;
drop policy if exists "post comments" on public.list_comments;
drop policy if exists "edit own comments" on public.list_comments;
drop policy if exists "delete comments" on public.list_comments;

-- The lists table's own rules decide who can see the collection, so they decide the comments too.
create policy "read comments" on public.list_comments for select to anon, authenticated
  using (exists (select 1 from public.lists l where l.id = list_id));
create policy "post comments" on public.list_comments for insert to authenticated
  with check (user_id = (select auth.uid())
    and exists (select 1 from public.lists l where l.id = list_id and l.is_public and not l.hidden)
    and exists (select 1 from public.member_profiles m where m.id = (select auth.uid())));
create policy "edit own comments" on public.list_comments for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "delete comments" on public.list_comments for delete to authenticated
  using (user_id = (select auth.uid())
    or (select public.is_admin())
    or exists (select 1 from public.lists l where l.id = list_id and l.user_id = (select auth.uid())));

drop policy if exists "read likes" on public.comment_likes;
drop policy if exists "like" on public.comment_likes;
drop policy if exists "unlike" on public.comment_likes;
create policy "read likes" on public.comment_likes for select to anon, authenticated
  using (exists (select 1 from public.list_comments c where c.id = comment_id));
create policy "like" on public.comment_likes for insert to authenticated
  with check (user_id = (select auth.uid()) and exists (select 1 from public.list_comments c where c.id = comment_id));
create policy "unlike" on public.comment_likes for delete to authenticated
  using (user_id = (select auth.uid()));

-- Replies stay one level deep and on the same collection; edits only touch the text; and a
-- member can post at most 6 comments a minute.
create or replace function public.guard_comment() returns trigger
language plpgsql security definer set search_path = public as $$
declare p public.list_comments;
begin
  if tg_op = 'INSERT' then
    if new.parent_id is not null then
      select * into p from public.list_comments where id = new.parent_id;
      if p.id is null or p.list_id <> new.list_id then
        raise exception 'Reply to a comment on this collection.' using errcode = 'check_violation';
      end if;
      if p.parent_id is not null then new.parent_id := p.parent_id; end if;
    end if;
    if (select count(*) from public.list_comments
        where user_id = new.user_id and created_at > now() - interval '1 minute') >= 6 then
      raise exception 'You''re commenting very fast. Wait a minute and try again.' using errcode = 'check_violation';
    end if;
    new.body := btrim(new.body);
    new.created_at := now();
    new.edited_at := null;
  else
    new.id := old.id; new.list_id := old.list_id; new.user_id := old.user_id;
    new.parent_id := old.parent_id; new.created_at := old.created_at;
    new.body := btrim(new.body);
    if new.body is distinct from old.body then new.edited_at := now(); else new.edited_at := old.edited_at; end if;
  end if;
  return new;
end $$;
revoke execute on function public.guard_comment() from public, anon, authenticated;
drop trigger if exists guard_comment on public.list_comments;
create trigger guard_comment before insert or update on public.list_comments
  for each row execute function public.guard_comment();


-- Collaboration on collections, notifications, and comment moderation.
-- Run after comments.sql. Safe to run more than once.
--
-- Roles on a collection:
--   owner         everything: privacy, delete, people, pin, turn comments off
--   collaborator  add and remove films, edit title and description, remove comments, leave
-- People join by invite (owner -> member accepts) or request (member asks -> owner approves).
-- Membership changes go through the functions below, which check who may do what and send
-- the notifications; nobody writes to list_members directly.

-- Tagging is replaced by collaboration.
drop table if exists public.list_tags cascade;
drop function if exists public.limit_list_tags();

-- Members ---------------------------------------------------------------------------------------

create table if not exists public.list_members (
  list_id uuid not null references public.lists(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  status text not null check (status in ('invited', 'requested', 'active', 'declined')),
  note text check (char_length(note) <= 280),
  invited_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  primary key (list_id, user_id)
);
create index if not exists list_members_user_idx on public.list_members (user_id, status);
create index if not exists list_members_invited_by_idx on public.list_members (invited_by);
alter table public.list_members enable row level security;

-- Helpers that read memberships without going through RLS (the lists and list_members rules
-- refer to each other, and would otherwise loop).
create or replace function public.is_list_owner(lid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.lists where id = lid and user_id = auth.uid());
$$;
create or replace function public.is_list_collaborator(lid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.list_members where list_id = lid and user_id = auth.uid() and status = 'active');
$$;
create or replace function public.can_edit_list(lid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_list_owner(lid) or public.is_list_collaborator(lid);
$$;

drop policy if exists "read members" on public.list_members;
create policy "read members" on public.list_members for select to anon, authenticated
  using (user_id = (select auth.uid())
    or (select public.is_admin())
    or public.is_list_owner(list_id)
    or (status = 'active' and exists (select 1 from public.lists l where l.id = list_id)));

-- Collections: collaborators can see and edit them --------------------------------------------

alter table public.lists add column if not exists comments_enabled boolean not null default true;
alter table public.lists add column if not exists pinned_comment_id uuid references public.list_comments(id) on delete set null;
create index if not exists lists_pinned_comment_idx on public.lists (pinned_comment_id);

drop policy if exists "read lists" on public.lists;
create policy "read lists" on public.lists for select to anon, authenticated
  using ((is_public and not hidden) or user_id = (select auth.uid()) or (select public.is_admin()) or public.is_list_collaborator(id));
drop policy if exists "update lists" on public.lists;
create policy "update lists" on public.lists for update to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()) or public.is_list_collaborator(id))
  with check (user_id = (select auth.uid()) or (select public.is_admin()) or public.is_list_collaborator(id));

-- Collaborators change the words only; the owner can't hand the collection to someone else.
create or replace function public.guard_list_owner_fields() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if public.is_admin() then return new; end if;
  new.user_id := old.user_id;
  if old.user_id is distinct from auth.uid() then
    new.is_public := old.is_public;
    new.comments_enabled := old.comments_enabled;
    -- Anyone who can remove a comment may clear the pin it held; only the owner pins.
    if new.pinned_comment_id is not null then new.pinned_comment_id := old.pinned_comment_id; end if;
  end if;
  if new.pinned_comment_id is not null and new.pinned_comment_id is distinct from old.pinned_comment_id
     and not exists (select 1 from public.list_comments where id = new.pinned_comment_id and list_id = new.id and parent_id is null) then
    raise exception 'Pin a comment from this collection.' using errcode = 'check_violation';
  end if;
  return new;
end $$;
revoke execute on function public.guard_list_owner_fields() from public, anon, authenticated;
drop trigger if exists guard_list_owner_fields on public.lists;
create trigger guard_list_owner_fields before update on public.lists
  for each row execute function public.guard_list_owner_fields();

-- Films in a collection: who added each one, and collaborators can add and remove.
alter table public.list_films add column if not exists added_by uuid references public.profiles(id) on delete set null default auth.uid();
create index if not exists list_films_added_by_idx on public.list_films (added_by);
update public.list_films lf set added_by = l.user_id from public.lists l where l.id = lf.list_id and lf.added_by is null;

drop policy if exists "read list films" on public.list_films;
drop policy if exists "insert own list films" on public.list_films;
drop policy if exists "update own list films" on public.list_films;
drop policy if exists "delete own list films" on public.list_films;
create policy "read list films" on public.list_films for select to anon, authenticated
  using (exists (select 1 from public.lists l where l.id = list_id));
create policy "insert own list films" on public.list_films for insert to authenticated
  with check (public.can_edit_list(list_id) and added_by = (select auth.uid()));
create policy "update own list films" on public.list_films for update to authenticated
  using (public.can_edit_list(list_id)) with check (public.can_edit_list(list_id));
create policy "delete own list films" on public.list_films for delete to authenticated
  using (public.can_edit_list(list_id));

-- Notifications ---------------------------------------------------------------------------------

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete cascade,
  type text not null check (type in ('invite', 'request', 'invite_accepted', 'invite_declined',
    'request_accepted', 'request_declined', 'removed', 'comment', 'reply', 'mention')),
  list_id uuid references public.lists(id) on delete cascade,
  comment_id uuid references public.list_comments(id) on delete cascade,
  created_at timestamptz not null default now(),
  read_at timestamptz
);
create index if not exists notifications_user_idx on public.notifications (user_id, created_at desc);
create index if not exists notifications_actor_idx on public.notifications (actor_id);
create index if not exists notifications_list_idx on public.notifications (list_id);
create index if not exists notifications_comment_idx on public.notifications (comment_id);
alter table public.notifications enable row level security;

drop policy if exists "read own notifications" on public.notifications;
drop policy if exists "mark own notifications" on public.notifications;
drop policy if exists "clear own notifications" on public.notifications;
create policy "read own notifications" on public.notifications for select to authenticated
  using (user_id = (select auth.uid()));
create policy "mark own notifications" on public.notifications for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "clear own notifications" on public.notifications for delete to authenticated
  using (user_id = (select auth.uid()));

create or replace function public.notify(recipient uuid, kind text, actor uuid, lid uuid, cid uuid default null) returns void
language plpgsql security definer set search_path = public as $$
begin
  if recipient is null or recipient = actor then return; end if;
  insert into public.notifications (user_id, actor_id, type, list_id, comment_id) values (recipient, actor, kind, lid, cid);
end $$;
revoke execute on function public.notify(uuid, text, uuid, uuid, uuid) from public, anon, authenticated;

-- Membership actions ---------------------------------------------------------------------------

-- The owner invites a member with a public profile, by handle. Up to 10 people per collection.
create or replace function public.invite_collaborator(lid uuid, who text) returns text
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); target uuid; cur text;
begin
  if not exists (select 1 from public.lists where id = lid and user_id = me) then
    raise exception 'Only the owner can invite people.' using errcode = 'insufficient_privilege';
  end if;
  select id into target from public.member_profiles where handle = lower(ltrim(btrim(who), '@')) and not is_private;
  if target is null then raise exception 'There''s no public profile with that handle.' using errcode = 'no_data_found'; end if;
  if target = me then raise exception 'That''s you.' using errcode = 'check_violation'; end if;
  select status into cur from public.list_members where list_id = lid and user_id = target;
  if cur = 'active' then raise exception 'They already collaborate on this collection.' using errcode = 'unique_violation'; end if;
  if cur = 'invited' then raise exception 'They''re already invited.' using errcode = 'unique_violation'; end if;
  if cur = 'requested' then
    -- They asked already: inviting them is the same as approving.
    update public.list_members set status = 'active', responded_at = now(), invited_by = me where list_id = lid and user_id = target;
    perform public.notify(target, 'request_accepted', me, lid);
    return 'active';
  end if;
  if (select count(*) from public.list_members where list_id = lid and status in ('active', 'invited')) >= 10 then
    raise exception 'A collection can have up to 10 collaborators.' using errcode = 'check_violation';
  end if;
  insert into public.list_members (list_id, user_id, status, invited_by, created_at, responded_at, note)
  values (lid, target, 'invited', me, now(), null, null)
  on conflict (list_id, user_id) do update set status = 'invited', invited_by = me, created_at = now(), responded_at = null, note = null;
  perform public.notify(target, 'invite', me, lid);
  return 'invited';
end $$;

-- A member with a profile asks to collaborate on a public collection. One request at a time,
-- and not again for 30 days after a decline.
create or replace function public.request_collaboration(lid uuid, message text default null) returns text
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); owner uuid; cur public.list_members;
begin
  select user_id into owner from public.lists where id = lid and is_public and not hidden;
  if owner is null then raise exception 'You can only ask to join public collections.' using errcode = 'insufficient_privilege'; end if;
  if owner = me then raise exception 'It''s your collection.' using errcode = 'check_violation'; end if;
  if not exists (select 1 from public.member_profiles where id = me) then
    raise exception 'Create your profile first.' using errcode = 'insufficient_privilege';
  end if;
  select * into cur from public.list_members where list_id = lid and user_id = me;
  if cur.status = 'active' then raise exception 'You already collaborate on this collection.' using errcode = 'unique_violation'; end if;
  if cur.status = 'invited' then raise exception 'You''re already invited: accept the invite instead.' using errcode = 'unique_violation'; end if;
  if cur.status = 'requested' then raise exception 'Your request is waiting for an answer.' using errcode = 'unique_violation'; end if;
  if cur.status = 'declined' and cur.responded_at > now() - interval '30 days' then
    raise exception 'You can ask again 30 days after a request is declined.' using errcode = 'check_violation';
  end if;
  insert into public.list_members (list_id, user_id, status, note, created_at, responded_at, invited_by)
  values (lid, me, 'requested', nullif(left(btrim(message), 280), ''), now(), null, null)
  on conflict (list_id, user_id) do update set status = 'requested', note = excluded.note, created_at = now(), responded_at = null, invited_by = null;
  perform public.notify(owner, 'request', me, lid);
  return 'requested';
end $$;

-- The invited member accepts or declines.
create or replace function public.respond_to_invite(lid uuid, accept boolean) returns text
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); m public.list_members;
begin
  select * into m from public.list_members where list_id = lid and user_id = me and status = 'invited';
  if m.list_id is null then raise exception 'This invite is no longer open.' using errcode = 'no_data_found'; end if;
  update public.list_members set status = case when accept then 'active' else 'declined' end, responded_at = now()
  where list_id = lid and user_id = me;
  perform public.notify(coalesce(m.invited_by, (select user_id from public.lists where id = lid)),
    case when accept then 'invite_accepted' else 'invite_declined' end, me, lid);
  update public.notifications set read_at = now() where user_id = me and list_id = lid and type = 'invite' and read_at is null;
  return case when accept then 'active' else 'declined' end;
end $$;

-- The owner approves or declines a request.
create or replace function public.respond_to_request(lid uuid, who uuid, accept boolean) returns text
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid();
begin
  if not exists (select 1 from public.lists where id = lid and user_id = me) then
    raise exception 'Only the owner can answer requests.' using errcode = 'insufficient_privilege';
  end if;
  if not exists (select 1 from public.list_members where list_id = lid and user_id = who and status = 'requested') then
    raise exception 'This request is no longer open.' using errcode = 'no_data_found';
  end if;
  if accept and (select count(*) from public.list_members where list_id = lid and status in ('active', 'invited')) >= 10 then
    raise exception 'A collection can have up to 10 collaborators.' using errcode = 'check_violation';
  end if;
  update public.list_members set status = case when accept then 'active' else 'declined' end, responded_at = now(), invited_by = me
  where list_id = lid and user_id = who;
  perform public.notify(who, case when accept then 'request_accepted' else 'request_declined' end, me, lid);
  update public.notifications set read_at = now() where user_id = me and list_id = lid and actor_id = who and type = 'request' and read_at is null;
  return case when accept then 'active' else 'declined' end;
end $$;

-- The owner removes someone (or cancels an invite); anyone can leave or withdraw their request.
-- Films they added stay.
create or replace function public.remove_collaborator(lid uuid, who uuid default null) returns void
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); target uuid := coalesce(who, auth.uid()); was text; owner uuid;
begin
  select user_id into owner from public.lists where id = lid;
  if target <> me and owner is distinct from me then
    raise exception 'Only the owner can remove people.' using errcode = 'insufficient_privilege';
  end if;
  select status into was from public.list_members where list_id = lid and user_id = target;
  delete from public.list_members where list_id = lid and user_id = target and status <> 'declined';
  delete from public.notifications where list_id = lid and type in ('invite', 'request') and read_at is null
    and ((user_id = target and actor_id = owner) or (user_id = owner and actor_id = target));
  if target <> me and was = 'active' then perform public.notify(target, 'removed', me, lid); end if;
end $$;

revoke execute on function public.invite_collaborator(uuid, text) from public, anon;
revoke execute on function public.request_collaboration(uuid, text) from public, anon;
revoke execute on function public.respond_to_invite(uuid, boolean) from public, anon;
revoke execute on function public.respond_to_request(uuid, uuid, boolean) from public, anon;
revoke execute on function public.remove_collaborator(uuid, uuid) from public, anon;
grant execute on function public.invite_collaborator(uuid, text) to authenticated;
grant execute on function public.request_collaboration(uuid, text) to authenticated;
grant execute on function public.respond_to_invite(uuid, boolean) to authenticated;
grant execute on function public.respond_to_request(uuid, uuid, boolean) to authenticated;
grant execute on function public.remove_collaborator(uuid, uuid) to authenticated;
revoke execute on function public.is_list_owner(uuid) from public;
revoke execute on function public.is_list_collaborator(uuid) from public;
revoke execute on function public.can_edit_list(uuid) from public;
grant execute on function public.is_list_owner(uuid) to anon, authenticated;
grant execute on function public.is_list_collaborator(uuid) to anon, authenticated;
grant execute on function public.can_edit_list(uuid) to anon, authenticated;

-- Comments: moderation, removed placeholders, reports, turning comments off --------------------

alter table public.list_comments add column if not exists removed_at timestamptz;

drop policy if exists "post comments" on public.list_comments;
create policy "post comments" on public.list_comments for insert to authenticated
  with check (user_id = (select auth.uid())
    and exists (select 1 from public.lists l where l.id = list_id and l.is_public and not l.hidden and l.comments_enabled)
    and exists (select 1 from public.member_profiles m where m.id = (select auth.uid())));
drop policy if exists "edit own comments" on public.list_comments;
create policy "edit own comments" on public.list_comments for update to authenticated
  using (user_id = (select auth.uid()) and removed_at is null) with check (user_id = (select auth.uid()));
drop policy if exists "delete comments" on public.list_comments;
create policy "delete comments" on public.list_comments for delete to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()) or public.can_edit_list(list_id));

-- Removing a comment: if it has replies it stays as "Comment removed" so the thread still reads;
-- otherwise it's deleted. Its author, the owner, collaborators and admins can remove it.
create or replace function public.remove_comment(cid uuid) returns text
language plpgsql security definer set search_path = public as $$
declare c public.list_comments;
begin
  select * into c from public.list_comments where id = cid;
  if c.id is null then return 'gone'; end if;
  if not (c.user_id = auth.uid() or public.is_admin()
          or exists (select 1 from public.lists where id = c.list_id and user_id = auth.uid())
          or exists (select 1 from public.list_members where list_id = c.list_id and user_id = auth.uid() and status = 'active')) then
    raise exception 'You can''t remove this comment.' using errcode = 'insufficient_privilege';
  end if;
  if c.parent_id is null and exists (select 1 from public.list_comments where parent_id = cid) then
    update public.list_comments set removed_at = now(), body = 'removed' where id = cid;
    delete from public.comment_likes where comment_id = cid;
    update public.lists set pinned_comment_id = null where pinned_comment_id = cid;
    return 'removed';
  end if;
  delete from public.list_comments where id = cid;
  return 'deleted';
end $$;
revoke execute on function public.remove_comment(uuid) from public, anon;
grant execute on function public.remove_comment(uuid) to authenticated;

-- Updates by the system (remove_comment) shouldn't count as edits.
create or replace function public.guard_comment() returns trigger
language plpgsql security definer set search_path = public as $$
declare p public.list_comments;
begin
  if tg_op = 'INSERT' then
    if new.parent_id is not null then
      select * into p from public.list_comments where id = new.parent_id;
      if p.id is null or p.list_id <> new.list_id or p.removed_at is not null then
        raise exception 'Reply to a comment on this collection.' using errcode = 'check_violation';
      end if;
      if p.parent_id is not null then new.parent_id := p.parent_id; end if;
    end if;
    if (select count(*) from public.list_comments
        where user_id = new.user_id and created_at > now() - interval '1 minute') >= 6 then
      raise exception 'You''re commenting very fast. Wait a minute and try again.' using errcode = 'check_violation';
    end if;
    new.body := btrim(new.body);
    new.created_at := now();
    new.edited_at := null;
    new.removed_at := null;
  else
    new.id := old.id; new.list_id := old.list_id; new.user_id := old.user_id;
    new.parent_id := old.parent_id; new.created_at := old.created_at;
    new.body := btrim(new.body);
    if new.removed_at is null then new.removed_at := old.removed_at; end if;
    if new.removed_at is null and new.body is distinct from old.body then new.edited_at := now(); else new.edited_at := old.edited_at; end if;
  end if;
  return new;
end $$;
revoke execute on function public.guard_comment() from public, anon, authenticated;

-- New comments notify: the person replied to, anyone @mentioned, then the owner and
-- collaborators. One notification per person per comment.
create or replace function public.notify_comment() returns trigger
language plpgsql security definer set search_path = public as $$
declare told uuid[] := array[new.user_id]; r uuid; parent_author uuid;
begin
  if new.parent_id is not null then
    select user_id into parent_author from public.list_comments where id = new.parent_id;
    if parent_author is not null and not parent_author = any(told) then
      perform public.notify(parent_author, 'reply', new.user_id, new.list_id, new.id);
      told := told || parent_author;
    end if;
  end if;
  for r in
    select distinct m.id from public.member_profiles m
    where m.handle in (select lower(rm.x[1]) from regexp_matches(new.body, '@([A-Za-z0-9_]{3,24})', 'g') as rm(x))
    limit 10
  loop
    if not r = any(told) then
      perform public.notify(r, 'mention', new.user_id, new.list_id, new.id);
      told := told || r;
    end if;
  end loop;
  for r in
    select user_id from public.lists where id = new.list_id
    union select user_id from public.list_members where list_id = new.list_id and status = 'active'
  loop
    if not r = any(told) then
      perform public.notify(r, 'comment', new.user_id, new.list_id, new.id);
      told := told || r;
    end if;
  end loop;
  return null;
end $$;
revoke execute on function public.notify_comment() from public, anon, authenticated;
drop trigger if exists notify_comment on public.list_comments;
create trigger notify_comment after insert on public.list_comments
  for each row execute function public.notify_comment();

create table if not exists public.comment_reports (
  id uuid primary key default gen_random_uuid(),
  comment_id uuid not null references public.list_comments(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete set null default auth.uid(),
  reason text check (char_length(reason) <= 500),
  resolved boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists comment_reports_comment_idx on public.comment_reports (comment_id);
create index if not exists comment_reports_user_idx on public.comment_reports (user_id);
alter table public.comment_reports enable row level security;
drop policy if exists "report comments" on public.comment_reports;
drop policy if exists "admins read comment reports" on public.comment_reports;
drop policy if exists "admins update comment reports" on public.comment_reports;
drop policy if exists "admins delete comment reports" on public.comment_reports;
create policy "report comments" on public.comment_reports for insert to authenticated
  with check (resolved = false and user_id = (select auth.uid()) and exists (select 1 from public.list_comments c where c.id = comment_id));
create policy "admins read comment reports" on public.comment_reports for select to authenticated using ((select public.is_admin()));
create policy "admins update comment reports" on public.comment_reports for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "admins delete comment reports" on public.comment_reports for delete to authenticated using ((select public.is_admin()));


-- Move Pheelm's own collections into @leo's collections, so every collection works the same way
-- (comments, collaboration, editing on the collection page). Run after collaboration.sql.
-- The old collections tables are left as they were, as a backup. Safe to run more than once:
-- a collection already moved (same legacy_slug) is skipped.

alter table public.lists add column if not exists legacy_slug text;
create unique index if not exists lists_legacy_slug_idx on public.lists (legacy_slug) where legacy_slug is not null;

-- Staff picks and owners are normally protected from changes; this move is done by the site.
alter table public.lists disable trigger guard_list_flags;

insert into public.lists (id, user_id, title, description, is_public, staff_pick, legacy_slug, created_at, updated_at)
select gen_random_uuid(), p.id, c.title, c.description, true, true, c.slug,
       -- Newest first in "popular" order, so the featured ones lead, then the old order.
       now() - (row_number() over (order by c.featured desc, c.sort_order, c.title)) * interval '1 minute',
       now()
from public.collections c
cross join (select id from public.profiles where handle = 'leo') p
where not exists (select 1 from public.lists l where l.legacy_slug = c.slug);

insert into public.list_films (list_id, film_id, added_at, added_by)
select l.id, cf.film_id, now() - cf.sort * interval '1 second', l.user_id
from public.collection_films cf
join public.collections c on c.id = cf.collection_id
join public.lists l on l.legacy_slug = c.slug
where not exists (select 1 from public.list_films x where x.list_id = l.id and x.film_id = cf.film_id);

alter table public.lists enable trigger guard_list_flags;

-- Following directors, with notifications. Run after collaboration.sql. Safe to run more than once.
--
-- A member follows a director (public.follows, which already exists). When a film by that
-- director is published, or a director credit is added to a published film, each follower gets
-- one "new_film" notification for it.

alter table public.notifications add column if not exists film_id uuid references public.films(id) on delete cascade;
alter table public.notifications add column if not exists person_id uuid references public.people(id) on delete cascade;
create index if not exists notifications_film_idx on public.notifications (film_id);
create index if not exists notifications_person_idx on public.notifications (person_id);

alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications add constraint notifications_type_check check (type in ('invite', 'request',
  'invite_accepted', 'invite_declined', 'request_accepted', 'request_declined', 'removed', 'comment', 'reply',
  'mention', 'new_film'));

-- Follows: each member's own rows, faster policy form.
drop policy if exists "own follows" on public.follows;
create policy "own follows" on public.follows for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- Notify followers of one film's directors, once per member and film.
create or replace function public.notify_new_film(fid uuid) returns void
language sql security definer set search_path = public as $$
  insert into public.notifications (user_id, type, film_id, person_id)
  select distinct on (fo.user_id) fo.user_id, 'new_film', fid, fo.person_id
  from public.credits c
  join public.follows fo on fo.person_id = c.person_id
  join public.profiles pr on pr.id = fo.user_id
  join public.films f on f.id = c.film_id and f.status = 'published'
  where c.film_id = fid and c.role = 'director'
    and not exists (select 1 from public.notifications n where n.user_id = fo.user_id and n.type = 'new_film' and n.film_id = fid)
  order by fo.user_id, c.sort nulls last;
$$;
revoke execute on function public.notify_new_film(uuid) from public, anon, authenticated;

create or replace function public.on_film_published() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'published' and (tg_op = 'INSERT' or old.status is distinct from 'published') then
    perform public.notify_new_film(new.id);
  end if;
  return null;
end $$;
revoke execute on function public.on_film_published() from public, anon, authenticated;
drop trigger if exists film_published_notify on public.films;
create trigger film_published_notify after insert or update of status on public.films
  for each row execute function public.on_film_published();

create or replace function public.on_director_credit() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.role = 'director' then perform public.notify_new_film(new.film_id); end if;
  return null;
end $$;
revoke execute on function public.on_director_credit() from public, anon, authenticated;
drop trigger if exists director_credit_notify on public.credits;
create trigger director_credit_notify after insert on public.credits
  for each row execute function public.on_director_credit();

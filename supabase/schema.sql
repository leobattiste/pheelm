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

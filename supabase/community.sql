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

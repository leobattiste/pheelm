-- Profile pages: a private setting, a country, and the directors a member follows shown on their profile.
-- Run after hardening.sql. Safe to run more than once.

alter table public.profiles add column if not exists is_private boolean not null default false;
alter table public.member_profiles add column if not exists is_private boolean not null default false;
alter table public.profiles add column if not exists country text;
alter table public.member_profiles add column if not exists country text;
alter table public.profiles drop constraint if exists profiles_country_code;
alter table public.profiles add constraint profiles_country_code check (country ~ '^[A-Z]{2}$');

create or replace function public.sync_member_profile() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.handle is null then
    delete from public.member_profiles where id = new.id;
  else
    insert into public.member_profiles (id, handle, display_name, is_private, country)
    values (new.id, new.handle, new.display_name, new.is_private, new.country)
    on conflict (id) do update set handle = excluded.handle, display_name = excluded.display_name,
      is_private = excluded.is_private, country = excluded.country;
  end if;
  return new;
end $$;
revoke execute on function public.sync_member_profile() from public, anon, authenticated;
drop trigger if exists sync_member_profile on public.profiles;
create trigger sync_member_profile after insert or update of handle, display_name, is_private, country on public.profiles
  for each row execute function public.sync_member_profile();

update public.member_profiles m set is_private = p.is_private, country = p.country from public.profiles p where p.id = m.id;

-- Follows: members manage their own; anyone can see who a public member follows.
drop policy if exists "own follows" on public.follows;
drop policy if exists "read follows" on public.follows;
drop policy if exists "add own follows" on public.follows;
drop policy if exists "remove own follows" on public.follows;
create policy "read follows" on public.follows for select to anon, authenticated
  using (user_id = (select auth.uid())
    or exists (select 1 from public.member_profiles m where m.id = follows.user_id and not m.is_private));
create policy "add own follows" on public.follows for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "remove own follows" on public.follows for delete to authenticated
  using (user_id = (select auth.uid()));

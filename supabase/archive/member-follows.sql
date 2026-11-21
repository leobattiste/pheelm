-- Member follows are private to the two members involved. Search can filter the viewer's
-- own following/followers without publishing another member's social graph.
-- Run after admins-watched-blocks.sql and admin-community.sql. Safe to run twice.
create table if not exists public.member_follows (
  follower_id uuid not null references public.profiles(id) on delete cascade,
  followed_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, followed_id),
  constraint member_follows_no_self check (follower_id <> followed_id)
);
create index if not exists member_follows_followed_idx on public.member_follows(followed_id);
alter table public.member_follows enable row level security;
revoke all on public.member_follows from public, anon, authenticated;
grant select, delete on public.member_follows to authenticated;
grant insert (follower_id, followed_id) on public.member_follows to authenticated;

drop policy if exists "read own member follows" on public.member_follows;
create policy "read own member follows" on public.member_follows for select to authenticated
using (((select auth.uid()) = follower_id or (select auth.uid()) = followed_id)
  and not public.is_blocked(follower_id, followed_id));

drop policy if exists "follow a public member" on public.member_follows;
create policy "follow a public member" on public.member_follows for insert to authenticated
with check (follower_id = (select auth.uid())
  and not public.is_suspended((select auth.uid()))
  and not public.is_suspended(followed_id)
  and not public.is_blocked(follower_id, followed_id)
  and exists (select 1 from public.member_profiles m where m.id = follower_id)
  and exists (select 1 from public.member_profiles m where m.id = followed_id and not m.is_private));

drop policy if exists "unfollow a member" on public.member_follows;
create policy "unfollow a member" on public.member_follows for delete to authenticated
using (follower_id = (select auth.uid()));

-- Use a separate trigger so existing watchlist/co-curation block cleanup stays intact.
create schema if not exists private;
create or replace function private.remove_blocked_member_follows() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  delete from public.member_follows
  where (follower_id = new.blocker_id and followed_id = new.blocked_id)
     or (follower_id = new.blocked_id and followed_id = new.blocker_id);
  return null;
end $$;
revoke all on function private.remove_blocked_member_follows() from public, anon, authenticated;
drop trigger if exists remove_blocked_member_follows on public.blocks;
create trigger remove_blocked_member_follows after insert on public.blocks
for each row execute function private.remove_blocked_member_follows();

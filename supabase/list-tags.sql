-- Tagging members on collections (co-curators). Run after profiles-private.sql. Safe to run again.
-- The owner of a public collection tags other members with a public profile; anyone tagged can
-- remove themselves. Tags show wherever the collection can be seen.

create table if not exists public.list_tags (
  list_id uuid not null references public.lists(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (list_id, user_id)
);
create index if not exists list_tags_user_id_idx on public.list_tags (user_id);
alter table public.list_tags enable row level security;

drop policy if exists "read tags" on public.list_tags;
drop policy if exists "owner tags" on public.list_tags;
drop policy if exists "remove tags" on public.list_tags;

create policy "read tags" on public.list_tags for select to anon, authenticated
  using (user_id = (select auth.uid())
    or (select public.is_admin())
    or exists (select 1 from public.lists l where l.id = list_id
      and ((l.is_public and not l.hidden) or l.user_id = (select auth.uid()))));

create policy "owner tags" on public.list_tags for insert to authenticated
  with check (user_id <> (select auth.uid())
    and exists (select 1 from public.lists l where l.id = list_id and l.user_id = (select auth.uid()) and l.is_public)
    and exists (select 1 from public.member_profiles m where m.id = user_id and not m.is_private));

create policy "remove tags" on public.list_tags for delete to authenticated
  using (user_id = (select auth.uid())
    or exists (select 1 from public.lists l where l.id = list_id and l.user_id = (select auth.uid())));

-- At most 10 people per collection.
create or replace function public.limit_list_tags() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from public.list_tags where list_id = new.list_id) >= 10 then
    raise exception 'A collection can tag up to 10 people.' using errcode = 'check_violation';
  end if;
  return new;
end $$;
revoke execute on function public.limit_list_tags() from public, anon, authenticated;
drop trigger if exists limit_list_tags on public.list_tags;
create trigger limit_list_tags before insert on public.list_tags
  for each row execute function public.limit_list_tags();

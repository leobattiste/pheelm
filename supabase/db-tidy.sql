-- Small performance tidy-ups from the Supabase advisor (November 2026). Safe to run twice.
create index if not exists message_replies_author_idx on public.message_replies (author_id);
create index if not exists profiles_suspended_by_idx on public.profiles (suspended_by);

-- One delete rule on watchlists instead of two: your own, or any if you're the owner.
drop policy if exists "Owner deletes watchlists" on public.lists;
drop policy if exists "delete own lists" on public.lists;
create policy "delete own lists" on public.lists for delete to authenticated
  using (user_id = (select auth.uid()) or (select public.is_owner()));

alter table pheelm_private.collaboration_requests add column if not exists id bigint generated always as identity;
do $$ begin
  if not exists (select 1 from pg_constraint where conrelid = 'pheelm_private.collaboration_requests'::regclass and contype = 'p') then
    alter table pheelm_private.collaboration_requests add primary key (id);
  end if;
end $$;

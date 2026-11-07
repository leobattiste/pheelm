-- Tidy-ups from Supabase's security and performance checks, and one duplicate director.

-- Functions only triggers use can't be called through the API.
revoke execute on function public.is_blocked(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.guard_blocked_comment() from public, anon, authenticated;
revoke execute on function public.guard_blocked_member() from public, anon, authenticated;
revoke execute on function public.skip_blocked_notification() from public, anon, authenticated;
revoke execute on function public.on_block() from public, anon, authenticated;
revoke execute on function public.notify_admins_list_report() from public, anon, authenticated;
revoke execute on function public.notify_admins_comment_report() from public, anon, authenticated;
revoke execute on function public.notify_admins_submission() from public, anon, authenticated;
revoke execute on function public.notify_admins_message() from public, anon, authenticated;
revoke execute on function public.notify_owner_new_member() from public, anon, authenticated;
revoke execute on function public.notify_featured() from public, anon, authenticated;
-- Members-only actions aren't callable signed out.
revoke execute on function public.admin_members() from anon;
revoke execute on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

-- Indexes for the new tables' lookups.
create index if not exists blocks_blocked_idx on public.blocks (blocked_id);
create index if not exists watched_film_idx on public.watched (film_id);

-- One read rule each for Watched and follows (yours, or a public profile's), instead of two.
drop policy if exists "own watched" on public.watched;
drop policy if exists "public watched" on public.watched;
create policy "read watched" on public.watched for select using (user_id = (select auth.uid()) or public.shows_watched(user_id));
create policy "add watched" on public.watched for insert with check (user_id = (select auth.uid()));
create policy "remove watched" on public.watched for delete using (user_id = (select auth.uid()));

drop policy if exists "own follows" on public.follows;
drop policy if exists "public follows" on public.follows;
create policy "read follows" on public.follows for select to anon, authenticated using (user_id = (select auth.uid()) or public.shows_following(user_id));
create policy "add follows" on public.follows for insert to authenticated with check (user_id = (select auth.uid()));
create policy "change follows" on public.follows for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "remove follows" on public.follows for delete to authenticated using (user_id = (select auth.uid()));

-- Chris Browne, the Jamaican director of Third World Cop and Ghett'a Life, was in twice.
insert into public.credits (film_id, person_id, role, character, sort)
  select c.film_id, keep.id, c.role, c.character, c.sort
  from public.credits c, public.people dup, public.people keep
  where dup.slug = 'chris-browne-1186914' and keep.slug = 'chris-browne' and c.person_id = dup.id
  on conflict do nothing;
update public.follows f set person_id = keep.id from public.people dup, public.people keep
  where dup.slug = 'chris-browne-1186914' and keep.slug = 'chris-browne' and f.person_id = dup.id
  and not exists (select 1 from public.follows x where x.user_id = f.user_id and x.person_id = keep.id);
delete from public.people where slug = 'chris-browne-1186914';

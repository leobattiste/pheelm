-- Onboarding tour: what each signed-in member has seen, so the tour doesn't come back on a new
-- phone. Signed-out visitors keep the same thing in their browser. One small row per member:
--   state = { "off": true|false, "tours": { "menu": { "shown": 2, "done": false } } }
create table if not exists public.tour_progress (
  user_id uuid primary key references auth.users(id) on delete cascade,
  state jsonb not null default '{}'::jsonb check (jsonb_typeof(state) = 'object' and pg_column_size(state) < 2000),
  updated_at timestamptz not null default now()
);
alter table public.tour_progress enable row level security;

create policy "Read own tour" on public.tour_progress as permissive for select to authenticated
  using (user_id = (select auth.uid()));
create policy "Insert own tour" on public.tour_progress as permissive for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "Update own tour" on public.tour_progress as permissive for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

revoke all on table public.tour_progress from public, anon, authenticated;
grant select, insert, update on table public.tour_progress to authenticated;
grant all on table public.tour_progress to service_role;

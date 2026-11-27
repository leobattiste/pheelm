-- The per-minute budget for the public counters (20261126202453_public_counter_budget.sql) kept one
-- row per counter per minute, so every call queued on that row's lock. It now spreads each minute
-- over 8 rows and adds them up; the limits are unchanged.
alter table pheelm_private.counter_budget add column if not exists shard smallint not null default 0;
alter table pheelm_private.counter_budget drop constraint if exists counter_budget_pkey;
alter table pheelm_private.counter_budget add constraint counter_budget_pkey primary key (name, minute, shard);

create or replace function pheelm_private.within_budget(p_name text, p_per_minute int)
returns boolean language plpgsql security definer set search_path = '' as $$
declare this_minute timestamptz := date_trunc('minute', now()); slot smallint := floor(random() * 8)::smallint; mine int; n int;
begin
  insert into pheelm_private.counter_budget as b (name, minute, shard, used) values (p_name, this_minute, slot, 1)
  on conflict (name, minute, shard) do update set used = b.used + 1
  returning used into mine;
  -- Now and then, forget minutes older than an hour.
  if mine = 1 and slot = 0 then delete from pheelm_private.counter_budget where minute < now() - interval '1 hour'; end if;
  select sum(used) into n from pheelm_private.counter_budget where name = p_name and minute = this_minute;
  return n <= p_per_minute;
end $$;
revoke all on function pheelm_private.within_budget(text, int) from public, anon, authenticated;

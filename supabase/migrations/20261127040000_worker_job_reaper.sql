-- Jobs a worker claimed but never finished (the function was stopped at its time limit, or the
-- deploy restarted it) used to stay claimed for good: a director biography in 'processing', a
-- queued film on "Adding…". Every 10 minutes, anything claimed more than 15 minutes ago goes back
-- in the queue, or is marked failed after its third try.

-- When a queued film was claimed by /api/internal/queue.
alter table public.film_queue add column if not exists claimed_at timestamptz;

create or replace function pheelm_private.reap_stuck_jobs()
returns jsonb language plpgsql set search_path = '' as $$
declare bios int; films int;
begin
  update public.director_bio_jobs set
    status = case when attempts >= 3 then 'failed' else 'queued' end,
    reason = 'worker_timeout',
    next_attempt_at = now(),
    updated_at = now()
  where status = 'processing' and coalesce(started_at, updated_at) < now() - interval '15 minutes';
  get diagnostics bios = row_count;

  update public.film_queue set last_error = null, claimed_at = null
  where last_error = 'Adding…' and claimed_at < now() - interval '15 minutes';
  get diagnostics films = row_count;

  return jsonb_build_object('director_bio_jobs', bios, 'film_queue', films);
end $$;
-- Films left on "Adding…" before claimed_at existed have no time to go by; release them once, now.
update public.film_queue set last_error = null where last_error = 'Adding…' and claimed_at is null;

revoke all on function pheelm_private.reap_stuck_jobs() from public, anon, authenticated;

select cron.unschedule(jobid) from cron.job where jobname = 'pheelm-reap-stuck-jobs';
select cron.schedule('pheelm-reap-stuck-jobs', '*/10 * * * *', $$select pheelm_private.reap_stuck_jobs();$$);

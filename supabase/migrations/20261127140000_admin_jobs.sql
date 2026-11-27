-- Background jobs for admin automation (Admin > Automation).
-- An admin starts a job (fill posters, update awards, …); the site's worker at /api/internal/jobs
-- works through it in batches, so it keeps going with the page closed. One job of each kind runs at
-- a time. The worker claims a job with a short lease (locked_until) so two runs never overlap.

create table if not exists public.admin_jobs (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('posters', 'synopses', 'credits', 'people', 'awards', 'watch')),
  status text not null default 'running' check (status in ('running', 'done', 'stopped', 'failed')),
  -- Where the next batch starts: the last record id handled (records are taken in id order).
  cursor text,
  total integer not null default 0,
  processed integer not null default 0,
  changed integer not null default 0,
  failed integer not null default 0,
  last_error text,
  started_by uuid references auth.users(id) on delete set null,
  started_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  finished_at timestamptz,
  locked_until timestamptz
);

create unique index if not exists admin_jobs_one_running on public.admin_jobs (kind) where status = 'running';
create index if not exists admin_jobs_recent on public.admin_jobs (kind, started_at desc);

alter table public.admin_jobs enable row level security;
-- Admins read them; starting, stopping and the work itself go through the server with the service key.
drop policy if exists "Admins read jobs" on public.admin_jobs;
create policy "Admins read jobs" on public.admin_jobs for select to authenticated using ((select public.is_admin()));
revoke all on table public.admin_jobs from public, anon, authenticated;
grant select on table public.admin_jobs to authenticated;
grant all on table public.admin_jobs to service_role;

-- Every minute, but only while a job is running: an idle minute costs nothing and calls nothing.
select cron.unschedule(jobid) from cron.job where jobname = 'pheelm-admin-jobs';
select cron.schedule('pheelm-admin-jobs', '* * * * *',
  $$select net.http_post(url:='https://www.pheelm.com/api/internal/jobs', headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||(select decrypted_secret from vault.decrypted_secrets where name='pheelm_worker_secret')), body:='{}'::jsonb, timeout_milliseconds:=70000)
    where exists (select 1 from public.admin_jobs where status = 'running');$$);

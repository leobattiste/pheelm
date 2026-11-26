-- Catalog snapshot: admin saves and workers already rebuild it right away; the schedule is only a fallback.
select cron.alter_job(jobid, schedule := '*/15 * * * *') from cron.job where jobname = 'pheelm-catalog-snapshot';

-- Keep 7 days of scheduled-job history.
select cron.unschedule(jobid) from cron.job where jobname = 'pheelm-cron-history-cleanup';
select cron.schedule('pheelm-cron-history-cleanup', '17 4 * * *',
  $$delete from cron.job_run_details where end_time < now() - interval '7 days'$$);
delete from cron.job_run_details where end_time < now() - interval '7 days';

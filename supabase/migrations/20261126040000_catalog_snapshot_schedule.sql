-- The catalog snapshot rebuild, as it runs on the live database. It was scheduled by hand there,
-- so a database built from these files never had it, and 20261126185701_launch_cron_tuning.sql
-- had no job to change. Same call as the other internal workers (vault secret pheelm_worker_secret,
-- checked by lib/worker-auth.ts).
select cron.unschedule(jobid) from cron.job where jobname = 'pheelm-catalog-snapshot';
select cron.schedule('pheelm-catalog-snapshot', '*/15 * * * *',
  $$select net.http_post(url:='https://www.pheelm.com/api/internal/catalog-snapshot', headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||(select decrypted_secret from vault.decrypted_secrets where name='pheelm_worker_secret')), body:='{}'::jsonb, timeout_milliseconds:=120000);$$);

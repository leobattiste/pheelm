-- Director enrichment workers, called the same way as pheelm-catalog-snapshot
-- (vault secret pheelm_worker_secret, checked by lib/worker-auth.ts).

-- Portraits from TMDB: each director is tried once (photo_checked_at), so idle runs are cheap.
select cron.unschedule(jobid) from cron.job where jobname = 'pheelm-director-photos';
select cron.schedule('pheelm-director-photos', '23 * * * *',
  $$select net.http_post(url:='https://www.pheelm.com/api/internal/director-photos?limit=100', headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||(select decrypted_secret from vault.decrypted_secrets where name='pheelm_worker_secret')), body:='{}'::jsonb, timeout_milliseconds:=300000);$$);

-- Biography drafts: one queued director per call; every draft lands in 'review' for an editor.
-- An empty queue returns immediately without calling OpenAI.
select cron.unschedule(jobid) from cron.job where jobname = 'pheelm-director-biographies';
select cron.schedule('pheelm-director-biographies', '*/5 * * * *',
  $$select net.http_post(url:='https://www.pheelm.com/api/internal/director-biographies', headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||(select decrypted_secret from vault.decrypted_secrets where name='pheelm_worker_secret')), body:='{}'::jsonb, timeout_milliseconds:=130000);$$);

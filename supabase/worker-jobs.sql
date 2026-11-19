-- Scheduled jobs that run without anyone signed in: adding queued films and updating awards.
-- A random secret in Vault authorizes them; only the service role can check it.
do $$ begin
  if not exists (select 1 from vault.secrets where name = 'pheelm_worker_secret') then
    perform vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'pheelm_worker_secret', 'Bearer secret for scheduled jobs calling pheelm.com/api/internal');
  end if;
end $$;

create or replace function public.worker_secret_ok(token text) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(length(token) >= 24 and token = (select decrypted_secret from vault.decrypted_secrets where name = 'pheelm_worker_secret'), false);
$$;
revoke all on function public.worker_secret_ok(text) from public, anon, authenticated;
grant execute on function public.worker_secret_ok(text) to service_role;

-- Every 10 minutes: add up to 6 queued films (matched on TMDB, director checked, published).
select cron.schedule('pheelm-film-queue', '*/10 * * * *', $$
  select net.http_post(url := 'https://pheelm.com/api/internal/queue?limit=6',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'pheelm_worker_secret')),
    body := '{}'::jsonb, timeout_milliseconds := 120000);
$$);

-- Apply after email-system.sql, the Edge Function, and Vault credentials are installed.
create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron with schema pg_catalog;
select cron.schedule('pheelm-email-delivery','*/5 * * * *', $$
 select net.http_post(
  url:='https://mvhwfmlairwrngdttzjh.supabase.co/functions/v1/pheelm-email?action=process',
  headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||(select decrypted_secret from vault.decrypted_secrets where name='pheelm_email_worker_secret')),
  body:='{}'::jsonb,timeout_milliseconds:=60000
 );
$$);

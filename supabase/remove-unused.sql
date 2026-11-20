-- Removes database objects nothing uses any more. Checked on 2026-11-20 against the site code, the
-- deployed pheelm-email function, every trigger, policy, view and scheduled job, and 24 hours of
-- API traffic: none of these were referenced or called. Run after the other setup files; safe to
-- run twice.
--
--   articles                             the Journal's table (Journal removed; /journal redirects home)
--   pheelm_private.page_snapshot         a one-off debugging capture of rendered pages
--   follow_updates()                     "new films by directors you follow"; notifications do this now
--   is_public_profile(uuid)              helper for an old follows policy; the policy no longer uses it
--   my_newsletter_subscription()         superseded newsletter status checks
--   email_newsletter_status()
--   email_digest_payload(uuid, uuid)     the digest email is built from email_digest_items now
--   record_moderation_refusal(...)       the removed OpenAI moderation path; check_text logs refusals
--   pheelm_enqueue_director_biographies  /api/internal/director-biographies manages its own jobs

drop table if exists public.articles;
drop table if exists pheelm_private.page_snapshot;

drop function if exists public.follow_updates();
drop function if exists public.is_public_profile(uuid);
drop function if exists public.my_newsletter_subscription();
drop function if exists public.email_newsletter_status();
drop function if exists public.email_digest_payload(uuid, uuid);
drop function if exists public.record_moderation_refusal(uuid, text, text, text);
drop function if exists public.pheelm_enqueue_director_biographies();

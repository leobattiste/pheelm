-- Recorded from the live database, where it was applied on 2026-11-26. The contact form also offers
-- "Account" and "Other" (app/platform-actions.ts); without these, those messages were refused.
alter table public.messages drop constraint if exists messages_topic_check;
alter table public.messages add constraint messages_topic_check check (topic = any (array['general','account','press','privacy','other','feedback','correction','partnership']::text[]));

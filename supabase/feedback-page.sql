-- Feedback remembers the page (or part of a page) it was sent from, and has its own topic.
alter table public.messages drop constraint if exists messages_topic_check;
alter table public.messages add constraint messages_topic_check check (topic in ('general', 'feedback', 'correction', 'partnership', 'press', 'privacy'));
alter table public.messages add column if not exists page text check (char_length(page) <= 500);
alter table public.messages add column if not exists page_title text check (char_length(page_title) <= 200);

create or replace function public.notify_admins_message() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.notifications (user_id, type, ref_id, detail)
  select a.id, 'message', new.id, left(coalesce(nullif(new.name, ''), 'Someone') || ' • ' || coalesce(new.topic, 'message')
    || coalesce(' on ' || new.page_title, '') || ': ' || new.body, 200)
  from public.profiles a where a.is_admin;
  return null;
end $$;

-- What an edit changed, field by field ([{ field, before, after }]), for the activity log and the
-- History on each film and person. Older entries have none.
alter table public.admin_activity add column if not exists changes jsonb;

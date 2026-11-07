-- Longer collection descriptions, so curators can write essays (was 500 characters).
alter table public.lists drop constraint if exists lists_description_check;
alter table public.lists add constraint lists_description_check check (char_length(description) <= 10000);

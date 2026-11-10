-- Preserve existing bios and enforce the short profile bio limit for every write path.
alter table public.profiles add constraint profiles_bio_130_chars check(char_length(bio)<=130);

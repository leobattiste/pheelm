alter table public.profiles add constraint profiles_bio_50_chars check(char_length(bio)<=50);

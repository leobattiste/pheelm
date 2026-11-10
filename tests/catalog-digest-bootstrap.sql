create table public.films(id uuid primary key,title text,slug text,status text);
create table public.people(id uuid primary key,name text,slug text,in_directory boolean default true);
create table public.credits(film_id uuid,person_id uuid,role text);
create table public.profiles(id uuid primary key,handle text,is_private boolean default false);
create table public.lists(id uuid primary key,user_id uuid,title text,is_public boolean,staff_pick boolean default false);
create table public.list_films(list_id uuid,film_id uuid);

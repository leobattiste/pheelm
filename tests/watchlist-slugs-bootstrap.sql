create table public.lists(id uuid primary key default gen_random_uuid(),user_id uuid,title text not null,created_at timestamptz not null default now(),is_public boolean not null default false,hidden boolean not null default false);
alter table public.lists enable row level security;
create policy public_lists on public.lists for select to anon using(is_public and not hidden);
grant select on public.lists to anon;
insert into public.lists(title,is_public) values('Same name',true),('Same name',false),('Same name-2',true),('École de cinéma',true),('!!!',false);

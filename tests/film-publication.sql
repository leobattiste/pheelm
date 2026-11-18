begin;
create table public.films(id int primary key,status text,created_at timestamptz default now());
insert into public.films values(1,'published','2000-01-01'),(2,'draft','2001-01-01');
\i supabase/film-publication-date.sql
\i supabase/film-publication-date.sql
do $$begin
 if (select published_at<>created_at from public.films where id=1) then raise exception 'Historical fallback lost';end if;
 if (select published_at is not null from public.films where id=2) then raise exception 'Draft got publication date';end if;
end$$;
update public.films set status='published' where id=2;
insert into public.films(id,status,created_at) values(3,'published','1999-01-01');
do $$begin
 if exists(select 1 from public.films where id in (2,3) and published_at<>now()) then raise exception 'New publication must use publication time';end if;
end$$;
update public.films set status='published' where id=1;
do $$begin if (select published_at<>created_at from public.films where id=1) then raise exception 'Published edit changed publication date';end if;end$$;
rollback;
select 'PASS: publication dates, draft promotion, historical fallback, insert and idempotent migration';

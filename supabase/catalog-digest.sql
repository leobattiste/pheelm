-- Digest contains newly discoverable public catalog items, never private content.
create view pheelm_email.discoverable_catalog as
 select 'film'::text kind,f.id entity_id,f.title title,'/films/'||f.slug path from public.films f where f.status='published'
 union all
 select distinct 'director',p.id,p.name,'/directors/'||p.slug from public.people p join public.credits c on c.person_id=p.id and c.role='director' join public.films f on f.id=c.film_id and f.status='published' where p.in_directory is distinct from false
 union all
 select 'collection',l.id,l.title,'/c/'||l.id from public.lists l join public.profiles p on p.id=l.user_id where l.is_public and not coalesce(p.is_private,false) and p.handle is not null and (l.staff_pick or (select count(*) from public.list_films lf join public.films f on f.id=lf.film_id and f.status='published' where lf.list_id=l.id)>=5);
revoke all on pheelm_email.discoverable_catalog from public,anon,authenticated;
create table pheelm_email.catalog_additions(kind text not null,entity_id uuid not null,added_at timestamptz not null default now(),primary key(kind,entity_id));
alter table pheelm_email.catalog_additions enable row level security;
create index catalog_additions_time on pheelm_email.catalog_additions(added_at);
revoke all on pheelm_email.catalog_additions from public,anon,authenticated;
-- Existing items form a baseline, not a launch announcement to every member.
insert into pheelm_email.catalog_additions(kind,entity_id,added_at) select kind,entity_id,'-infinity'::timestamptz from pheelm_email.discoverable_catalog on conflict do nothing;
alter table public.email_preferences add column digest_cursor timestamptz not null default now();
alter table pheelm_email.outbox add column digest_from timestamptz,add column digest_until timestamptz;
create function pheelm_email.reset_digest_cursor() returns trigger language plpgsql set search_path='' as $$begin if new.digest_frequency is distinct from old.digest_frequency then new.digest_cursor:=now();end if;return new;end$$;
create trigger reset_digest_cursor before update of digest_frequency on public.email_preferences for each row execute function pheelm_email.reset_digest_cursor();
revoke all on function pheelm_email.reset_digest_cursor() from public,anon,authenticated;
create function pheelm_email.digest_message(since_time timestamptz,until_time timestamptz) returns text language sql stable security definer set search_path='' as $$
 with items as (select c.*,row_number() over(partition by c.kind order by a.added_at desc,c.entity_id) n,count(*) over(partition by c.kind) total from pheelm_email.discoverable_catalog c join pheelm_email.catalog_additions a using(kind,entity_id) where a.added_at>since_time and a.added_at<=until_time),
 sections as (select kind,max(total) total,string_agg(left(title,100)||case when length(title)>100 then '…' else '' end||E'\nhttps://www.pheelm.com'||path,E'\n\n' order by n) body from items where n<=4 group by kind)
 select E'New on Pheelm\n\n'||string_agg(case kind when 'film' then 'Films' when 'director' then 'Directors' else 'Watchlists' end||' ('||total||E')\n'||body||case when total>4 then E'\nMore on Pheelm.' else '' end,E'\n\n' order by case kind when 'film' then 1 when 'director' then 2 else 3 end) from sections;
$$;
revoke all on function pheelm_email.digest_message(timestamptz,timestamptz) from public,anon,authenticated;
create or replace function public.email_prepare_digests() returns void language plpgsql security definer set search_path='' as $$
declare p record; body text; event text; cutoff timestamptz:=now();
begin
 if not pg_try_advisory_xact_lock(hashtextextended('pheelm-catalog-digest',0)) then return;end if;
 insert into pheelm_email.catalog_additions(kind,entity_id) select kind,entity_id from pheelm_email.discoverable_catalog on conflict do nothing;
 for p in select ep.*,u.email from public.email_preferences ep join auth.users u on u.id=ep.user_id where ep.digest_frequency<>'off' and u.email_confirmed_at is not null and (u.banned_until is null or u.banned_until<now()) and ep.digest_cursor<=cutoff-case when ep.digest_frequency='weekly' then interval '7 days' else interval '1 day' end for update of ep skip locked loop
 body:=pheelm_email.digest_message(p.digest_cursor,cutoff);
 if body is not null then
 event:='catalog-digest:'||p.user_id||':'||extract(epoch from cutoff)::text;
 perform pheelm_email.enqueue(event,p.user_id,p.email,'activity-digest',body,'/films','optional');
 update pheelm_email.outbox set digest_from=p.digest_cursor,digest_until=cutoff where event_key=event;
 end if;
 update public.email_preferences set digest_cursor=cutoff where user_id=p.user_id;
 end loop;
 delete from pheelm_email.outbox where created_at<now()-interval '14 days';
 delete from pheelm_email.events where created_at<now()-interval '14 days';
end $$;
create function public.email_digest_payload(job_id uuid,lease_id uuid) returns text language sql stable security definer set search_path='' as $$
 select pheelm_email.digest_message(o.digest_from,o.digest_until) from pheelm_email.outbox o join public.email_preferences p on p.user_id=o.user_id and p.digest_frequency<>'off' where o.id=job_id and o.lease=lease_id and o.state='processing' and o.template='activity-digest';
$$;
revoke all on function public.email_digest_payload(uuid,uuid) from public,anon,authenticated;
grant execute on function public.email_digest_payload(uuid,uuid) to service_role;
-- Previously queued unread-notification summaries no longer match Digest's purpose.
update pheelm_email.outbox set state='suppressed',message='',last_error='Replaced by catalog Digest' where template='activity-digest' and digest_from is null and state in ('pending','processing');

-- Filmmakers submitting their own film. Safe to run more than once.
-- kind: 'suggestion' (a film someone thinks belongs here) or 'own' (a filmmaker's own film).
-- details: what a film page shows (synopsis, credits, awards, where to watch...) plus a contact email.
alter table public.submissions add column if not exists kind text not null default 'suggestion';
alter table public.submissions add column if not exists details jsonb;
alter table public.submissions drop constraint if exists submissions_kind_check;
alter table public.submissions add constraint submissions_kind_check check (kind in ('suggestion', 'own'));

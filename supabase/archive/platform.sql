-- The newsletter list and the contact inbox. Anyone can sign up or send a message; only admins
-- can read them. Safe to run more than once.

create table if not exists public.subscribers (
  email text primary key check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' and length(email) <= 254),
  source text,
  created_at timestamptz not null default now()
);
alter table public.subscribers enable row level security;
drop policy if exists "Anyone can subscribe" on public.subscribers;
create policy "Anyone can subscribe" on public.subscribers for insert to anon, authenticated with check (true);
drop policy if exists "Admins read subscribers" on public.subscribers;
create policy "Admins read subscribers" on public.subscribers for select using (public.is_admin());
drop policy if exists "Admins remove subscribers" on public.subscribers;
create policy "Admins remove subscribers" on public.subscribers for delete using (public.is_admin());

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  name text check (length(name) <= 200),
  email text not null check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' and length(email) <= 254),
  organization text check (length(organization) <= 200),
  topic text not null default 'general' check (topic in ('general', 'correction', 'partnership', 'press', 'privacy')),
  body text not null check (length(body) between 1 and 5000),
  handled boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.messages enable row level security;
drop policy if exists "Anyone can send a message" on public.messages;
create policy "Anyone can send a message" on public.messages for insert to anon, authenticated with check (handled = false);
drop policy if exists "Admins read messages" on public.messages;
create policy "Admins read messages" on public.messages for select using (public.is_admin());
drop policy if exists "Admins update messages" on public.messages;
create policy "Admins update messages" on public.messages for update using (public.is_admin());
drop policy if exists "Admins delete messages" on public.messages;
create policy "Admins delete messages" on public.messages for delete using (public.is_admin());

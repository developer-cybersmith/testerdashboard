-- Cybersmith people + collection store. Run in the Supabase SQL editor, then: npm run seed

create table if not exists public.people (
  id text primary key,
  email text unique not null,
  auth_user_id uuid unique,
  role text not null check (role in ('admin', 'hr', 'tl', 'user')),
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.app_records (
  collection text not null,
  id text not null,
  payload jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (collection, id)
);

create table if not exists public.app_kv (
  key text primary key,
  payload jsonb not null,
  updated_at timestamptz not null default now()
);

create index if not exists people_email_idx on public.people (email);
create index if not exists app_records_collection_idx on public.app_records (collection);

alter table public.people enable row level security;
alter table public.app_records enable row level security;
alter table public.app_kv enable row level security;

drop policy if exists people_select_authenticated on public.people;
create policy people_select_authenticated on public.people
  for select to authenticated using (true);

drop policy if exists records_select_authenticated on public.app_records;
create policy records_select_authenticated on public.app_records
  for select to authenticated using (true);

drop policy if exists kv_select_authenticated on public.app_kv;
create policy kv_select_authenticated on public.app_kv
  for select to authenticated using (true);

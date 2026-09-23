-- Run once in the Supabase SQL editor.
-- Safe to run again. It does not delete people, projects, updates, or any other rows.
-- Do not run supabase/seed.sql or npm run seed on this database after real data exists.

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

grant usage on schema public to authenticated;
grant select, insert, update, delete on public.people to authenticated;
grant select, insert, update, delete on public.app_records to authenticated;
grant select, insert, update, delete on public.app_kv to authenticated;

drop policy if exists people_select_authenticated on public.people;
create policy people_select_authenticated on public.people
  for select to authenticated using (true);

drop policy if exists records_select_authenticated on public.app_records;
create policy records_select_authenticated on public.app_records
  for select to authenticated using (true);

drop policy if exists kv_select_authenticated on public.app_kv;
create policy kv_select_authenticated on public.app_kv
  for select to authenticated using (true);

drop policy if exists people_write_authenticated on public.people;
create policy people_write_authenticated on public.people
  for all to authenticated using (true) with check (true);

drop policy if exists records_write_authenticated on public.app_records;
create policy records_write_authenticated on public.app_records
  for all to authenticated using (true) with check (true);

drop policy if exists kv_write_authenticated on public.app_kv;
create policy kv_write_authenticated on public.app_kv
  for all to authenticated using (true) with check (true);

do $$
begin
  alter table public.app_records drop constraint if exists app_records_collection_check;
  alter table public.app_records add constraint app_records_collection_check
    check (collection in (
      'projects',
      'updates',
      'queries',
      'blockers',
      'discussions',
      'notifications',
      'leaveRequests',
      'requirementRequests',
      'projectStatusRequests',
      'workedDayRequests',
      'checklists',
      'reviews',
      'assets',
      'accessGrants',
      'payslips',
      'hrTickets',
      'regularizations',
      'roster',
      'channelPosts'
    ));
exception
  when others then
    raise notice 'Collection check was not added: %', sqlerrm;
end $$;

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.people_before_write()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  new.email = lower(btrim(new.email));
  new.payload = coalesce(new.payload, '{}'::jsonb) - 'password';
  new.payload = jsonb_set(new.payload, '{id}', to_jsonb(new.id), true);
  new.payload = jsonb_set(new.payload, '{email}', to_jsonb(new.email), true);
  new.payload = jsonb_set(new.payload, '{role}', to_jsonb(new.role), true);
  return new;
end;
$$;

drop trigger if exists people_before_write on public.people;
create trigger people_before_write
  before insert or update on public.people
  for each row execute function public.people_before_write();

drop trigger if exists app_records_touch_updated_at on public.app_records;
create trigger app_records_touch_updated_at
  before insert or update on public.app_records
  for each row execute function public.touch_updated_at();

drop trigger if exists app_kv_touch_updated_at on public.app_kv;
create trigger app_kv_touch_updated_at
  before insert or update on public.app_kv
  for each row execute function public.touch_updated_at();

-- Attach existing logins to employee rows. Does not change names or other profile fields.
update public.people as person
set auth_user_id = account.id
from auth.users as account
where account.email is not null
  and lower(person.email) = lower(account.email)
  and (person.auth_user_id is null or person.auth_user_id = account.id)
  and not exists (
    select 1
    from public.people as other
    where other.auth_user_id = account.id
      and other.id <> person.id
  );

-- Add an employee row for every company login that is not already stored.
insert into public.people (id, email, auth_user_id, role, payload)
select
  case
    when nullif(account.raw_user_meta_data ->> 'person_id', '') is not null
      and not exists (
        select 1
        from public.people as existing
        where existing.id = account.raw_user_meta_data ->> 'person_id'
      )
    then account.raw_user_meta_data ->> 'person_id'
    else 'user-' || account.id::text
  end as id,
  lower(account.email) as email,
  account.id as auth_user_id,
  case
    when account.raw_user_meta_data ->> 'role' in ('admin', 'hr', 'tl', 'user')
    then account.raw_user_meta_data ->> 'role'
    else 'user'
  end as role,
  jsonb_build_object(
    'name', initcap(replace(replace(split_part(lower(account.email), '@', 1), '.', ' '), '_', ' ')),
    'avatar', 'https://ui-avatars.com/api/?name=' || replace(split_part(lower(account.email), '@', 1), '.', '+') || '&background=0b4f3c&color=fff',
    'avatarUploaded', false,
    'status', 'active',
    'employmentType', 'Full-Time',
    'joinDate', to_char(now() at time zone 'utc', 'YYYY-MM-DD'),
    'lifecycleStatus', 'onboarding',
    'mustChangePassword', true,
    'shiftId', 'shift-general',
    'department', 'VAPT',
    'skills', '[]'::jsonb,
    'documents', '[]'::jsonb,
    'notes', '[]'::jsonb,
    'leaveBalance', jsonb_build_object(
      'allUsed', 0,
      'allMax', 26,
      'annualUsed', 0,
      'annualMax', 0,
      'casualUsed', 0,
      'casualMax', 14,
      'sickUsed', 0,
      'sickMax', 12
    )
  ) as payload
from auth.users as account
where account.email is not null
  and lower(account.email) like '%@cybersmithsecure.com'
  and not exists (
    select 1
    from public.people as person
    where lower(person.email) = lower(account.email)
  );

-- Check that logins and stored employees match. Nothing here changes data.
select
  (select count(*) from auth.users where email ilike '%@cybersmithsecure.com') as company_logins,
  (select count(*) from public.people) as stored_employees,
  (select count(*) from public.app_records) as stored_records,
  (select count(*) from public.app_kv) as stored_settings;

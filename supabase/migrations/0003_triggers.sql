-- Run once in the Supabase SQL editor.
-- Tables from 0001_init.sql must already exist.
-- Safe to run again.

-- Signed-in users can read and write. The API secret key bypasses these policies.
grant usage on schema public to authenticated;
grant select, insert, update, delete on public.people to authenticated;
grant select, insert, update, delete on public.app_records to authenticated;
grant select, insert, update, delete on public.app_kv to authenticated;

drop policy if exists people_write_authenticated on public.people;
create policy people_write_authenticated on public.people
  for all to authenticated using (true) with check (true);

drop policy if exists records_write_authenticated on public.app_records;
create policy records_write_authenticated on public.app_records
  for all to authenticated using (true) with check (true);

drop policy if exists kv_write_authenticated on public.app_kv;
create policy kv_write_authenticated on public.app_kv
  for all to authenticated using (true) with check (true);

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

-- Lets Supabase Realtime deliver changes. The dashboard also reloads from the API.
do $$
begin
  alter publication supabase_realtime add table public.people;
exception
  when duplicate_object then null;
  when undefined_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.app_records;
exception
  when duplicate_object then null;
  when undefined_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.app_kv;
exception
  when duplicate_object then null;
  when undefined_object then null;
end $$;

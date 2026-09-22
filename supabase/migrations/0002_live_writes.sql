-- Lets a signed-in session write people, dashboard records, and settings.
-- The API still prefers the secret key, which bypasses these policies.
-- Run this in the Supabase SQL editor after 0001_init.sql.

drop policy if exists people_write_authenticated on public.people;
create policy people_write_authenticated on public.people
  for all to authenticated using (true) with check (true);

drop policy if exists records_write_authenticated on public.app_records;
create policy records_write_authenticated on public.app_records
  for all to authenticated using (true) with check (true);

drop policy if exists kv_write_authenticated on public.app_kv;
create policy kv_write_authenticated on public.app_kv
  for all to authenticated using (true) with check (true);

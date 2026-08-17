-- Central GO production scale hardening.
-- Operators/admins keep the full live fleet view. Driver accounts only read their
-- own driver row and GPS row, preventing every phone from receiving every fleet
-- location update through Supabase Realtime.

drop policy if exists drivers_read_member on public.drivers;
create policy drivers_read_member
on public.drivers
for select
to authenticated
using (
  archived_at is null
  and (
    public.centralgo_is_super_admin()
    or public.centralgo_has_company_role(
      company_id,
      array['company_admin','operator']::public.centralgo_company_role[]
    )
    or user_id = (select auth.uid())
  )
);

drop policy if exists driver_locations_read_member on public.driver_locations;
create policy driver_locations_read_member
on public.driver_locations
for select
to authenticated
using (
  public.centralgo_is_super_admin()
  or public.centralgo_has_company_role(
    company_id,
    array['company_admin','operator']::public.centralgo_company_role[]
  )
  or exists (
    select 1
    from public.drivers d
    where d.id = driver_locations.driver_id
      and d.company_id = driver_locations.company_id
      and d.user_id = (select auth.uid())
  )
);

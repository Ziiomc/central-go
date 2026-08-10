-- Optimize auth.uid() evaluation, remove duplicate permissive SELECT policies,
-- and bind driver-owned writes to the driver's actual company.

-- Profiles.
drop policy if exists profiles_read_self_or_super on public.profiles;
create policy profiles_read_self_or_super on public.profiles
for select to authenticated
using (id = (select auth.uid()) or public.centralgo_is_super_admin());

drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles
for update to authenticated
using (id = (select auth.uid()))
with check (id = (select auth.uid()));

-- Memberships.
drop policy if exists memberships_read on public.company_memberships;
create policy memberships_read on public.company_memberships
for select to authenticated
using (user_id = (select auth.uid()) or public.centralgo_has_company_role(company_id, array['company_admin']::public.centralgo_company_role[]));

-- Driver locations: driver ID and company ID must refer to the same owned driver.
drop policy if exists driver_locations_write_owner on public.driver_locations;
create policy driver_locations_write_owner on public.driver_locations
for insert to authenticated
with check (
  exists (
    select 1 from public.drivers d
    where d.id = driver_locations.driver_id
      and d.user_id = (select auth.uid())
      and d.company_id = driver_locations.company_id
  )
  or public.centralgo_has_company_role(company_id, array['company_admin','operator']::public.centralgo_company_role[])
);

drop policy if exists driver_locations_update_owner on public.driver_locations;
create policy driver_locations_update_owner on public.driver_locations
for update to authenticated
using (
  exists (
    select 1 from public.drivers d
    where d.id = driver_locations.driver_id
      and d.user_id = (select auth.uid())
      and d.company_id = driver_locations.company_id
  )
  or public.centralgo_has_company_role(company_id, array['company_admin','operator']::public.centralgo_company_role[])
)
with check (
  exists (
    select 1 from public.drivers d
    where d.id = driver_locations.driver_id
      and d.user_id = (select auth.uid())
      and d.company_id = driver_locations.company_id
  )
  or public.centralgo_has_company_role(company_id, array['company_admin','operator']::public.centralgo_company_role[])
);

drop policy if exists driver_history_write_owner on public.driver_location_history;
create policy driver_history_write_owner on public.driver_location_history
for insert to authenticated
with check (
  exists (
    select 1 from public.drivers d
    where d.id = driver_location_history.driver_id
      and d.user_id = (select auth.uid())
      and d.company_id = driver_location_history.company_id
  )
  or public.centralgo_has_company_role(company_id, array['company_admin','operator']::public.centralgo_company_role[])
);

-- Trips.
drop policy if exists trips_read_company on public.trips;
create policy trips_read_company on public.trips
for select to authenticated
using (
  public.centralgo_has_company_role(company_id, array['company_admin','operator']::public.centralgo_company_role[])
  or exists (
    select 1 from public.drivers d
    where d.id = trips.driver_id
      and d.user_id = (select auth.uid())
      and d.company_id = trips.company_id
  )
);

-- SOS: bind driver and company.
drop policy if exists sos_insert_driver on public.sos_events;
create policy sos_insert_driver on public.sos_events
for insert to authenticated
with check (
  exists (
    select 1 from public.drivers d
    where d.id = sos_events.driver_id
      and d.user_id = (select auth.uid())
      and d.company_id = sos_events.company_id
  )
  or public.centralgo_has_company_role(company_id, array['company_admin','operator']::public.centralgo_company_role[])
);

drop policy if exists sos_read_authorized on public.sos_events;
create policy sos_read_authorized on public.sos_events
for select to authenticated
using (
  public.centralgo_has_company_role(company_id, array['company_admin','operator']::public.centralgo_company_role[])
  or exists (
    select 1 from public.drivers d
    where d.id = sos_events.driver_id
      and d.user_id = (select auth.uid())
      and d.company_id = sos_events.company_id
  )
);

-- Notifications.
drop policy if exists notifications_read on public.notifications;
create policy notifications_read on public.notifications
for select to authenticated
using (
  recipient_user_id = (select auth.uid())
  or (recipient_user_id is null and public.centralgo_is_company_member(company_id))
  or public.centralgo_is_super_admin()
);

drop policy if exists notifications_update_own on public.notifications;
create policy notifications_update_own on public.notifications
for update to authenticated
using (recipient_user_id = (select auth.uid()))
with check (recipient_user_id = (select auth.uid()));

-- Network partner reads.
drop policy if exists partners_read_self_or_super on public.partners;
create policy partners_read_self_or_super on public.partners
for select to authenticated
using (user_id = (select auth.uid()) or public.centralgo_is_super_admin());

drop policy if exists territories_read_partner on public.partner_territories;
create policy territories_read_partner on public.partner_territories
for select to authenticated
using (
  public.centralgo_is_super_admin()
  or exists (select 1 from public.partners p where p.id = partner_territories.partner_id and p.user_id = (select auth.uid()))
);

drop policy if exists referrals_read_partner on public.referrals;
create policy referrals_read_partner on public.referrals
for select to authenticated
using (
  public.centralgo_is_super_admin()
  or exists (select 1 from public.partners p where p.id = referrals.partner_id and p.user_id = (select auth.uid()))
);

drop policy if exists commissions_read_partner on public.commission_ledger;
create policy commissions_read_partner on public.commission_ledger
for select to authenticated
using (
  public.centralgo_is_super_admin()
  or exists (select 1 from public.partners p where p.id = commission_ledger.partner_id and p.user_id = (select auth.uid()))
);

drop policy if exists payouts_read_partner on public.partner_payouts;
create policy payouts_read_partner on public.partner_payouts
for select to authenticated
using (
  public.centralgo_is_super_admin()
  or exists (select 1 from public.partners p where p.id = partner_payouts.partner_id and p.user_id = (select auth.uid()))
);

-- Support tickets.
drop policy if exists tickets_insert_member on public.support_tickets;
create policy tickets_insert_member on public.support_tickets
for insert to authenticated
with check (
  created_by = (select auth.uid())
  and company_id is not null
  and public.centralgo_is_company_member(company_id)
);

drop policy if exists tickets_read_authorized on public.support_tickets;
create policy tickets_read_authorized on public.support_tickets
for select to authenticated
using (
  public.centralgo_is_super_admin()
  or (company_id is not null and public.centralgo_is_company_member(company_id))
  or exists (select 1 from public.partners p where p.id = support_tickets.assigned_partner_id and p.user_id = (select auth.uid()))
);

drop policy if exists tickets_update_assignee on public.support_tickets;
create policy tickets_update_assignee on public.support_tickets
for update to authenticated
using (
  public.centralgo_is_super_admin()
  or exists (select 1 from public.partners p where p.id = support_tickets.assigned_partner_id and p.user_id = (select auth.uid()))
)
with check (
  public.centralgo_is_super_admin()
  or exists (select 1 from public.partners p where p.id = support_tickets.assigned_partner_id and p.user_id = (select auth.uid()))
);

-- Remove duplicate permissive SELECT policies created by ALL policies.
drop policy if exists clients_write_ops on public.clients;
create policy clients_insert_ops on public.clients for insert to authenticated
with check (public.centralgo_has_company_role(company_id, array['company_admin','operator']::public.centralgo_company_role[]));
create policy clients_update_ops on public.clients for update to authenticated
using (public.centralgo_has_company_role(company_id, array['company_admin','operator']::public.centralgo_company_role[]))
with check (public.centralgo_has_company_role(company_id, array['company_admin','operator']::public.centralgo_company_role[]));
create policy clients_delete_ops on public.clients for delete to authenticated
using (public.centralgo_has_company_role(company_id, array['company_admin','operator']::public.centralgo_company_role[]));

drop policy if exists client_addresses_write_ops on public.client_addresses;
create policy client_addresses_insert_ops on public.client_addresses for insert to authenticated
with check (public.centralgo_has_company_role(company_id, array['company_admin','operator']::public.centralgo_company_role[]));
create policy client_addresses_update_ops on public.client_addresses for update to authenticated
using (public.centralgo_has_company_role(company_id, array['company_admin','operator']::public.centralgo_company_role[]))
with check (public.centralgo_has_company_role(company_id, array['company_admin','operator']::public.centralgo_company_role[]));
create policy client_addresses_delete_ops on public.client_addresses for delete to authenticated
using (public.centralgo_has_company_role(company_id, array['company_admin','operator']::public.centralgo_company_role[]));

drop policy if exists fare_configs_admin_write on public.fare_configs;
create policy fare_configs_admin_insert on public.fare_configs for insert to authenticated
with check (public.centralgo_has_company_role(company_id, array['company_admin']::public.centralgo_company_role[]));
create policy fare_configs_admin_update on public.fare_configs for update to authenticated
using (public.centralgo_has_company_role(company_id, array['company_admin']::public.centralgo_company_role[]))
with check (public.centralgo_has_company_role(company_id, array['company_admin']::public.centralgo_company_role[]));
create policy fare_configs_admin_delete on public.fare_configs for delete to authenticated
using (public.centralgo_has_company_role(company_id, array['company_admin']::public.centralgo_company_role[]));

-- Cover nullable FK used to claim the reserved Superadmin bootstrap identity.
create index if not exists centralgo_bootstrap_superadmins_claimed_by_idx
  on private.centralgo_bootstrap_superadmins(claimed_by)
  where claimed_by is not null;

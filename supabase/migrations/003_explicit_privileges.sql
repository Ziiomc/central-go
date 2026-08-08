-- Central GO explicit database privilege matrix.
-- RLS decides which rows; SQL privileges decide which operations are possible at all.

-- Remove accidental/default browser access first.
revoke all on table
  public.profiles,
  public.companies,
  public.company_memberships,
  public.vehicles,
  public.drivers,
  public.driver_locations,
  public.driver_location_history,
  public.clients,
  public.client_addresses,
  public.trips,
  public.fare_configs,
  public.sos_events,
  public.notifications,
  public.audit_logs,
  public.driver_settlements
from anon, authenticated;

-- Anonymous browser sessions receive no operational data access.

-- Authenticated identity/profile access.
grant select on public.profiles to authenticated;
grant update (name, phone, avatar_url) on public.profiles to authenticated;

-- Company directory is readable by members through RLS. Company creation and
-- membership provisioning remain service/admin operations.
grant select, update on public.companies to authenticated;
grant select on public.company_memberships to authenticated;

-- Fleet administration is limited by RLS to company administrators. Drivers
-- use RPCs for their own live operational state.
grant select, insert, update, delete on public.vehicles to authenticated;
grant select, insert, update on public.drivers to authenticated;

-- GPS table writes are allowed only where RLS proves driver ownership or
-- operator/admin access. The preferred driver path is the atomic RPC.
grant select, insert, update on public.driver_locations to authenticated;
grant select, insert on public.driver_location_history to authenticated;

-- Customer data is operator/admin only via RLS.
grant select, insert, update, delete on public.clients to authenticated;
grant select, insert, update, delete on public.client_addresses to authenticated;

-- Trips are never physically deleted by browser clients; cancellation is a
-- state transition and remains auditable.
grant select, insert, update on public.trips to authenticated;

-- Commercial configuration.
grant select, insert, update, delete on public.fare_configs to authenticated;
grant select, insert on public.driver_settlements to authenticated;

-- Safety and communications.
grant select, insert, update on public.sos_events to authenticated;
grant select, insert, update on public.notifications to authenticated;

-- Audit is append-only through centralgo_write_audit() / trusted server paths.
grant select on public.audit_logs to authenticated;

-- Identity-backed tables use UUIDs, while append-only history/audit use identity
-- sequences. Sequence usage is not row data access.
grant usage, select on all sequences in schema public to authenticated;

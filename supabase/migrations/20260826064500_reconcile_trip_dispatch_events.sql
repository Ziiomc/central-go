-- Reconcile a production table that existed outside the migration history.
-- Clean rebuilds must support offer/reject/cancel audit events exactly like production.

create table if not exists public.trip_dispatch_events (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  trip_id uuid not null references public.trips(id) on delete cascade,
  driver_id uuid references public.drivers(id) on delete set null,
  event_type text not null check (event_type in ('offered','accepted','rejected','expired','unassigned','client_cancelled','operator_cancelled')),
  reason text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists trip_dispatch_events_created_by_idx
  on public.trip_dispatch_events(created_by);
create index if not exists trip_dispatch_events_driver_created_idx
  on public.trip_dispatch_events(company_id,driver_id,created_at desc);
create index if not exists trip_dispatch_events_driver_id_idx
  on public.trip_dispatch_events(driver_id);
create index if not exists trip_dispatch_events_trip_created_idx
  on public.trip_dispatch_events(trip_id,created_at desc);

alter table public.trip_dispatch_events enable row level security;

drop policy if exists trip_dispatch_events_read on public.trip_dispatch_events;
create policy trip_dispatch_events_read
  on public.trip_dispatch_events
  for select
  to authenticated
  using (public.centralgo_is_super_admin() or public.centralgo_is_company_member(company_id));

-- Match the existing Supabase API grant surface. RLS remains the data boundary;
-- writes are performed by validated SECURITY DEFINER RPCs.
grant all on table public.trip_dispatch_events to anon,authenticated,service_role;

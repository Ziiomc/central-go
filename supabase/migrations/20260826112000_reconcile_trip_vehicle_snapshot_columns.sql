-- Reconcile fresh environments with the trip vehicle snapshot columns already present in production.
-- These fields are intentionally denormalized so operator redispatch/unassign flows can clear
-- the vehicle snapshot together with the driver assignment.

alter table public.trips
  add column if not exists vehicle_id uuid references public.vehicles(id) on delete set null,
  add column if not exists vehicle_unit_number text,
  add column if not exists vehicle_plate text;

create index if not exists trips_vehicle_id_idx on public.trips(vehicle_id);

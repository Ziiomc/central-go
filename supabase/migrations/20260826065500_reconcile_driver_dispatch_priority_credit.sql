-- Production already uses this field to compensate a driver when a client
-- cancels an assigned service. It existed outside the migration history, which
-- made clean rebuilds fail inside centralgo_operator_cancel_trip_v2.

alter table public.drivers
  add column if not exists dispatch_priority_credit integer;

update public.drivers
set dispatch_priority_credit = 0
where dispatch_priority_credit is null;

alter table public.drivers
  alter column dispatch_priority_credit set default 0,
  alter column dispatch_priority_credit set not null;

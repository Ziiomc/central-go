-- Reconcile production cancellation metadata with the migration history.
-- centralgo_operator_cancel_trip_v2 records whether the operator or client
-- originated the cancellation; clean rebuilds were missing this column.

alter table public.trips
  add column if not exists cancel_source text;

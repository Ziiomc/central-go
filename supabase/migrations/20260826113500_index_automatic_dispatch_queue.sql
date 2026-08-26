-- The automatic dispatcher wakes every five seconds. Keep its pending-work lookup
-- on a small partial index so an idle or busy central does not repeatedly scan trips.

create index if not exists trips_automatic_dispatch_queue_idx
  on public.trips ((coalesce(scheduled_for, created_at)))
  where status = 'pending'
    and dispatch_mode = 'automatic'
    and driver_id is null;

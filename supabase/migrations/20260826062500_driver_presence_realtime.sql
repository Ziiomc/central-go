-- Keep the central dispatch queue synchronized when an app driver opens/closes or heartbeats.
-- The UI already subscribes to driver_presence_sessions, but the table was not part of
-- the supabase_realtime publication in production, so those events could never arrive.

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'driver_presence_sessions'
  ) then
    alter publication supabase_realtime add table public.driver_presence_sessions;
  end if;
end
$$;

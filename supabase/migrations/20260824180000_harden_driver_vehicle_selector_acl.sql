-- These RPCs require auth.uid() and must not remain callable by anon through
-- Supabase's default function grants.

revoke all on function public.centralgo_driver_vehicle_options() from public,anon;
revoke all on function public.centralgo_driver_select_vehicle(uuid) from public,anon;
grant execute on function public.centralgo_driver_vehicle_options() to authenticated,service_role;
grant execute on function public.centralgo_driver_select_vehicle(uuid) to authenticated,service_role;

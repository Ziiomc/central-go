-- These operator-only SECURITY DEFINER RPCs must never be callable by anon.
-- Their internal authorization remains in place as defense in depth.

revoke all on function public.centralgo_operator_assign_driver_vehicle(uuid,uuid) from public,anon;
revoke all on function public.centralgo_operator_release_driver_vehicle(uuid) from public,anon;
revoke all on function public.centralgo_operator_set_driver_supermarket(uuid,boolean) from public,anon;

grant execute on function public.centralgo_operator_assign_driver_vehicle(uuid,uuid) to authenticated,service_role;
grant execute on function public.centralgo_operator_release_driver_vehicle(uuid) to authenticated,service_role;
grant execute on function public.centralgo_operator_set_driver_supermarket(uuid,boolean) to authenticated,service_role;

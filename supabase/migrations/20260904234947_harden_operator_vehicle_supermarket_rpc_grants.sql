-- Operator-only RPC grants. Keep this migration safe on clean local histories
-- where the corresponding production fleet RPCs may not exist yet.
do $$
begin
  if to_regprocedure('public.centralgo_operator_assign_driver_vehicle(uuid,uuid)') is not null then
    execute 'revoke all on function public.centralgo_operator_assign_driver_vehicle(uuid,uuid) from public,anon';
    execute 'grant execute on function public.centralgo_operator_assign_driver_vehicle(uuid,uuid) to authenticated,service_role';
  end if;
  if to_regprocedure('public.centralgo_operator_release_driver_vehicle(uuid)') is not null then
    execute 'revoke all on function public.centralgo_operator_release_driver_vehicle(uuid) from public,anon';
    execute 'grant execute on function public.centralgo_operator_release_driver_vehicle(uuid) to authenticated,service_role';
  end if;
  if to_regprocedure('public.centralgo_operator_set_driver_supermarket(uuid,boolean)') is not null then
    execute 'revoke all on function public.centralgo_operator_set_driver_supermarket(uuid,boolean) from public,anon';
    execute 'grant execute on function public.centralgo_operator_set_driver_supermarket(uuid,boolean) to authenticated,service_role';
  end if;
end;
$$;

-- Central GO: close internal SECURITY DEFINER helpers from API callers and pin search paths.

create or replace function public.centralgo_touch_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Trigger-only function: never callable through PostgREST.
revoke all on function public.centralgo_handle_new_user() from public, anon, authenticated;

-- Authorization helpers are used only from policies / trusted functions.
revoke all on function public.centralgo_is_super_admin() from public, anon, authenticated;
revoke all on function public.centralgo_is_company_member(uuid) from public, anon, authenticated;
revoke all on function public.centralgo_has_company_role(uuid, public.centralgo_company_role[]) from public, anon, authenticated;
revoke all on function public.centralgo_driver_id_for_user(uuid) from public, anon, authenticated;

-- Keep only intentional authenticated RPC entry points.
revoke all on function public.centralgo_driver_set_manual_status(uuid, public.centralgo_driver_status) from public, anon;
grant execute on function public.centralgo_driver_set_manual_status(uuid, public.centralgo_driver_status) to authenticated;

revoke all on function public.centralgo_driver_report_location(uuid, double precision, double precision, text, numeric, numeric, numeric) from public, anon;
grant execute on function public.centralgo_driver_report_location(uuid, double precision, double precision, text, numeric, numeric, numeric) to authenticated;

revoke all on function public.centralgo_driver_transition_trip(uuid, public.centralgo_trip_status) from public, anon;
grant execute on function public.centralgo_driver_transition_trip(uuid, public.centralgo_trip_status) to authenticated;

revoke all on function public.centralgo_write_audit(uuid, text, text, jsonb) from public, anon;
grant execute on function public.centralgo_write_audit(uuid, text, text, jsonb) to authenticated;

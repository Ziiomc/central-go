-- Keep the public operator cancellation entry point aligned with the hardened v2
-- implementation. Older migration history had an inline implementation here,
-- which meant clean rebuilds still rejected a harmless duplicate cancellation.

create or replace function public.centralgo_operator_cancel_trip(p_trip_id uuid, p_reason text)
returns public.trips
language plpgsql
security definer
set search_path = public
as $$
begin
  return public.centralgo_operator_cancel_trip_v2(p_trip_id,p_reason,'operator');
end;
$$;

revoke all on function public.centralgo_operator_cancel_trip(uuid,text) from public,anon;
grant execute on function public.centralgo_operator_cancel_trip(uuid,text) to authenticated;

revoke execute on function public.centralgo_driver_presence_ping(uuid) from anon, public;
revoke execute on function public.centralgo_driver_presence_end(uuid) from anon, public;
revoke execute on function public.centralgo_driver_analytics(uuid,timestamptz,timestamptz) from anon, public;
grant execute on function public.centralgo_driver_presence_ping(uuid) to authenticated;
grant execute on function public.centralgo_driver_presence_end(uuid) to authenticated;
grant execute on function public.centralgo_driver_analytics(uuid,timestamptz,timestamptz) to authenticated;

-- Internal trigger functions must not be callable as public RPC endpoints.
-- Trigger execution is unaffected by revoking EXECUTE from client roles.

revoke all on function public.centralgo_notify_active_operators_on_new_trip() from public, anon, authenticated;
grant execute on function public.centralgo_notify_active_operators_on_new_trip() to service_role;

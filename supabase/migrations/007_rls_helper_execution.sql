-- RLS policy helpers must be executable by authenticated because PostgreSQL evaluates them under the caller.
-- They remain SECURITY DEFINER with fixed search_path and expose no mutable operations.

grant execute on function public.centralgo_is_super_admin() to authenticated;
grant execute on function public.centralgo_is_company_member(uuid) to authenticated;
grant execute on function public.centralgo_has_company_role(uuid, public.centralgo_company_role[]) to authenticated;
grant execute on function public.centralgo_driver_id_for_user(uuid) to authenticated;

revoke all on function public.centralgo_is_super_admin() from anon;
revoke all on function public.centralgo_is_company_member(uuid) from anon;
revoke all on function public.centralgo_has_company_role(uuid, public.centralgo_company_role[]) from anon;
revoke all on function public.centralgo_driver_id_for_user(uuid) from anon;

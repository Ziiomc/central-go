create or replace function public.centralgo_superadmin_activation_requests()
returns jsonb
language plpgsql
security definer
stable
set search_path = public
as $$
begin
  if not public.centralgo_is_super_admin() then
    raise exception 'Solo Superadmin puede revisar solicitudes de activación' using errcode='42501';
  end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', ar.id,
      'userId', ar.user_id,
      'name', coalesce(p.name,'Usuario'),
      'email', coalesce(au.email,''),
      'accountKind', ar.account_kind,
      'companyId', ar.company_id,
      'companyName', c.name,
      'planCode', ar.plan_code,
      'planName', sp.name,
      'billingCycle', ar.billing_cycle,
      'status', ar.status,
      'createdAt', ar.created_at,
      'resolvedAt', ar.resolved_at
    ) order by case ar.status when 'pending' then 0 else 1 end, ar.created_at desc)
    from public.activation_requests ar
    join public.profiles p on p.id=ar.user_id
    left join auth.users au on au.id=ar.user_id
    left join public.companies c on c.id=ar.company_id
    left join public.subscription_plans sp on sp.code=ar.plan_code
    where ar.created_at >= now()-interval '180 days'
  ), '[]'::jsonb);
end;
$$;

revoke all on function public.centralgo_superadmin_activation_requests() from public,anon;
grant execute on function public.centralgo_superadmin_activation_requests() to authenticated;

create or replace function public.centralgo_visible_partners()
returns jsonb
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  viewer_partner uuid;
  viewer_kind public.centralgo_partner_kind;
  is_super boolean := public.centralgo_is_super_admin();
begin
  if not is_super then
    select id, kind into viewer_partner, viewer_kind
    from public.partners
    where user_id=auth.uid() and active
    limit 1;
    if viewer_partner is null or viewer_kind <> 'regional' then
      raise exception 'Sin permiso para visualizar el directorio de partners' using errcode='42501';
    end if;
  end if;

  return (
    select coalesce(jsonb_agg(jsonb_build_object(
      'id', p.id,
      'userId', p.user_id,
      'name', pr.name,
      'email', au.email,
      'phone', pr.phone,
      'kind', p.kind::text,
      'code', p.code,
      'commissionPercent', p.commission_percent,
      'active', p.active,
      'createdAt', p.created_at,
      'parentPartnerId', p.parent_partner_id,
      'parentName', parent_pr.name,
      'territories', coalesce(territories.items,'[]'::jsonb),
      'centralCount', coalesce(sales.central_count,0),
      'activeCentralCount', coalesce(sales.active_count,0),
      'monthlySales', coalesce(sales.monthly_sales,0),
      'pendingCommission', coalesce(comm.pending_amount,0),
      'availableCommission', coalesce(comm.available_amount,0),
      'paidCommission', coalesce(comm.paid_amount,0)
    ) order by case when p.kind='regional' then 0 else 1 end, p.created_at), '[]'::jsonb)
    from public.partners p
    join public.profiles pr on pr.id=p.user_id
    left join auth.users au on au.id=p.user_id
    left join public.partners parent on parent.id=p.parent_partner_id
    left join public.profiles parent_pr on parent_pr.id=parent.user_id
    left join lateral (
      select jsonb_agg(jsonb_build_object(
        'countryCode',pt.country_code,'region',pt.region,'city',pt.city,'exclusive',pt.exclusive
      ) order by pt.created_at) as items
      from public.partner_territories pt where pt.partner_id=p.id
    ) territories on true
    left join lateral (
      select count(*)::int as central_count,
             count(*) filter (where s.status='active')::int as active_count,
             coalesce(sum(case when s.status in ('trialing','active') then case when s.billing_cycle='annual' then sp.annual_price_clp::numeric/12 else sp.monthly_price_clp::numeric end else 0 end),0) as monthly_sales
      from public.referrals r
      left join public.subscriptions s on s.company_id=r.company_id
      left join public.subscription_plans sp on sp.id=s.plan_id
      where r.partner_id=p.id and r.active
    ) sales on true
    left join lateral (
      select coalesce(sum(amount) filter (where status in ('pending','confirmed')),0) as pending_amount,
             coalesce(sum(amount) filter (where status='available'),0) as available_amount,
             coalesce(sum(amount) filter (where status='paid'),0) as paid_amount
      from public.commission_ledger cl where cl.partner_id=p.id
    ) comm on true
    where is_super or p.id=viewer_partner or p.parent_partner_id=viewer_partner
  );
end;
$$;

create or replace function public.centralgo_superadmin_set_partner_status(p_partner_id uuid, p_active boolean)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.centralgo_is_super_admin() then
    raise exception 'Solo Superadmin puede activar o suspender partners' using errcode='42501';
  end if;
  update public.partners set active=p_active, updated_at=now() where id=p_partner_id;
  if not found then raise exception 'Partner no encontrado' using errcode='P0002'; end if;
  return p_active;
end;
$$;

revoke all on function public.centralgo_visible_partners() from public,anon;
revoke all on function public.centralgo_superadmin_set_partner_status(uuid,boolean) from public,anon;
grant execute on function public.centralgo_visible_partners() to authenticated;
grant execute on function public.centralgo_superadmin_set_partner_status(uuid,boolean) to authenticated;

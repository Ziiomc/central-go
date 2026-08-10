-- Central GO official commercial operations: plans, partner visibility, provisioning and user directory.

update public.subscription_plans
set
  recommended = (code = 'enterprise'),
  sort_order = case code when 'start' then 10 when 'pro' then 20 when 'enterprise' then 30 else sort_order end,
  features = case code
    when 'start' then jsonb_build_object(
      'description','Digitalización esencial para centrales pequeñas',
      'dispatch_map',true,
      'driver_app',false,
      'live_gps',false,
      'advanced_reports',false,
      'multi_branch',false,
      'api_integrations',false,
      'priority_support',false,
      'onboarding_sla',false,
      'regional_executive',false,
      'client_history','60 días',
      'sales_highlight','Despacho digital con hasta 10 móviles y 2 operadoras'
    )
    when 'pro' then jsonb_build_object(
      'description','Operación completa para centrales en crecimiento',
      'dispatch_map',true,
      'driver_app',true,
      'live_gps',true,
      'advanced_reports',true,
      'multi_branch',false,
      'api_integrations',false,
      'priority_support',true,
      'onboarding_sla',false,
      'regional_executive',false,
      'client_history','Completo',
      'sales_highlight','App de conductores, GPS en vivo y operación completa hasta 50 móviles'
    )
    when 'enterprise' then jsonb_build_object(
      'description','Control total para redes que quieren crecer sin límites',
      'dispatch_map',true,
      'driver_app',true,
      'live_gps',true,
      'advanced_reports',true,
      'multi_branch',true,
      'api_integrations',true,
      'priority_support',true,
      'onboarding_sla',true,
      'regional_executive',true,
      'client_history','Completo',
      'sales_highlight','Flota ilimitada, múltiples sedes, integraciones y acompañamiento preferente'
    )
    else features
  end
where code in ('start','pro','enterprise');

create or replace function public.centralgo_visible_network_centrals()
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
    select p.id, p.kind into viewer_partner, viewer_kind
    from public.partners p
    where p.user_id = auth.uid() and p.active
    limit 1;
    if viewer_partner is null then
      raise exception 'Sin permiso para visualizar la red comercial' using errcode='42501';
    end if;
  end if;

  return (
    with scoped as (
      select c.*, r.partner_id
      from public.companies c
      left join public.referrals r on r.company_id=c.id and r.active
      where is_super
         or r.partner_id = viewer_partner
         or (
           viewer_kind = 'regional' and exists (
             select 1 from public.partners child
             where child.id = r.partner_id
               and child.parent_partner_id = viewer_partner
               and child.active
           )
         )
    )
    select coalesce(jsonb_agg(
      jsonb_build_object(
        'id', c.id,
        'name', c.name,
        'code', c.code,
        'phone', c.phone,
        'address', c.address,
        'city', c.city,
        'countryCode', c.country_code,
        'active', c.active,
        'createdAt', c.created_at,
        'ownerName', owner_info.name,
        'ownerEmail', owner_info.email,
        'vehicles', coalesce(vehicle_info.count,0),
        'operators', coalesce(operator_info.count,0),
        'planCode', sub_info.plan_code,
        'planName', sub_info.plan_name,
        'monthlyPrice', sub_info.monthly_price,
        'annualPrice', sub_info.annual_price,
        'billingCycle', sub_info.billing_cycle,
        'subscriptionStatus', sub_info.status,
        'trialEndsAt', sub_info.trial_ends_at,
        'currentPeriodEnd', sub_info.current_period_end,
        'partnerName', partner_info.name,
        'partnerCode', partner_info.code,
        'regionalPartnerName', partner_info.regional_name
      ) order by c.created_at desc
    ), '[]'::jsonb)
    from scoped c
    left join lateral (
      select pr.name, au.email
      from public.company_memberships cm
      join public.profiles pr on pr.id=cm.user_id
      left join auth.users au on au.id=cm.user_id
      where cm.company_id=c.id and cm.role='company_admin' and cm.active
      order by cm.created_at asc
      limit 1
    ) owner_info on true
    left join lateral (
      select count(*)::int as count from public.vehicles v where v.company_id=c.id
    ) vehicle_info on true
    left join lateral (
      select count(*)::int as count from public.company_memberships cm where cm.company_id=c.id and cm.role='operator' and cm.active
    ) operator_info on true
    left join lateral (
      select sp.code as plan_code, sp.name as plan_name, sp.monthly_price_clp as monthly_price,
             sp.annual_price_clp as annual_price, s.billing_cycle::text as billing_cycle,
             s.status::text as status, s.trial_ends_at, s.current_period_end
      from public.subscriptions s
      join public.subscription_plans sp on sp.id=s.plan_id
      where s.company_id=c.id
      order by s.created_at desc
      limit 1
    ) sub_info on true
    left join lateral (
      select pp.code,
             pprofile.name,
             rprofile.name as regional_name
      from public.partners pp
      join public.profiles pprofile on pprofile.id=pp.user_id
      left join public.partners parent on parent.id=pp.parent_partner_id
      left join public.profiles rprofile on rprofile.id=parent.user_id
      where pp.id=c.partner_id
      limit 1
    ) partner_info on true
  );
end;
$$;

create or replace function public.centralgo_partner_dashboard()
returns jsonb
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  p public.partners%rowtype;
  territory jsonb;
  centrals jsonb;
  monthly_sales numeric := 0;
  pending_commission numeric := 0;
  available_commission numeric := 0;
  paid_commission numeric := 0;
  team_count integer := 0;
begin
  select * into p from public.partners where user_id=auth.uid() and active limit 1;
  if not found then
    return jsonb_build_object('configured',false,'centrals','[]'::jsonb,'territories','[]'::jsonb);
  end if;

  centrals := public.centralgo_visible_network_centrals();

  select coalesce(jsonb_agg(jsonb_build_object(
    'countryCode',pt.country_code,'region',pt.region,'city',pt.city,'exclusive',pt.exclusive
  ) order by pt.created_at),'[]'::jsonb)
  into territory
  from public.partner_territories pt where pt.partner_id=p.id;

  select coalesce(sum(
    case when s.billing_cycle='annual' then sp.annual_price_clp::numeric/12 else sp.monthly_price_clp::numeric end
  ),0)
  into monthly_sales
  from public.referrals r
  join public.subscriptions s on s.company_id=r.company_id and s.status in ('trialing','active')
  join public.subscription_plans sp on sp.id=s.plan_id
  where r.active and (
    r.partner_id=p.id or (p.kind='regional' and exists(select 1 from public.partners child where child.id=r.partner_id and child.parent_partner_id=p.id and child.active))
  );

  select
    coalesce(sum(amount) filter (where status in ('pending','confirmed')),0),
    coalesce(sum(amount) filter (where status='available'),0),
    coalesce(sum(amount) filter (where status='paid'),0)
  into pending_commission, available_commission, paid_commission
  from public.commission_ledger where partner_id=p.id;

  if p.kind='regional' then
    select count(*)::int into team_count from public.partners where parent_partner_id=p.id and active;
  end if;

  return jsonb_build_object(
    'configured',true,
    'id',p.id,
    'kind',p.kind::text,
    'code',p.code,
    'commissionPercent',p.commission_percent,
    'territories',territory,
    'centrals',centrals,
    'centralCount',jsonb_array_length(centrals),
    'monthlySales',monthly_sales,
    'pendingCommission',pending_commission,
    'availableCommission',available_commission,
    'paidCommission',paid_commission,
    'teamCount',team_count
  );
end;
$$;

create or replace function public.centralgo_partner_create_company(
  p_name text,
  p_code text,
  p_city text,
  p_country_code text default 'CL',
  p_phone text default null,
  p_address text default null,
  p_plan_code text default 'enterprise',
  p_billing_cycle public.centralgo_billing_cycle default 'annual',
  p_owner_email text default null,
  p_trial_days integer default 14
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  partner_row public.partners%rowtype;
  selected_plan uuid;
  new_company_id uuid;
  owner_user uuid;
  owner_assigned boolean := false;
begin
  select * into partner_row from public.partners where user_id=auth.uid() and active limit 1;
  if not found then raise exception 'Solo un partner activo puede registrar centrales desde este flujo' using errcode='42501'; end if;
  if length(trim(coalesce(p_name,''))) < 2 then raise exception 'Nombre de central inválido' using errcode='22023'; end if;
  if length(trim(coalesce(p_code,''))) < 2 then raise exception 'Código de central inválido' using errcode='22023'; end if;
  if p_trial_days < 1 or p_trial_days > 30 then raise exception 'Días de prueba inválidos' using errcode='22023'; end if;

  select id into selected_plan from public.subscription_plans where code=lower(trim(p_plan_code)) and active limit 1;
  if selected_plan is null then raise exception 'Plan no encontrado' using errcode='22023'; end if;

  insert into public.companies(name,code,phone,address,city,country_code,active)
  values(trim(p_name),upper(trim(p_code)),nullif(trim(coalesce(p_phone,'')),''),nullif(trim(coalesce(p_address,'')),''),
         nullif(trim(coalesce(p_city,'')),''),upper(left(trim(coalesce(p_country_code,'CL')),2)),true)
  returning id into new_company_id;

  insert into public.subscriptions(company_id,plan_id,billing_cycle,status,trial_ends_at,current_period_end)
  values(new_company_id,selected_plan,p_billing_cycle,'trialing',now()+make_interval(days=>p_trial_days),
         case when p_billing_cycle='annual' then now()+interval '1 year' else now()+interval '1 month' end);

  insert into public.referrals(partner_id,company_id,active) values(partner_row.id,new_company_id,true);
  insert into public.fare_configs(company_id) values(new_company_id) on conflict(company_id) do nothing;

  if nullif(trim(coalesce(p_owner_email,'')),'') is not null then
    select id into owner_user from auth.users where lower(email)=lower(trim(p_owner_email)) limit 1;
    if owner_user is not null and exists(select 1 from public.profiles where id=owner_user and active) then
      insert into public.company_memberships(company_id,user_id,role,active)
      values(new_company_id,owner_user,'company_admin',true)
      on conflict(company_id,user_id,role) do update set active=true;
      owner_assigned := true;
    end if;
  end if;

  perform public.centralgo_write_audit(new_company_id,'PARTNER_CREAR_CENTRAL',format('Partner %s registró central %s',partner_row.code,trim(p_name)));
  return jsonb_build_object('companyId',new_company_id,'ownerAssigned',owner_assigned,'partnerCode',partner_row.code);
end;
$$;

create or replace function public.centralgo_company_user_directory(p_company_id uuid)
returns jsonb
language plpgsql
security definer
stable
set search_path = public
as $$
begin
  if not (public.centralgo_is_super_admin() or public.centralgo_has_company_role(p_company_id,array['company_admin']::public.centralgo_company_role[])) then
    raise exception 'Sin permiso para administrar usuarios de esta central' using errcode='42501';
  end if;
  return (
    select coalesce(jsonb_agg(jsonb_build_object(
      'userId',cm.user_id,
      'name',pr.name,
      'email',au.email,
      'phone',pr.phone,
      'role',cm.role::text,
      'active',cm.active,
      'createdAt',cm.created_at
    ) order by cm.created_at asc),'[]'::jsonb)
    from public.company_memberships cm
    join public.profiles pr on pr.id=cm.user_id
    left join auth.users au on au.id=cm.user_id
    where cm.company_id=p_company_id
  );
end;
$$;

create or replace function public.centralgo_superadmin_set_company_status(
  p_company_id uuid,
  p_status public.centralgo_subscription_status
)
returns public.centralgo_subscription_status
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.centralgo_is_super_admin() then raise exception 'Solo Superadmin puede cambiar el estado comercial de una central' using errcode='42501'; end if;
  update public.subscriptions
  set status=p_status,
      current_period_start=case when p_status='active' then now() else current_period_start end,
      current_period_end=case when p_status='active' then (case when billing_cycle='annual' then now()+interval '1 year' else now()+interval '1 month' end) else current_period_end end,
      updated_at=now()
  where company_id=p_company_id;
  if not found then raise exception 'Suscripción no encontrada' using errcode='P0002'; end if;
  update public.companies set active=(p_status in ('trialing','active','past_due')),updated_at=now() where id=p_company_id;
  return p_status;
end;
$$;

revoke all on function public.centralgo_visible_network_centrals() from public,anon;
revoke all on function public.centralgo_partner_dashboard() from public,anon;
revoke all on function public.centralgo_partner_create_company(text,text,text,text,text,text,text,public.centralgo_billing_cycle,text,integer) from public,anon;
revoke all on function public.centralgo_company_user_directory(uuid) from public,anon;
revoke all on function public.centralgo_superadmin_set_company_status(uuid,public.centralgo_subscription_status) from public,anon;

grant execute on function public.centralgo_visible_network_centrals() to authenticated;
grant execute on function public.centralgo_partner_dashboard() to authenticated;
grant execute on function public.centralgo_partner_create_company(text,text,text,text,text,text,text,public.centralgo_billing_cycle,text,integer) to authenticated;
grant execute on function public.centralgo_company_user_directory(uuid) to authenticated;
grant execute on function public.centralgo_superadmin_set_company_status(uuid,public.centralgo_subscription_status) to authenticated;

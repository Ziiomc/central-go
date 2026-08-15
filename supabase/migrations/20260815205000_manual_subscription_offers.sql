-- Central GO · gestión de suscripciones manuales y ofertas especiales.
-- Separa compromiso comercial (mensual/anual) de frecuencia de pago (mensual/anual).

alter table public.subscriptions
  add column if not exists payment_frequency public.centralgo_billing_cycle,
  add column if not exists discount_percent numeric(5,2) not null default 0,
  add column if not exists list_amount_clp integer,
  add column if not exists effective_amount_clp integer,
  add column if not exists offer_label text,
  add column if not exists offer_notes text,
  add column if not exists commitment_end_at timestamptz,
  add column if not exists manual_activation boolean not null default false,
  add column if not exists activated_by uuid references public.profiles(id) on delete set null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname='subscriptions_discount_percent_check'
      and conrelid='public.subscriptions'::regclass
  ) then
    alter table public.subscriptions
      add constraint subscriptions_discount_percent_check
      check (discount_percent >= 0 and discount_percent <= 100);
  end if;
end $$;

create index if not exists subscriptions_activated_by_idx on public.subscriptions(activated_by);
create index if not exists subscriptions_commitment_end_idx on public.subscriptions(commitment_end_at) where commitment_end_at is not null;

update public.subscriptions s
set payment_frequency = coalesce(s.payment_frequency, s.billing_cycle),
    list_amount_clp = coalesce(
      s.list_amount_clp,
      case when s.billing_cycle='annual' then sp.annual_price_clp else sp.monthly_price_clp end
    ),
    effective_amount_clp = coalesce(
      s.effective_amount_clp,
      case when s.billing_cycle='annual' then sp.annual_price_clp else sp.monthly_price_clp end
    ),
    commitment_end_at = coalesce(
      s.commitment_end_at,
      s.current_period_end,
      case when s.billing_cycle='annual' then s.current_period_start + interval '1 year' else s.current_period_start + interval '1 month' end
    )
from public.subscription_plans sp
where sp.id=s.plan_id;

create or replace function public.centralgo_superadmin_manual_subscription(
  p_company_id uuid,
  p_plan_code text,
  p_term public.centralgo_billing_cycle,
  p_payment_frequency public.centralgo_billing_cycle,
  p_discount_percent numeric default 0,
  p_offer_label text default null,
  p_offer_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  plan public.subscription_plans%rowtype;
  existing public.subscriptions%rowtype;
  normalized_discount numeric(5,2) := round(coalesce(p_discount_percent,0)::numeric,2);
  base_amount integer;
  final_amount integer;
  period_end timestamptz;
  commitment_end timestamptz;
  sub_id uuid;
  actor_name text;
begin
  if auth.uid() is null or not public.centralgo_is_super_admin() then
    raise exception 'Solo Superadmin puede activar o modificar suscripciones manualmente' using errcode='42501';
  end if;

  if not exists(select 1 from public.companies c where c.id=p_company_id) then
    raise exception 'Central no encontrada' using errcode='P0002';
  end if;

  if p_term='monthly' and p_payment_frequency<>'monthly' then
    raise exception 'Una suscripción mensual debe cobrarse mensualmente' using errcode='22023';
  end if;

  if normalized_discount < 0 or normalized_discount > 100 then
    raise exception 'El descuento debe estar entre 0 y 100%%' using errcode='22023';
  end if;

  select * into plan
  from public.subscription_plans
  where code=lower(trim(coalesce(p_plan_code,''))) and active
  limit 1;
  if not found then
    raise exception 'Selecciona un plan válido' using errcode='22023';
  end if;

  select * into existing from public.subscriptions where company_id=p_company_id for update;

  if p_term='annual' and p_payment_frequency='monthly' then
    base_amount := round(plan.annual_price_clp::numeric/12)::integer;
  elsif p_term='annual' then
    base_amount := plan.annual_price_clp;
  else
    base_amount := plan.monthly_price_clp;
  end if;

  final_amount := greatest(0, round(base_amount::numeric * (1 - normalized_discount/100))::integer);
  if final_amount <= 0 then
    raise exception 'El valor final de la suscripción debe ser mayor que cero' using errcode='22023';
  end if;

  period_end := case when p_payment_frequency='annual' then now()+interval '1 year' else now()+interval '1 month' end;

  if p_term='annual' then
    if existing.id is not null and existing.billing_cycle='annual' and existing.commitment_end_at is not null and existing.commitment_end_at > now() then
      commitment_end := existing.commitment_end_at;
    else
      commitment_end := now()+interval '1 year';
    end if;
  else
    commitment_end := period_end;
  end if;

  insert into public.subscriptions(
    company_id,plan_id,billing_cycle,payment_frequency,status,current_period_start,current_period_end,
    commitment_end_at,discount_percent,list_amount_clp,effective_amount_clp,offer_label,offer_notes,
    manual_activation,activated_by,trial_ends_at,cancel_at_period_end,updated_at
  ) values (
    p_company_id,plan.id,p_term,p_payment_frequency,'active',now(),period_end,
    commitment_end,normalized_discount,base_amount,final_amount,nullif(trim(coalesce(p_offer_label,'')),''),
    nullif(trim(coalesce(p_offer_notes,'')),''),true,auth.uid(),null,false,now()
  )
  on conflict(company_id) do update set
    plan_id=excluded.plan_id,
    billing_cycle=excluded.billing_cycle,
    payment_frequency=excluded.payment_frequency,
    status='active',
    current_period_start=excluded.current_period_start,
    current_period_end=excluded.current_period_end,
    commitment_end_at=excluded.commitment_end_at,
    discount_percent=excluded.discount_percent,
    list_amount_clp=excluded.list_amount_clp,
    effective_amount_clp=excluded.effective_amount_clp,
    offer_label=excluded.offer_label,
    offer_notes=excluded.offer_notes,
    manual_activation=true,
    activated_by=excluded.activated_by,
    trial_ends_at=null,
    cancel_at_period_end=false,
    updated_at=now()
  returning id into sub_id;

  update public.companies set active=true,updated_at=now() where id=p_company_id;

  update public.saas_accounts
  set status='active',activated_at=coalesce(activated_at,now()),current_period_end=period_end,updated_at=now()
  where company_id=p_company_id and account_kind='central';

  select name into actor_name from public.profiles where id=auth.uid();
  insert into public.audit_logs(user_id,user_name,user_role,action,description,metadata)
  values(
    auth.uid(),coalesce(actor_name,'Superadmin'),'super_admin','MANUAL_SUBSCRIPTION_ACTIVATED',
    format('Suscripción manual activada: %s · %s · pago %s',plan.name,p_term::text,p_payment_frequency::text),
    jsonb_build_object(
      'companyId',p_company_id,'subscriptionId',sub_id,'planCode',plan.code,'term',p_term::text,
      'paymentFrequency',p_payment_frequency::text,'discountPercent',normalized_discount,
      'listAmountClp',base_amount,'effectiveAmountClp',final_amount,'offerLabel',nullif(trim(coalesce(p_offer_label,'')),''),
      'commitmentEndAt',commitment_end,'nextBillingAt',period_end
    )
  );

  return jsonb_build_object(
    'activated',true,'subscriptionId',sub_id,'companyId',p_company_id,'planCode',plan.code,'planName',plan.name,
    'term',p_term::text,'paymentFrequency',p_payment_frequency::text,'discountPercent',normalized_discount,
    'listAmountClp',base_amount,'effectiveAmountClp',final_amount,'nextBillingAt',period_end,'commitmentEndAt',commitment_end
  );
end;
$$;

revoke all on function public.centralgo_superadmin_manual_subscription(uuid,text,public.centralgo_billing_cycle,public.centralgo_billing_cycle,numeric,text,text) from public, anon;
grant execute on function public.centralgo_superadmin_manual_subscription(uuid,text,public.centralgo_billing_cycle,public.centralgo_billing_cycle,numeric,text,text) to authenticated;

create or replace function public.centralgo_superadmin_activate_request(p_request_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  req public.activation_requests%rowtype;
  plan public.subscription_plans%rowtype;
  period_end timestamptz;
  amount integer;
begin
  if not public.centralgo_is_super_admin() then raise exception 'Solo Superadmin puede confirmar activaciones' using errcode='42501'; end if;
  select * into req from public.activation_requests where id=p_request_id for update;
  if not found or req.status<>'pending' then raise exception 'Solicitud no disponible' using errcode='P0002'; end if;
  period_end := case when req.billing_cycle='annual' then now()+interval '1 year' else now()+interval '1 month' end;

  if req.account_kind='central' then
    select * into plan from public.subscription_plans where code=req.plan_code and active limit 1;
    if not found then raise exception 'Plan no disponible' using errcode='P0002'; end if;
    amount := case when req.billing_cycle='annual' then plan.annual_price_clp else plan.monthly_price_clp end;
    update public.subscriptions set
      plan_id=plan.id,billing_cycle=req.billing_cycle,payment_frequency=req.billing_cycle,status='active',
      current_period_start=now(),current_period_end=period_end,commitment_end_at=period_end,
      discount_percent=0,list_amount_clp=amount,effective_amount_clp=amount,offer_label=null,offer_notes=null,
      manual_activation=false,activated_by=auth.uid(),trial_ends_at=null,cancel_at_period_end=false,updated_at=now()
    where company_id=req.company_id;
    update public.companies set active=true,updated_at=now() where id=req.company_id;
    update public.saas_accounts set status='active',activated_at=coalesce(activated_at,now()),current_period_end=period_end,updated_at=now() where user_id=req.user_id;
  else
    update public.saas_accounts set status='active',activated_at=coalesce(activated_at,now()),current_period_end=period_end,updated_at=now() where user_id=req.user_id;
  end if;

  update public.activation_requests set status='approved',resolved_at=now(),resolved_by=auth.uid() where id=req.id;
  return jsonb_build_object('activated',true,'accountKind',req.account_kind,'companyId',req.company_id,'periodEnd',period_end);
end;
$$;

create or replace function public.centralgo_superadmin_set_company_status(p_company_id uuid, p_status public.centralgo_subscription_status)
returns public.centralgo_subscription_status
language plpgsql
security definer
set search_path=public
as $$
begin
  if not public.centralgo_is_super_admin() then raise exception 'Solo Superadmin puede cambiar el estado comercial de una central' using errcode='42501'; end if;
  update public.subscriptions
  set status=p_status,
      current_period_start=case when p_status='active' then now() else current_period_start end,
      current_period_end=case when p_status='active' then (case when coalesce(payment_frequency,billing_cycle)='annual' then now()+interval '1 year' else now()+interval '1 month' end) else current_period_end end,
      updated_at=now()
  where company_id=p_company_id;
  if not found then raise exception 'Suscripción no encontrada' using errcode='P0002'; end if;
  update public.companies set active=(p_status in ('trialing','active','past_due')),updated_at=now() where id=p_company_id;
  return p_status;
end;
$$;

create or replace function public.centralgo_visible_network_centrals()
returns jsonb
language plpgsql
stable
security definer
set search_path=public
as $$
declare
  viewer_partner uuid;
  viewer_kind public.centralgo_partner_kind;
  is_super boolean := public.centralgo_is_super_admin();
begin
  if not is_super then
    select p.id,p.kind into viewer_partner,viewer_kind
    from public.partners p
    where p.user_id=auth.uid() and p.active and p.archived_at is null
    limit 1;
    if viewer_partner is null then raise exception 'Sin permiso para visualizar la red comercial' using errcode='42501'; end if;
  end if;

  return (
    with scoped as (
      select c.*,r.partner_id as referral_partner_id
      from public.companies c
      left join public.referrals r on r.company_id=c.id and r.active
      where is_super
         or r.partner_id=viewer_partner
         or (viewer_kind='regional' and exists(
           select 1 from public.partners child
           where child.id=r.partner_id and child.parent_partner_id=viewer_partner and child.active and child.archived_at is null
         ))
    )
    select coalesce(jsonb_agg(jsonb_build_object(
      'id',c.id,'name',c.name,'code',c.code,'phone',c.phone,'address',c.address,'city',c.city,'countryCode',c.country_code,
      'active',c.active,'createdAt',c.created_at,'ownerName',owner_info.name,'ownerEmail',owner_info.email,
      'vehicles',coalesce(vehicle_info.count,0),'operators',coalesce(operator_info.count,0),
      'planCode',sub_info.plan_code,'planName',sub_info.plan_name,'monthlyPrice',sub_info.monthly_price,'annualPrice',sub_info.annual_price,
      'billingCycle',sub_info.billing_cycle,'paymentFrequency',sub_info.payment_frequency,'subscriptionStatus',sub_info.status,
      'trialEndsAt',sub_info.trial_ends_at,'currentPeriodEnd',sub_info.current_period_end,'commitmentEndAt',sub_info.commitment_end_at,
      'discountPercent',sub_info.discount_percent,'listAmount',sub_info.list_amount,'effectiveAmount',sub_info.effective_amount,
      'monthlyEquivalent',sub_info.monthly_equivalent,'offerLabel',sub_info.offer_label,'offerNotes',sub_info.offer_notes,
      'manualActivation',sub_info.manual_activation,
      'partnerName',partner_info.name,'partnerCode',partner_info.code,'regionalPartnerName',partner_info.regional_name
    ) order by c.created_at desc),'[]'::jsonb)
    from scoped c
    left join lateral (
      select pr.name,au.email from public.company_memberships cm
      join public.profiles pr on pr.id=cm.user_id left join auth.users au on au.id=cm.user_id
      where cm.company_id=c.id and cm.role='company_admin' and cm.active order by cm.created_at asc limit 1
    ) owner_info on true
    left join lateral (select count(*)::int as count from public.vehicles v where v.company_id=c.id) vehicle_info on true
    left join lateral (select count(*)::int as count from public.company_memberships cm where cm.company_id=c.id and cm.role='operator' and cm.active) operator_info on true
    left join lateral (
      select sp.code as plan_code,sp.name as plan_name,sp.monthly_price_clp as monthly_price,sp.annual_price_clp as annual_price,
             s.billing_cycle::text as billing_cycle,coalesce(s.payment_frequency,s.billing_cycle)::text as payment_frequency,s.status::text as status,
             s.trial_ends_at,s.current_period_end,s.commitment_end_at,s.discount_percent,s.list_amount_clp as list_amount,
             s.effective_amount_clp as effective_amount,s.offer_label,s.offer_notes,s.manual_activation,
             case
               when s.effective_amount_clp is not null and coalesce(s.payment_frequency,s.billing_cycle)='monthly' then s.effective_amount_clp::numeric
               when s.effective_amount_clp is not null and coalesce(s.payment_frequency,s.billing_cycle)='annual' then s.effective_amount_clp::numeric/12
               when s.billing_cycle='annual' then sp.annual_price_clp::numeric/12
               else sp.monthly_price_clp::numeric
             end as monthly_equivalent
      from public.subscriptions s join public.subscription_plans sp on sp.id=s.plan_id
      where s.company_id=c.id order by s.created_at desc limit 1
    ) sub_info on true
    left join lateral (
      select pp.code,pprofile.name,rprofile.name as regional_name
      from public.partners pp join public.profiles pprofile on pprofile.id=pp.user_id
      left join public.partners parent on parent.id=pp.parent_partner_id and parent.archived_at is null
      left join public.profiles rprofile on rprofile.id=parent.user_id
      where pp.id=c.partner_id and pp.archived_at is null limit 1
    ) partner_info on true
  );
end;
$$;

create or replace function public.centralgo_partner_dashboard()
returns jsonb
language plpgsql
stable
security definer
set search_path=public
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
  select * into p from public.partners where user_id=auth.uid() and active and archived_at is null limit 1;
  if not found then return jsonb_build_object('configured',false,'centrals','[]'::jsonb,'territories','[]'::jsonb); end if;
  centrals := public.centralgo_visible_network_centrals();
  select coalesce(jsonb_agg(jsonb_build_object('countryCode',pt.country_code,'region',pt.region,'city',pt.city,'exclusive',pt.exclusive) order by pt.created_at),'[]'::jsonb)
    into territory from public.partner_territories pt where pt.partner_id=p.id;
  select coalesce(sum(case
      when s.effective_amount_clp is not null and coalesce(s.payment_frequency,s.billing_cycle)='monthly' then s.effective_amount_clp::numeric
      when s.effective_amount_clp is not null and coalesce(s.payment_frequency,s.billing_cycle)='annual' then s.effective_amount_clp::numeric/12
      when s.billing_cycle='annual' then sp.annual_price_clp::numeric/12
      else sp.monthly_price_clp::numeric end),0)
  into monthly_sales
  from public.referrals r join public.subscriptions s on s.company_id=r.company_id and s.status in ('trialing','active')
  join public.subscription_plans sp on sp.id=s.plan_id
  where r.active and (r.partner_id=p.id or (p.kind='regional' and exists(select 1 from public.partners child where child.id=r.partner_id and child.parent_partner_id=p.id and child.active and child.archived_at is null)));
  select coalesce(sum(amount) filter(where status in ('pending','confirmed')),0),coalesce(sum(amount) filter(where status='available'),0),coalesce(sum(amount) filter(where status='paid'),0)
    into pending_commission,available_commission,paid_commission from public.commission_ledger where partner_id=p.id;
  if p.kind='regional' then select count(*)::int into team_count from public.partners where parent_partner_id=p.id and active and archived_at is null; end if;
  return jsonb_build_object('configured',true,'id',p.id,'kind',p.kind::text,'code',p.code,'commissionPercent',p.commission_percent,
    'territories',territory,'centrals',centrals,'centralCount',jsonb_array_length(centrals),'monthlySales',monthly_sales,
    'pendingCommission',pending_commission,'availableCommission',available_commission,'paidCommission',paid_commission,'teamCount',team_count);
end;
$$;

create or replace function public.centralgo_visible_partners()
returns jsonb
language plpgsql
stable
security definer
set search_path=public
as $$
declare
  viewer_partner uuid;
  viewer_kind public.centralgo_partner_kind;
  is_super boolean := public.centralgo_is_super_admin();
begin
  if not is_super then
    select id,kind into viewer_partner,viewer_kind from public.partners where user_id=auth.uid() and active and archived_at is null limit 1;
    if viewer_partner is null or viewer_kind<>'regional' then raise exception 'Sin permiso para visualizar el directorio de partners' using errcode='42501'; end if;
  end if;
  return (
    select coalesce(jsonb_agg(jsonb_build_object(
      'id',p.id,'userId',p.user_id,'name',pr.name,'email',au.email,'phone',pr.phone,'kind',p.kind::text,'code',p.code,
      'commissionPercent',p.commission_percent,'active',p.active,'createdAt',p.created_at,'parentPartnerId',p.parent_partner_id,
      'parentName',parent_pr.name,'territories',coalesce(territories.items,'[]'::jsonb),'centralCount',coalesce(sales.central_count,0),
      'activeCentralCount',coalesce(sales.active_count,0),'monthlySales',coalesce(sales.monthly_sales,0),'pendingCommission',coalesce(comm.pending_amount,0),
      'availableCommission',coalesce(comm.available_amount,0),'paidCommission',coalesce(comm.paid_amount,0)
    ) order by case when p.kind='regional' then 0 else 1 end,p.created_at),'[]'::jsonb)
    from public.partners p join public.profiles pr on pr.id=p.user_id left join auth.users au on au.id=p.user_id
    left join public.partners parent on parent.id=p.parent_partner_id and parent.archived_at is null left join public.profiles parent_pr on parent_pr.id=parent.user_id
    left join lateral (select jsonb_agg(jsonb_build_object('countryCode',pt.country_code,'region',pt.region,'city',pt.city,'exclusive',pt.exclusive) order by pt.created_at) as items from public.partner_territories pt where pt.partner_id=p.id) territories on true
    left join lateral (
      select count(*)::int as central_count,count(*) filter(where s.status='active')::int as active_count,
             coalesce(sum(case when s.status in ('trialing','active') then case
               when s.effective_amount_clp is not null and coalesce(s.payment_frequency,s.billing_cycle)='monthly' then s.effective_amount_clp::numeric
               when s.effective_amount_clp is not null and coalesce(s.payment_frequency,s.billing_cycle)='annual' then s.effective_amount_clp::numeric/12
               when s.billing_cycle='annual' then sp.annual_price_clp::numeric/12 else sp.monthly_price_clp::numeric end else 0 end),0) as monthly_sales
      from public.referrals r left join public.subscriptions s on s.company_id=r.company_id left join public.subscription_plans sp on sp.id=s.plan_id
      where r.partner_id=p.id and r.active
    ) sales on true
    left join lateral (select coalesce(sum(amount) filter(where status in ('pending','confirmed')),0) as pending_amount,
      coalesce(sum(amount) filter(where status='available'),0) as available_amount,coalesce(sum(amount) filter(where status='paid'),0) as paid_amount
      from public.commission_ledger cl where cl.partner_id=p.id) comm on true
    where p.archived_at is null and (is_super or p.id=viewer_partner or p.parent_partner_id=viewer_partner)
  );
end;
$$;

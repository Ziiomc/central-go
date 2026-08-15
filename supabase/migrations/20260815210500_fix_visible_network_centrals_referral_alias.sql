-- Fix: centralgo_visible_network_centrals used the old c.partner_id alias after
-- the subscription-management update renamed the referral column to
-- referral_partner_id. This caused the entire Centrales de la red view to fail.

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
      where pp.id=c.referral_partner_id and pp.archived_at is null limit 1
    ) partner_info on true
  );
end;
$$;

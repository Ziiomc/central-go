-- Public onboarding is Partner Comercial only.
-- Partner accounts are free/permanent; five-day trials belong to registered centrals.

update public.saas_accounts
set status='active',
    activated_at=coalesce(activated_at, now()),
    current_period_end=null,
    updated_at=now()
where account_kind='sales_partner';

create or replace function public.centralgo_partner_access_allowed()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.centralgo_is_super_admin()
    or exists (
      select 1
      from public.partners p
      join public.profiles pr on pr.id=p.user_id
      where p.user_id=(select auth.uid())
        and p.kind='sales'
        and p.active
        and pr.active
        and pr.global_role='sales_partner'
    );
$$;

create or replace function public.centralgo_self_service_onboarding(
  p_account_kind text,
  p_name text,
  p_phone text default null,
  p_city text default null,
  p_country_code text default 'CL',
  p_company_name text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  profile_row public.profiles%rowtype;
  generated_partner_code text;
  partner_id uuid;
begin
  if uid is null then raise exception 'Debes iniciar sesión para crear tu cuenta' using errcode='42501'; end if;
  if p_account_kind <> 'sales_partner' then
    raise exception 'El registro público de Central GO es exclusivamente para Partner Comercial' using errcode='22023';
  end if;
  if length(trim(coalesce(p_name,''))) < 2 then raise exception 'Ingresa tu nombre' using errcode='22023'; end if;

  select * into profile_row from public.profiles where id=uid for update;
  if not found or not profile_row.active then raise exception 'Perfil no disponible' using errcode='42501'; end if;
  if profile_row.global_role='super_admin' then
    return jsonb_build_object('alreadyConfigured',true,'accountKind','super_admin');
  end if;
  if profile_row.global_role is not null
     or exists(select 1 from public.company_memberships m where m.user_id=uid and m.active)
     or exists(select 1 from public.partners p where p.user_id=uid) then
    raise exception 'Esta cuenta ya fue configurada. Cierra sesión y vuelve a entrar si no ves tu panel.' using errcode='23505';
  end if;

  update public.profiles
  set name=trim(p_name),
      phone=nullif(trim(coalesce(p_phone,'')),''),
      global_role='sales_partner'
  where id=uid;

  loop
    generated_partner_code := 'CGP-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,8));
    exit when not exists(select 1 from public.partners p where p.code=generated_partner_code);
  end loop;

  insert into public.partners(user_id,kind,code,commission_percent,parent_partner_id,active)
  values(uid,'sales',generated_partner_code,20,null,true)
  returning id into partner_id;

  insert into public.saas_accounts(
    user_id,account_kind,status,trial_started_at,trial_ends_at,activated_at,current_period_end
  ) values(
    uid,'sales_partner','active',now(),now(),now(),null
  )
  on conflict(user_id) do update
  set account_kind='sales_partner',
      company_id=null,
      status='active',
      activated_at=coalesce(public.saas_accounts.activated_at,now()),
      current_period_end=null,
      updated_at=now();

  return jsonb_build_object(
    'accountKind','sales_partner',
    'partnerId',partner_id,
    'partnerCode',generated_partner_code,
    'status','active',
    'paymentRequired',false
  );
end;
$$;

create or replace function public.centralgo_my_access_state()
returns jsonb
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  pr public.profiles%rowtype;
  member record;
  sub record;
  allowed boolean := false;
  days_left integer := 0;
begin
  if uid is null then return jsonb_build_object('authenticated',false,'allowed',false,'onboardingRequired',false); end if;
  select * into pr from public.profiles where id=uid;
  if not found or not pr.active then return jsonb_build_object('authenticated',true,'allowed',false,'status','suspended','onboardingRequired',false); end if;
  if pr.global_role='super_admin' then return jsonb_build_object('authenticated',true,'allowed',true,'accountKind','super_admin','status','active','onboardingRequired',false); end if;

  if pr.global_role in ('sales_partner','regional_partner') then
    allowed := exists(select 1 from public.partners p where p.user_id=uid and p.active);
    return jsonb_build_object(
      'authenticated',true,
      'allowed',allowed,
      'accountKind','sales_partner',
      'status',case when allowed then 'active' else 'suspended' end,
      'daysRemaining',0,
      'paymentRequired',false,
      'onboardingRequired',false
    );
  end if;

  select m.company_id,m.role::text as role into member
  from public.company_memberships m
  where m.user_id=uid and m.active
  order by case m.role when 'company_admin' then 1 when 'operator' then 2 else 3 end,m.created_at
  limit 1;

  if member.company_id is null then
    return jsonb_build_object('authenticated',true,'allowed',false,'status','new','onboardingRequired',true,'paymentRequired',false);
  end if;

  select s.status::text as status,s.trial_ends_at,s.current_period_end,sp.code as plan_code,sp.name as plan_name
  into sub
  from public.subscriptions s join public.subscription_plans sp on sp.id=s.plan_id
  where s.company_id=member.company_id
  order by s.created_at desc limit 1;

  if sub.status is null then
    return jsonb_build_object('authenticated',true,'allowed',true,'accountKind','central_user','companyId',member.company_id,'companyRole',member.role,'status','legacy','onboardingRequired',false,'paymentRequired',false);
  end if;

  allowed := (sub.status='trialing' and sub.trial_ends_at>now()) or (sub.status='active' and (sub.current_period_end is null or sub.current_period_end>now()));
  if sub.status='trialing' and sub.trial_ends_at>now() then days_left := greatest(1,ceil(extract(epoch from (sub.trial_ends_at-now()))/86400.0)::int); end if;
  return jsonb_build_object('authenticated',true,'allowed',allowed,'accountKind','central','companyId',member.company_id,'companyRole',member.role,'status',case when sub.status='trialing' and not allowed then 'expired' else sub.status end,'trialEndsAt',sub.trial_ends_at,'currentPeriodEnd',sub.current_period_end,'daysRemaining',days_left,'planCode',sub.plan_code,'planName',sub.plan_name,'paymentRequired',not allowed,'onboardingRequired',false);
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
  p_trial_days integer default 5
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
  trial_end timestamptz := now()+interval '5 days';
begin
  select p.* into partner_row
  from public.partners p
  join public.profiles pr on pr.id=p.user_id
  where p.user_id=auth.uid()
    and p.kind='sales'
    and p.active
    and pr.active
    and pr.global_role='sales_partner'
  limit 1;
  if not found then raise exception 'Solo un Partner Comercial activo puede registrar centrales' using errcode='42501'; end if;
  if length(trim(coalesce(p_name,''))) < 2 then raise exception 'Nombre de central inválido' using errcode='22023'; end if;
  if length(trim(coalesce(p_code,''))) < 2 then raise exception 'Código de central inválido' using errcode='22023'; end if;

  select id into selected_plan from public.subscription_plans where code=lower(trim(p_plan_code)) and active limit 1;
  if selected_plan is null then raise exception 'Plan no encontrado' using errcode='22023'; end if;

  insert into public.companies(name,code,phone,address,city,country_code,active)
  values(trim(p_name),upper(trim(p_code)),nullif(trim(coalesce(p_phone,'')),''),nullif(trim(coalesce(p_address,'')),''),
         nullif(trim(coalesce(p_city,'')),''),upper(left(trim(coalesce(p_country_code,'CL')),2)),true)
  returning id into new_company_id;

  insert into public.subscriptions(company_id,plan_id,billing_cycle,status,trial_ends_at,current_period_end)
  values(new_company_id,selected_plan,p_billing_cycle,'trialing',trial_end,trial_end);

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

  perform public.centralgo_write_audit(new_company_id,'PARTNER_CREAR_CENTRAL',format('Partner Comercial %s registró central %s',partner_row.code,trim(p_name)));
  return jsonb_build_object('companyId',new_company_id,'ownerAssigned',owner_assigned,'partnerCode',partner_row.code,'trialDays',5,'trialEndsAt',trial_end);
end;
$$;

revoke all on function public.centralgo_partner_access_allowed() from public,anon,authenticated;
grant execute on function public.centralgo_partner_access_allowed() to authenticated;

revoke all on function public.centralgo_self_service_onboarding(text,text,text,text,text,text) from public,anon;
grant execute on function public.centralgo_self_service_onboarding(text,text,text,text,text,text) to authenticated;

revoke all on function public.centralgo_my_access_state() from public,anon;
grant execute on function public.centralgo_my_access_state() to authenticated;

revoke all on function public.centralgo_partner_create_company(text,text,text,text,text,text,text,public.centralgo_billing_cycle,text,integer) from public,anon;
grant execute on function public.centralgo_partner_create_company(text,text,text,text,text,text,text,public.centralgo_billing_cycle,text,integer) to authenticated;

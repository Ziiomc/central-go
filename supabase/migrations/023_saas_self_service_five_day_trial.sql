-- Central GO SaaS self-service onboarding and five-day access control.
-- Public registration supports only Central and Partner Comercial.

create table public.saas_accounts (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  account_kind text not null check (account_kind in ('central','sales_partner')),
  company_id uuid references public.companies(id) on delete cascade,
  status public.centralgo_subscription_status not null default 'trialing',
  trial_started_at timestamptz not null default now(),
  trial_ends_at timestamptz not null default (now() + interval '5 days'),
  activated_at timestamptz,
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint saas_accounts_trial_window check (trial_ends_at >= trial_started_at)
);
create unique index saas_accounts_company_unique on public.saas_accounts(company_id) where company_id is not null;
create index saas_accounts_status_idx on public.saas_accounts(status, trial_ends_at);
create trigger saas_accounts_touch before update on public.saas_accounts for each row execute function public.centralgo_touch_updated_at();

create table public.activation_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  company_id uuid references public.companies(id) on delete cascade,
  account_kind text not null check (account_kind in ('central','sales_partner')),
  plan_code text,
  billing_cycle public.centralgo_billing_cycle not null default 'annual',
  status text not null default 'pending' check (status in ('pending','approved','rejected','cancelled')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references public.profiles(id) on delete set null
);
create index activation_requests_user_status_idx on public.activation_requests(user_id,status,created_at desc);
create index activation_requests_company_idx on public.activation_requests(company_id,created_at desc) where company_id is not null;

alter table public.saas_accounts enable row level security;
alter table public.activation_requests enable row level security;

create policy saas_accounts_read_own on public.saas_accounts for select to authenticated
using (user_id = (select auth.uid()) or (select public.centralgo_is_super_admin()));
create policy activation_requests_read_own on public.activation_requests for select to authenticated
using (user_id = (select auth.uid()) or (select public.centralgo_is_super_admin()));

revoke all on table public.saas_accounts, public.activation_requests from anon, authenticated;
grant select on public.saas_accounts, public.activation_requests to authenticated;

-- Google returns full_name/name depending on the identity payload. Preserve both.
create or replace function public.centralgo_handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, name, phone, avatar_url)
  values (
    new.id,
    coalesce(
      nullif(new.raw_user_meta_data ->> 'name', ''),
      nullif(new.raw_user_meta_data ->> 'full_name', ''),
      split_part(coalesce(new.email, 'usuario'), '@', 1)
    ),
    nullif(new.raw_user_meta_data ->> 'phone', ''),
    nullif(new.raw_user_meta_data ->> 'avatar_url', '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- Existing partner accounts receive the same five-day transition window.
insert into public.saas_accounts(user_id,account_kind,status,trial_started_at,trial_ends_at)
select p.user_id,'sales_partner','trialing',now(),now()+interval '5 days'
from public.partners p
where p.active
on conflict(user_id) do nothing;

-- No trialing subscription can be issued for more than five days.
create or replace function public.centralgo_cap_trial_subscription()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.status = 'trialing' then
    if new.trial_ends_at is null then
      new.trial_ends_at := now() + interval '5 days';
    else
      new.trial_ends_at := least(new.trial_ends_at, now() + interval '5 days');
    end if;
    new.current_period_end := new.trial_ends_at;
  end if;
  return new;
end;
$$;

drop trigger if exists centralgo_subscription_trial_cap on public.subscriptions;
create trigger centralgo_subscription_trial_cap
before insert or update of status,trial_ends_at on public.subscriptions
for each row execute function public.centralgo_cap_trial_subscription();

-- Access helpers are SECURITY DEFINER so callers cannot forge subscription state.
create or replace function public.centralgo_company_access_allowed(target_company uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.centralgo_is_super_admin()
    or not exists (select 1 from public.subscriptions s0 where s0.company_id=target_company)
    or exists (
      select 1
      from public.subscriptions s
      where s.company_id=target_company
        and (
          (s.status='trialing' and s.trial_ends_at is not null and s.trial_ends_at > now())
          or (s.status='active' and (s.current_period_end is null or s.current_period_end > now()))
        )
    );
$$;

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
      select 1 from public.saas_accounts a
      where a.user_id=(select auth.uid())
        and a.account_kind='sales_partner'
        and (
          (a.status='trialing' and a.trial_ends_at > now())
          or (a.status='active' and (a.current_period_end is null or a.current_period_end > now()))
        )
    );
$$;

revoke all on function public.centralgo_company_access_allowed(uuid) from public,anon,authenticated;
revoke all on function public.centralgo_partner_access_allowed() from public,anon,authenticated;

-- Trial users see Enterprise capabilities while testing; expired trials get no entitlement.
create or replace function public.centralgo_plan_entitlements(target_company uuid)
returns table (
  plan_code text,
  max_vehicles integer,
  max_operators integer,
  driver_app_enabled boolean
)
language sql
security definer
stable
set search_path = public
as $$
  select sp.code, sp.max_vehicles, sp.max_operators, sp.driver_app_enabled
  from public.subscriptions s
  join public.subscription_plans sp on sp.id=s.plan_id
  where s.company_id=target_company
    and public.centralgo_company_access_allowed(target_company)
  order by s.created_at desc
  limit 1;
$$;

-- First authenticated Google login chooses one public account type exactly once.
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
  new_company uuid;
  selected_plan uuid;
  generated_code text;
  generated_partner_code text;
  partner_id uuid;
  trial_end timestamptz := now() + interval '5 days';
begin
  if uid is null then raise exception 'Debes iniciar sesión para crear tu cuenta' using errcode='42501'; end if;
  if p_account_kind not in ('central','sales_partner') then raise exception 'Tipo de cuenta inválido' using errcode='22023'; end if;
  if length(trim(coalesce(p_name,''))) < 2 then raise exception 'Ingresa tu nombre' using errcode='22023'; end if;

  select * into profile_row from public.profiles where id=uid for update;
  if not found or not profile_row.active then raise exception 'Perfil no disponible' using errcode='42501'; end if;
  if profile_row.global_role='super_admin' then
    return jsonb_build_object('alreadyConfigured',true,'accountKind','super_admin');
  end if;
  if profile_row.global_role is not null
     or exists(select 1 from public.company_memberships m where m.user_id=uid and m.active)
     or exists(select 1 from public.saas_accounts a where a.user_id=uid) then
    raise exception 'Esta cuenta ya fue configurada. Cierra sesión y vuelve a entrar si no ves tu panel.' using errcode='23505';
  end if;

  update public.profiles
  set name=trim(p_name), phone=nullif(trim(coalesce(p_phone,'')),'')
  where id=uid;

  if p_account_kind='central' then
    if length(trim(coalesce(p_company_name,''))) < 2 then raise exception 'Ingresa el nombre de la central' using errcode='22023'; end if;
    select id into selected_plan from public.subscription_plans where code='enterprise' and active limit 1;
    if selected_plan is null then raise exception 'Plan Enterprise no disponible' using errcode='P0002'; end if;

    loop
      generated_code := 'CG-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,8));
      exit when not exists(select 1 from public.companies c where c.code=generated_code);
    end loop;

    insert into public.companies(name,code,phone,city,country_code,active)
    values(
      trim(p_company_name),generated_code,nullif(trim(coalesce(p_phone,'')),''),
      nullif(trim(coalesce(p_city,'')),''),upper(left(trim(coalesce(p_country_code,'CL')),2)),true
    ) returning id into new_company;

    insert into public.subscriptions(company_id,plan_id,billing_cycle,status,trial_ends_at,current_period_end)
    values(new_company,selected_plan,'annual','trialing',trial_end,trial_end);

    insert into public.company_memberships(company_id,user_id,role,active)
    values(new_company,uid,'company_admin',true);

    insert into public.fare_configs(company_id) values(new_company) on conflict(company_id) do nothing;
    insert into public.saas_accounts(user_id,account_kind,company_id,status,trial_started_at,trial_ends_at)
    values(uid,'central',new_company,'trialing',now(),trial_end);

    perform public.centralgo_write_audit(new_company,'SAAS_REGISTRO_AUTOSERVICIO','Central creada desde registro público con prueba gratuita de 5 días');
    return jsonb_build_object('accountKind','central','companyId',new_company,'trialEndsAt',trial_end,'daysRemaining',5);
  end if;

  loop
    generated_partner_code := 'CGP-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,8));
    exit when not exists(select 1 from public.partners p where p.code=generated_partner_code);
  end loop;

  update public.profiles set global_role='sales_partner' where id=uid;
  insert into public.partners(user_id,kind,code,commission_percent,parent_partner_id,active)
  values(uid,'sales',generated_partner_code,20,null,true)
  returning id into partner_id;

  insert into public.saas_accounts(user_id,account_kind,status,trial_started_at,trial_ends_at)
  values(uid,'sales_partner','trialing',now(),trial_end);

  return jsonb_build_object('accountKind','sales_partner','partnerId',partner_id,'partnerCode',generated_partner_code,'trialEndsAt',trial_end,'daysRemaining',5);
end;
$$;

-- Single authoritative access state for frontend gates.
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
  acct public.saas_accounts%rowtype;
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
    select * into acct from public.saas_accounts where user_id=uid;
    if not found then return jsonb_build_object('authenticated',true,'allowed',false,'accountKind','sales_partner','status','expired','onboardingRequired',false,'paymentRequired',true); end if;
    allowed := (acct.status='trialing' and acct.trial_ends_at>now()) or (acct.status='active' and (acct.current_period_end is null or acct.current_period_end>now()));
    if acct.status='trialing' and acct.trial_ends_at>now() then days_left := greatest(1,ceil(extract(epoch from (acct.trial_ends_at-now()))/86400.0)::int); end if;
    return jsonb_build_object('authenticated',true,'allowed',allowed,'accountKind','sales_partner','status',case when acct.status='trialing' and not allowed then 'expired' else acct.status::text end,'trialEndsAt',acct.trial_ends_at,'daysRemaining',days_left,'paymentRequired',not allowed,'onboardingRequired',false);
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

-- Records commercial intent. Real payment provider can approve the request later.
create or replace function public.centralgo_request_activation(
  p_plan_code text default null,
  p_billing_cycle public.centralgo_billing_cycle default 'annual'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  acct public.saas_accounts%rowtype;
  target_company uuid;
  kind text;
  request_id uuid;
begin
  if uid is null then raise exception 'Sesión requerida' using errcode='42501'; end if;
  if exists(select 1 from public.profiles p where p.id=uid and p.global_role='super_admin') then raise exception 'Superadmin no requiere activación' using errcode='22023'; end if;

  select * into acct from public.saas_accounts where user_id=uid;
  if found and acct.account_kind='sales_partner' then
    kind := 'sales_partner';
    target_company := null;
    p_plan_code := null;
  else
    select m.company_id into target_company from public.company_memberships m where m.user_id=uid and m.role='company_admin' and m.active order by m.created_at limit 1;
    if target_company is null then raise exception 'Solo el administrador de la central puede solicitar un plan' using errcode='42501'; end if;
    kind := 'central';
    if not exists(select 1 from public.subscription_plans sp where sp.code=lower(trim(coalesce(p_plan_code,''))) and sp.active) then raise exception 'Selecciona un plan válido' using errcode='22023'; end if;
    p_plan_code := lower(trim(p_plan_code));
  end if;

  select ar.id into request_id from public.activation_requests ar
  where ar.user_id=uid and ar.status='pending'
  order by ar.created_at desc limit 1;
  if request_id is not null then return request_id; end if;

  insert into public.activation_requests(user_id,company_id,account_kind,plan_code,billing_cycle,status)
  values(uid,target_company,kind,p_plan_code,p_billing_cycle,'pending') returning id into request_id;
  return request_id;
end;
$$;

-- Temporary/manual activation path for Superadmin until the payment webhook is connected.
create or replace function public.centralgo_superadmin_activate_request(p_request_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  req public.activation_requests%rowtype;
  plan_id uuid;
  period_end timestamptz;
begin
  if not public.centralgo_is_super_admin() then raise exception 'Solo Superadmin puede confirmar activaciones' using errcode='42501'; end if;
  select * into req from public.activation_requests where id=p_request_id for update;
  if not found or req.status<>'pending' then raise exception 'Solicitud no disponible' using errcode='P0002'; end if;
  period_end := case when req.billing_cycle='annual' then now()+interval '1 year' else now()+interval '1 month' end;

  if req.account_kind='central' then
    select id into plan_id from public.subscription_plans where code=req.plan_code and active limit 1;
    if plan_id is null then raise exception 'Plan no disponible' using errcode='P0002'; end if;
    update public.subscriptions set plan_id=plan_id,billing_cycle=req.billing_cycle,status='active',current_period_start=now(),current_period_end=period_end,updated_at=now() where company_id=req.company_id;
    update public.companies set active=true,updated_at=now() where id=req.company_id;
    update public.saas_accounts set status='active',activated_at=coalesce(activated_at,now()),current_period_end=period_end where user_id=req.user_id;
  else
    update public.saas_accounts set status='active',activated_at=coalesce(activated_at,now()),current_period_end=period_end where user_id=req.user_id;
  end if;

  update public.activation_requests set status='approved',resolved_at=now(),resolved_by=auth.uid() where id=req.id;
  return jsonb_build_object('activated',true,'accountKind',req.account_kind,'companyId',req.company_id,'periodEnd',period_end);
end;
$$;

-- Prevent authenticated users from mutating an expired Central even through a direct API call.
create or replace function public.centralgo_guard_company_write()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_company uuid;
begin
  if auth.uid() is null or public.centralgo_is_super_admin() then return coalesce(new,old); end if;
  target_company := case when tg_op='DELETE' then old.company_id else new.company_id end;
  if target_company is null then return coalesce(new,old); end if;
  if not exists(select 1 from public.subscriptions s where s.company_id=target_company) then return coalesce(new,old); end if;
  if not public.centralgo_company_access_allowed(target_company) then
    raise exception 'La prueba gratuita terminó. Activa un plan para continuar operando Central GO.' using errcode='42501';
  end if;
  return coalesce(new,old);
end;
$$;

create or replace function public.centralgo_guard_company_record_write()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare target_company uuid := case when tg_op='DELETE' then old.id else new.id end;
begin
  if auth.uid() is null or public.centralgo_is_super_admin() then return coalesce(new,old); end if;
  if exists(select 1 from public.subscriptions s where s.company_id=target_company) and not public.centralgo_company_access_allowed(target_company) then
    raise exception 'La prueba gratuita terminó. Activa un plan para modificar la central.' using errcode='42501';
  end if;
  return coalesce(new,old);
end;
$$;

create or replace function public.centralgo_guard_company_insert_for_partner()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or public.centralgo_is_super_admin() then return new; end if;
  if exists(select 1 from public.partners p where p.user_id=auth.uid() and p.active) and not public.centralgo_partner_access_allowed() then
    raise exception 'Tu prueba de Partner Comercial terminó. Activa tu cuenta para registrar nuevas centrales.' using errcode='42501';
  end if;
  return new;
end;
$$;

-- Company-wide operational write guards.
do $$
declare t text;
begin
  foreach t in array array['company_memberships','vehicles','drivers','driver_locations','driver_location_history','clients','client_addresses','trips','fare_configs','sos_events','notifications','driver_settlements']
  loop
    execute format('drop trigger if exists centralgo_saas_access_guard on public.%I',t);
    execute format('create trigger centralgo_saas_access_guard before insert or update or delete on public.%I for each row execute function public.centralgo_guard_company_write()',t);
  end loop;
end $$;

drop trigger if exists centralgo_saas_company_record_guard on public.companies;
create trigger centralgo_saas_company_record_guard before update or delete on public.companies for each row execute function public.centralgo_guard_company_record_write();
drop trigger if exists centralgo_saas_partner_company_insert_guard on public.companies;
create trigger centralgo_saas_partner_company_insert_guard before insert on public.companies for each row execute function public.centralgo_guard_company_insert_for_partner();

revoke all on function public.centralgo_self_service_onboarding(text,text,text,text,text,text) from public,anon;
revoke all on function public.centralgo_my_access_state() from public,anon;
revoke all on function public.centralgo_request_activation(text,public.centralgo_billing_cycle) from public,anon;
revoke all on function public.centralgo_superadmin_activate_request(uuid) from public,anon,authenticated;
revoke all on function public.centralgo_guard_company_write() from public,anon,authenticated;
revoke all on function public.centralgo_guard_company_record_write() from public,anon,authenticated;
revoke all on function public.centralgo_guard_company_insert_for_partner() from public,anon,authenticated;
revoke all on function public.centralgo_cap_trial_subscription() from public,anon,authenticated;

grant execute on function public.centralgo_self_service_onboarding(text,text,text,text,text,text) to authenticated;
grant execute on function public.centralgo_my_access_state() to authenticated;
grant execute on function public.centralgo_request_activation(text,public.centralgo_billing_cycle) to authenticated;
grant execute on function public.centralgo_superadmin_activate_request(uuid) to authenticated;

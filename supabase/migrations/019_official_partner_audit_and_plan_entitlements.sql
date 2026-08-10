-- Allow authorized commercial partners to create audit records for their attributed companies,
-- then enforce paid-plan entitlements at the database layer.

create or replace function public.centralgo_write_audit(
  target_company uuid,
  p_action text,
  p_description text,
  p_metadata jsonb default '{}'::jsonb
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_name text;
  actor_role text;
  log_id bigint;
  partner_allowed boolean := false;
begin
  select exists (
    select 1
    from public.referrals r
    join public.partners referred on referred.id = r.partner_id and referred.active
    left join public.partners regional on regional.id = referred.parent_partner_id and regional.active
    where r.company_id = target_company
      and r.active
      and (referred.user_id = auth.uid() or regional.user_id = auth.uid())
  ) into partner_allowed;

  if not (
    public.centralgo_is_super_admin()
    or public.centralgo_is_company_member(target_company)
    or partner_allowed
  ) then
    raise exception 'Sin acceso a esta central' using errcode = '42501';
  end if;

  select p.name into actor_name from public.profiles p where p.id = auth.uid();
  select coalesce(
    (select m.role::text from public.company_memberships m
      where m.company_id = target_company and m.user_id = auth.uid() and m.active
      order by case m.role when 'company_admin' then 1 when 'operator' then 2 else 3 end
      limit 1),
    (select p.global_role::text from public.profiles p where p.id = auth.uid()),
    'authenticated'
  ) into actor_role;

  insert into public.audit_logs (
    company_id, user_id, user_name, user_role, action, description, metadata
  ) values (
    target_company, auth.uid(), actor_name, actor_role,
    left(trim(p_action), 120), left(trim(p_description), 2000), coalesce(p_metadata, '{}'::jsonb)
  ) returning id into log_id;

  return log_id;
end;
$$;

revoke all on function public.centralgo_write_audit(uuid,text,text,jsonb) from public, anon;
grant execute on function public.centralgo_write_audit(uuid,text,text,jsonb) to authenticated;

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
  join public.subscription_plans sp on sp.id = s.plan_id
  where s.company_id = target_company
    and s.status in ('trialing','active','past_due')
  order by s.created_at desc
  limit 1;
$$;

revoke all on function public.centralgo_plan_entitlements(uuid) from public, anon, authenticated;

create or replace function public.centralgo_enforce_vehicle_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  entitlement record;
  current_count integer;
begin
  select * into entitlement from public.centralgo_plan_entitlements(new.company_id);
  if not found or entitlement.max_vehicles is null then
    return new;
  end if;

  select count(*)::int into current_count
  from public.vehicles v
  where v.company_id = new.company_id
    and v.id <> new.id;

  if current_count >= entitlement.max_vehicles then
    raise exception 'El plan % admite un máximo de % móviles. Actualiza el plan para registrar más vehículos.', entitlement.plan_code, entitlement.max_vehicles
      using errcode = '23514';
  end if;
  return new;
end;
$$;

create or replace function public.centralgo_enforce_membership_entitlements()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  entitlement record;
  current_count integer;
begin
  if not new.active then
    return new;
  end if;

  select * into entitlement from public.centralgo_plan_entitlements(new.company_id);
  if not found then
    return new;
  end if;

  if new.role = 'driver' and not entitlement.driver_app_enabled then
    raise exception 'El plan % no incluye acceso a la app de conductores. Actualiza a Pro o Enterprise.', entitlement.plan_code
      using errcode = '23514';
  end if;

  if new.role = 'operator' and entitlement.max_operators is not null then
    select count(*)::int into current_count
    from public.company_memberships cm
    where cm.company_id = new.company_id
      and cm.role = 'operator'
      and cm.active
      and cm.id <> new.id;

    if current_count >= entitlement.max_operators then
      raise exception 'El plan % admite un máximo de % operadoras. Actualiza el plan para agregar más accesos.', entitlement.plan_code, entitlement.max_operators
        using errcode = '23514';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function public.centralgo_enforce_vehicle_limit() from public, anon, authenticated;
revoke all on function public.centralgo_enforce_membership_entitlements() from public, anon, authenticated;

drop trigger if exists centralgo_vehicle_plan_limit on public.vehicles;
create trigger centralgo_vehicle_plan_limit
before insert or update of company_id on public.vehicles
for each row execute function public.centralgo_enforce_vehicle_limit();

drop trigger if exists centralgo_membership_plan_entitlements on public.company_memberships;
create trigger centralgo_membership_plan_entitlements
before insert or update of company_id, role, active on public.company_memberships
for each row execute function public.centralgo_enforce_membership_entitlements();

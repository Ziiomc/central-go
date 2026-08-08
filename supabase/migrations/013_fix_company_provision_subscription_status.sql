create or replace function public.centralgo_superadmin_create_company(
  p_name text,
  p_code text,
  p_city text,
  p_country_code text default 'CL',
  p_phone text default null,
  p_address text default null,
  p_plan_code text default 'enterprise',
  p_billing_cycle public.centralgo_billing_cycle default 'annual',
  p_trial_days integer default 14,
  p_center_lat double precision default null,
  p_center_lng double precision default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_company_id uuid;
  selected_plan uuid;
  subscription_state public.centralgo_subscription_status;
begin
  if not public.centralgo_is_super_admin() then raise exception 'Solo Superadmin puede registrar centrales' using errcode='42501'; end if;
  if length(trim(coalesce(p_name,''))) < 2 then raise exception 'Nombre de central inválido' using errcode='22023'; end if;
  if length(trim(coalesce(p_code,''))) < 2 then raise exception 'Código de central inválido' using errcode='22023'; end if;
  if p_trial_days < 0 or p_trial_days > 90 then raise exception 'Días de prueba inválidos' using errcode='22023'; end if;
  if p_center_lat is not null and not p_center_lat between -90 and 90 then raise exception 'Latitud inválida' using errcode='22023'; end if;
  if p_center_lng is not null and not p_center_lng between -180 and 180 then raise exception 'Longitud inválida' using errcode='22023'; end if;

  select id into selected_plan from public.subscription_plans where code=lower(trim(p_plan_code)) and active limit 1;
  if selected_plan is null then raise exception 'Plan no encontrado' using errcode='22023'; end if;
  subscription_state := case when p_trial_days > 0 then 'trialing'::public.centralgo_subscription_status else 'active'::public.centralgo_subscription_status end;

  insert into public.companies(name, code, phone, address, city, country_code, center_lat, center_lng)
  values(trim(p_name), upper(trim(p_code)), nullif(trim(coalesce(p_phone,'')),''), nullif(trim(coalesce(p_address,'')),''),
         nullif(trim(coalesce(p_city,'')),''), upper(left(trim(coalesce(p_country_code,'CL')),2)), p_center_lat, p_center_lng)
  returning id into new_company_id;

  insert into public.subscriptions(company_id, plan_id, billing_cycle, status, trial_ends_at, current_period_end)
  values(new_company_id, selected_plan, p_billing_cycle, subscription_state,
         case when p_trial_days>0 then now() + make_interval(days=>p_trial_days) end,
         case when p_billing_cycle='annual' then now()+interval '1 year' else now()+interval '1 month' end);

  insert into public.fare_configs(company_id) values(new_company_id) on conflict (company_id) do nothing;
  perform public.centralgo_write_audit(new_company_id, 'CREAR_CENTRAL', format('Superadmin registró central %s (%s)', trim(p_name), upper(trim(p_code))));
  return new_company_id;
end;
$$;

revoke all on function public.centralgo_superadmin_create_company(text,text,text,text,text,text,text,public.centralgo_billing_cycle,integer,double precision,double precision) from public, anon;
grant execute on function public.centralgo_superadmin_create_company(text,text,text,text,text,text,text,public.centralgo_billing_cycle,integer,double precision,double precision) to authenticated;

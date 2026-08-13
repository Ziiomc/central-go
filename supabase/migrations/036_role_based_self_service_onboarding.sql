-- Central GO: unified, role-based public onboarding.
-- New users may create a central, request driver access, or become a sales partner.
-- Authorization remains server-side; user metadata is never trusted for permissions.

create table if not exists public.driver_applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  applicant_name text not null,
  phone text,
  license_number text not null,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  rejection_reason text,
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  driver_id uuid references public.drivers(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists driver_applications_company_status_idx
  on public.driver_applications(company_id,status,created_at desc);

drop trigger if exists driver_applications_touch on public.driver_applications;
create trigger driver_applications_touch
before update on public.driver_applications
for each row execute function public.centralgo_touch_updated_at();

alter table public.driver_applications enable row level security;

drop policy if exists driver_applications_read_authorized on public.driver_applications;
create policy driver_applications_read_authorized
on public.driver_applications for select to authenticated
using (
  user_id=(select auth.uid())
  or (select public.centralgo_is_super_admin())
  or (select public.centralgo_has_company_role(
    company_id,
    array['company_admin']::public.centralgo_company_role[]
  ))
);

revoke all on table public.driver_applications from public,anon,authenticated;
grant select on table public.driver_applications to authenticated;

-- Existing and future direct sales partners use the new 25% commercial rate.
-- Historical ledger entries keep the rate with which they were generated.
update public.partners
set commission_percent=25,
    updated_at=now()
where kind='sales'
  and commission_percent is distinct from 25;

create or replace function public.centralgo_complete_onboarding(
  p_account_kind text,
  p_name text,
  p_phone text default null,
  p_city text default null,
  p_country_code text default 'CL',
  p_company_name text default null,
  p_central_code text default null,
  p_license_number text default null
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  uid uuid := auth.uid();
  profile_row public.profiles%rowtype;
  normalized_kind text := lower(trim(coalesce(p_account_kind,'')));
  normalized_name text := trim(coalesce(p_name,''));
  normalized_phone text := nullif(trim(coalesce(p_phone,'')),'');
  normalized_country text := upper(left(trim(coalesce(p_country_code,'CL')),2));
  generated_code text;
  selected_plan uuid;
  new_company_id uuid;
  new_partner_id uuid;
  target_company public.companies%rowtype;
  application_row public.driver_applications%rowtype;
  trial_end timestamptz := now()+interval '5 days';
begin
  if uid is null then
    raise exception 'Debes iniciar sesión para configurar tu cuenta' using errcode='42501';
  end if;
  if normalized_kind not in ('central','driver','sales_partner') then
    raise exception 'Selecciona una forma válida de participar' using errcode='22023';
  end if;
  if length(normalized_name)<2 then
    raise exception 'Ingresa tu nombre completo' using errcode='22023';
  end if;

  select * into profile_row from public.profiles where id=uid for update;
  if not found or not profile_row.active then
    raise exception 'Tu perfil no está disponible' using errcode='42501';
  end if;
  if profile_row.global_role='super_admin' then
    return jsonb_build_object('alreadyConfigured',true,'accountKind','super_admin');
  end if;
  if profile_row.global_role is not null
     or exists(select 1 from public.company_memberships m where m.user_id=uid and m.active)
     or exists(select 1 from public.partners p where p.user_id=uid) then
    raise exception 'Esta cuenta ya está configurada. Cierra sesión y vuelve a entrar.' using errcode='23505';
  end if;

  update public.profiles
  set name=normalized_name,
      phone=normalized_phone
  where id=uid;

  if normalized_kind='central' then
    if length(trim(coalesce(p_company_name,'')))<2 then
      raise exception 'Ingresa el nombre de tu central' using errcode='22023';
    end if;
    if exists(select 1 from public.driver_applications a where a.user_id=uid and a.status<>'rejected') then
      raise exception 'Ya tienes una solicitud de conductor en curso' using errcode='23505';
    end if;

    select id into selected_plan
    from public.subscription_plans
    where code='enterprise' and active
    limit 1;
    if selected_plan is null then
      raise exception 'El plan de prueba completa no está disponible' using errcode='55000';
    end if;

    loop
      generated_code := 'CG-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,8));
      exit when not exists(select 1 from public.companies c where c.code=generated_code);
    end loop;

    insert into public.companies(name,code,phone,city,country_code,active)
    values(trim(p_company_name),generated_code,normalized_phone,nullif(trim(coalesce(p_city,'')),''),normalized_country,true)
    returning id into new_company_id;

    insert into public.company_memberships(company_id,user_id,role,active)
    values(new_company_id,uid,'company_admin',true);

    insert into public.subscriptions(
      company_id,plan_id,billing_cycle,status,trial_ends_at,current_period_end
    ) values(
      new_company_id,selected_plan,'monthly','trialing',trial_end,trial_end
    );

    insert into public.saas_accounts(
      user_id,account_kind,company_id,status,trial_started_at,trial_ends_at,current_period_end
    ) values(
      uid,'central',new_company_id,'trialing',now(),trial_end,trial_end
    )
    on conflict(user_id) do update
    set account_kind='central',
        company_id=excluded.company_id,
        status='trialing',
        trial_started_at=now(),
        trial_ends_at=trial_end,
        current_period_end=trial_end,
        updated_at=now();

    insert into public.fare_configs(company_id)
    values(new_company_id)
    on conflict(company_id) do nothing;

    perform public.centralgo_write_audit(
      new_company_id,
      'AUTOREGISTRO_CENTRAL',
      format('%s creó la central %s con prueba Enterprise de 5 días',normalized_name,trim(p_company_name))
    );

    return jsonb_build_object(
      'accountKind','central',
      'companyId',new_company_id,
      'companyCode',generated_code,
      'status','trialing',
      'trialDays',5,
      'trialEndsAt',trial_end,
      'planCode','enterprise'
    );
  end if;

  if normalized_kind='sales_partner' then
    loop
      generated_code := 'CGP-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,8));
      exit when not exists(select 1 from public.partners p where p.code=generated_code);
    end loop;

    update public.profiles set global_role='sales_partner' where id=uid;

    insert into public.partners(user_id,kind,code,commission_percent,parent_partner_id,active)
    values(uid,'sales',generated_code,25,null,true)
    returning id into new_partner_id;

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
      'partnerId',new_partner_id,
      'partnerCode',generated_code,
      'commissionPercent',25,
      'status','active',
      'paymentRequired',false
    );
  end if;

  if length(trim(coalesce(p_central_code,'')))<2 then
    raise exception 'Ingresa el código de la central a la que deseas unirte' using errcode='22023';
  end if;
  if length(trim(coalesce(p_license_number,'')))<3 then
    raise exception 'Ingresa un número de licencia válido' using errcode='22023';
  end if;

  select * into target_company
  from public.companies c
  where upper(c.code)=upper(trim(p_central_code)) and c.active
  limit 1;
  if not found then
    raise exception 'No encontramos una central activa con ese código' using errcode='P0002';
  end if;

  select * into application_row
  from public.driver_applications a
  where a.user_id=uid
  for update;

  if found and application_row.status='pending' then
    return jsonb_build_object(
      'accountKind','driver',
      'applicationId',application_row.id,
      'companyId',application_row.company_id,
      'status','pending',
      'alreadyConfigured',true
    );
  end if;
  if found and application_row.status='approved' then
    raise exception 'Tu solicitud ya fue aprobada. Vuelve a iniciar sesión.' using errcode='23505';
  end if;

  insert into public.driver_applications(
    user_id,company_id,applicant_name,phone,license_number,status,rejection_reason,reviewed_by,reviewed_at,driver_id
  ) values(
    uid,target_company.id,normalized_name,normalized_phone,upper(trim(p_license_number)),'pending',null,null,null,null
  )
  on conflict(user_id) do update
  set company_id=excluded.company_id,
      applicant_name=excluded.applicant_name,
      phone=excluded.phone,
      license_number=excluded.license_number,
      status='pending',
      rejection_reason=null,
      reviewed_by=null,
      reviewed_at=null,
      driver_id=null,
      updated_at=now()
  returning * into application_row;

  return jsonb_build_object(
    'accountKind','driver',
    'applicationId',application_row.id,
    'companyId',target_company.id,
    'companyName',target_company.name,
    'status','pending'
  );
end;
$$;

-- Keep the previous public endpoint compatible while routing every new account
-- through the same hardened rules and 25% partner rate.
create or replace function public.centralgo_self_service_onboarding(
  p_account_kind text,
  p_name text,
  p_phone text default null,
  p_city text default null,
  p_country_code text default 'CL',
  p_company_name text default null
)
returns jsonb
language sql
security invoker
set search_path=public
as $$
  select public.centralgo_complete_onboarding(
    p_account_kind,p_name,p_phone,p_city,p_country_code,p_company_name,null,null
  );
$$;

create or replace function public.centralgo_review_driver_application(
  p_application_id uuid,
  p_approve boolean,
  p_unit_number text default null,
  p_vehicle_id uuid default null,
  p_rejection_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  application_row public.driver_applications%rowtype;
  created_driver_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Debes iniciar sesión' using errcode='42501';
  end if;

  select * into application_row
  from public.driver_applications
  where id=p_application_id
  for update;
  if not found then
    raise exception 'Solicitud no encontrada' using errcode='P0002';
  end if;
  if not public.centralgo_is_super_admin()
     and not public.centralgo_has_company_role(
       application_row.company_id,
       array['company_admin']::public.centralgo_company_role[]
     ) then
    raise exception 'Solo la administración de la central puede revisar solicitudes' using errcode='42501';
  end if;
  if application_row.status<>'pending' then
    raise exception 'Esta solicitud ya fue revisada' using errcode='55000';
  end if;

  if not p_approve then
    update public.driver_applications
    set status='rejected',
        rejection_reason=left(nullif(trim(coalesce(p_rejection_reason,'')),''),240),
        reviewed_by=auth.uid(),
        reviewed_at=now()
    where id=application_row.id;
    return jsonb_build_object('status','rejected','applicationId',application_row.id);
  end if;

  if length(trim(coalesce(p_unit_number,'')))<1 then
    raise exception 'Asigna un número de móvil al conductor' using errcode='22023';
  end if;
  if p_vehicle_id is not null and not exists(
    select 1 from public.vehicles v
    where v.id=p_vehicle_id and v.company_id=application_row.company_id and v.status='active'
  ) then
    raise exception 'El vehículo no pertenece a esta central o no está activo' using errcode='22023';
  end if;

  insert into public.company_memberships(company_id,user_id,role,active)
  values(application_row.company_id,application_row.user_id,'driver',true)
  on conflict(company_id,user_id,role) do update set active=true;

  insert into public.drivers(
    company_id,user_id,vehicle_id,unit_number,display_name,phone,license_number,status
  ) values(
    application_row.company_id,
    application_row.user_id,
    p_vehicle_id,
    trim(p_unit_number),
    application_row.applicant_name,
    application_row.phone,
    application_row.license_number,
    'offline'
  )
  returning id into created_driver_id;

  update public.driver_applications
  set status='approved',
      rejection_reason=null,
      reviewed_by=auth.uid(),
      reviewed_at=now(),
      driver_id=created_driver_id
  where id=application_row.id;

  perform public.centralgo_write_audit(
    application_row.company_id,
    'APROBAR_SOLICITUD_CONDUCTOR',
    format('Solicitud aprobada para %s como %s',application_row.applicant_name,trim(p_unit_number))
  );

  return jsonb_build_object(
    'status','approved',
    'applicationId',application_row.id,
    'driverId',created_driver_id,
    'userId',application_row.user_id
  );
end;
$$;

revoke all on function public.centralgo_complete_onboarding(text,text,text,text,text,text,text,text)
  from public,anon,authenticated;
grant execute on function public.centralgo_complete_onboarding(text,text,text,text,text,text,text,text)
  to authenticated;

revoke all on function public.centralgo_review_driver_application(uuid,boolean,text,uuid,text)
  from public,anon,authenticated;
grant execute on function public.centralgo_review_driver_application(uuid,boolean,text,uuid,text)
  to authenticated;

revoke all on function public.centralgo_self_service_onboarding(text,text,text,text,text,text)
  from public,anon,authenticated;
grant execute on function public.centralgo_self_service_onboarding(text,text,text,text,text,text)
  to authenticated;

-- Repair privileges for functions added directly to the live project after the
-- last repository migration. The guards make fresh local databases compatible.
do $centralgo_hardening$
begin
  if to_regprocedure('public.centralgo_notify_driver_push()') is not null then
    execute 'revoke all on function public.centralgo_notify_driver_push() from public,anon,authenticated';
  end if;
  if to_regprocedure('public.centralgo_operator_cancel_trip_v2(uuid,text,text)') is not null then
    execute 'revoke all on function public.centralgo_operator_cancel_trip_v2(uuid,text,text) from public,anon';
    execute 'grant execute on function public.centralgo_operator_cancel_trip_v2(uuid,text,text) to authenticated';
  end if;
  if to_regprocedure('public.centralgo_register_driver_complaint(uuid,text,uuid,numeric)') is not null then
    execute 'revoke all on function public.centralgo_register_driver_complaint(uuid,text,uuid,numeric) from public,anon';
    execute 'grant execute on function public.centralgo_register_driver_complaint(uuid,text,uuid,numeric) to authenticated';
  end if;
  if to_regprocedure('public.centralgo_set_client_driver_block(uuid,uuid,text,boolean)') is not null then
    execute 'revoke all on function public.centralgo_set_client_driver_block(uuid,uuid,text,boolean) from public,anon';
    execute 'grant execute on function public.centralgo_set_client_driver_block(uuid,uuid,text,boolean) to authenticated';
  end if;
end;
$centralgo_hardening$;

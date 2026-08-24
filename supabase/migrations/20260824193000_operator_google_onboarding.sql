-- Google-only operator onboarding, nearest-central applications and secure email invitations.

create table if not exists public.operator_applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','approved','rejected','withdrawn')),
  rejection_reason text,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, company_id)
);

create table if not exists public.operator_invitations (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  invited_email text not null,
  target_user_id uuid references auth.users(id) on delete cascade,
  invited_by uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','accepted','cancelled','expired')),
  expires_at timestamptz not null default (now() + interval '14 days'),
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(company_id, invited_email)
);

alter table public.operator_applications enable row level security;
alter table public.operator_invitations enable row level security;
revoke all on public.operator_applications, public.operator_invitations from anon, authenticated;

create or replace function public.centralgo_is_google_user(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path=public,auth
as $$
  select exists(select 1 from auth.identities i where i.user_id=p_user_id and i.provider='google');
$$;
revoke all on function public.centralgo_is_google_user(uuid) from public,anon,authenticated;

alter function public.centralgo_complete_onboarding_v2(text,text,text,text,text,text,text,text,text,boolean)
  rename to centralgo_complete_onboarding_v2_legacy;

create function public.centralgo_complete_onboarding_v2(
  p_account_kind text,
  p_name text,
  p_phone text default null,
  p_city text default null,
  p_country_code text default 'CL',
  p_company_name text default null,
  p_central_code text default null,
  p_license_number text default null,
  p_region text default null,
  p_requirements_accepted boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  uid uuid := auth.uid();
  normalized_kind text := lower(trim(coalesce(p_account_kind,'')));
  normalized_name text := trim(coalesce(p_name,''));
  normalized_phone text := nullif(trim(coalesce(p_phone,'')),'');
  normalized_country text := upper(left(trim(coalesce(p_country_code,'')),2));
  normalized_city text := nullif(trim(coalesce(p_city,'')),'');
  normalized_region text := nullif(trim(coalesce(p_region,'')),'');
begin
  if normalized_kind <> 'operator' then
    return public.centralgo_complete_onboarding_v2_legacy(
      p_account_kind,p_name,p_phone,p_city,p_country_code,p_company_name,
      p_central_code,p_license_number,p_region,p_requirements_accepted
    );
  end if;
  if uid is null then raise exception 'Debes iniciar sesión' using errcode='42501'; end if;
  if not public.centralgo_is_google_user(uid) then
    raise exception 'Las operadoras deben registrarse e iniciar sesión con Google' using errcode='42501';
  end if;
  if length(normalized_name)<2 then raise exception 'Ingresa tu nombre completo' using errcode='22023'; end if;
  if length(normalized_country)<>2 or normalized_city is null then
    raise exception 'Selecciona un país y una ciudad válidos' using errcode='22023';
  end if;
  if exists(select 1 from public.company_memberships m where m.user_id=uid and m.active)
     or exists(select 1 from public.saas_accounts s where s.user_id=uid and s.account_kind<>'operator') then
    raise exception 'Esta cuenta ya tiene otra forma de participación' using errcode='23505';
  end if;

  update public.profiles set name=normalized_name,phone=normalized_phone where id=uid and active;
  if not found then raise exception 'Tu perfil no está disponible' using errcode='42501'; end if;

  insert into public.saas_accounts(
    user_id,account_kind,company_id,status,trial_started_at,trial_ends_at,activated_at,
    country_code,region,city
  ) values(
    uid,'operator',null,'active',now(),now(),now(),normalized_country,normalized_region,normalized_city
  )
  on conflict(user_id) do update set
    account_kind='operator',company_id=null,status='active',activated_at=now(),
    country_code=excluded.country_code,region=excluded.region,city=excluded.city,updated_at=now()
  where public.saas_accounts.account_kind='operator';

  return jsonb_build_object('accountKind','operator','status','active','portal','operator_marketplace');
end;
$$;

revoke all on function public.centralgo_complete_onboarding_v2(text,text,text,text,text,text,text,text,text,boolean) from public,anon,authenticated;
grant execute on function public.centralgo_complete_onboarding_v2(text,text,text,text,text,text,text,text,text,boolean) to authenticated;

create or replace function public.centralgo_search_centrals_nearby(
  p_country_code text default null,
  p_city text default null,
  p_query text default null,
  p_lat double precision default null,
  p_lng double precision default null
)
returns table(id uuid,name text,code text,city text,country_code text,center_lat double precision,center_lng double precision,distance_km numeric)
language plpgsql
security definer
set search_path=public
as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'Debes iniciar sesión' using errcode='42501'; end if;
  if not exists(select 1 from public.saas_accounts s where s.user_id=uid and s.account_kind in ('driver','operator') and s.status='active')
     and not exists(select 1 from public.company_memberships m where m.user_id=uid and m.role in ('driver','operator') and m.active) then
    raise exception 'El directorio de centrales es exclusivo para conductores y operadoras' using errcode='42501';
  end if;
  if (p_lat is null) <> (p_lng is null) then raise exception 'La ubicación necesita latitud y longitud' using errcode='22023'; end if;
  if p_lat is not null and (p_lat < -90 or p_lat > 90 or p_lng < -180 or p_lng > 180) then raise exception 'Ubicación inválida' using errcode='22023'; end if;
  return query
  with operational as (
    select c.id,c.name,c.code,c.city,c.country_code,c.center_lat,c.center_lng,
      case when p_lat is not null and c.center_lat is not null and c.center_lng is not null then
        round((6371.0*2.0*asin(least(1.0,sqrt(
          power(sin(radians((c.center_lat-p_lat)/2.0)),2)+cos(radians(p_lat))*cos(radians(c.center_lat))*power(sin(radians((c.center_lng-p_lng)/2.0)),2)
        ))))::numeric,1) else null::numeric end as computed_distance
    from public.companies c
    where c.active
      and exists(select 1 from public.subscriptions s where s.id=(select s2.id from public.subscriptions s2 where s2.company_id=c.id order by s2.created_at desc limit 1)
        and ((s.status='active' and (s.current_period_end is null or s.current_period_end>now())) or (s.status='trialing' and s.trial_ends_at>now())))
      and (nullif(trim(coalesce(p_country_code,'')),'') is null or c.country_code=upper(trim(p_country_code)))
      and (nullif(trim(coalesce(p_city,'')),'') is null or c.city ilike '%'||trim(p_city)||'%')
      and (nullif(trim(coalesce(p_query,'')),'') is null or c.name ilike '%'||trim(p_query)||'%' or c.code ilike '%'||trim(p_query)||'%' or c.city ilike '%'||trim(p_query)||'%')
  )
  select o.id,o.name,o.code,o.city,o.country_code,o.center_lat,o.center_lng,o.computed_distance
  from operational o
  order by case when p_lat is not null and o.computed_distance is not null then 0 else 1 end,o.computed_distance nulls last,o.name
  limit 100;
end;
$$;

revoke all on function public.centralgo_search_centrals_nearby(text,text,text,double precision,double precision) from public,anon,authenticated;
grant execute on function public.centralgo_search_centrals_nearby(text,text,text,double precision,double precision) to authenticated;

create or replace function public.centralgo_request_operator_join(p_company_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare uid uuid:=auth.uid(); app_id uuid;
begin
  if uid is null or not public.centralgo_is_google_user(uid) then raise exception 'Inicia sesión con Google' using errcode='42501'; end if;
  if not exists(select 1 from public.saas_accounts s where s.user_id=uid and s.account_kind='operator' and s.status='active') then raise exception 'Completa tu perfil de operadora' using errcode='42501'; end if;
  if not exists(select 1 from public.companies c where c.id=p_company_id and c.active) then raise exception 'La central ya no está disponible' using errcode='P0002'; end if;
  if exists(select 1 from public.company_memberships m where m.user_id=uid and m.active) then raise exception 'Ya perteneces a una central' using errcode='23505'; end if;
  update public.operator_applications set status='withdrawn',updated_at=now() where user_id=uid and status='pending' and company_id<>p_company_id;
  insert into public.operator_applications(user_id,company_id,status,rejection_reason,reviewed_by,reviewed_at)
  values(uid,p_company_id,'pending',null,null,null)
  on conflict(user_id,company_id) do update set status='pending',rejection_reason=null,reviewed_by=null,reviewed_at=null,updated_at=now()
  returning id into app_id;
  return jsonb_build_object('applicationId',app_id,'status','pending');
end;
$$;

create or replace function public.centralgo_my_operator_applications()
returns jsonb
language sql
security definer
set search_path=public
as $$
  select coalesce(jsonb_agg(jsonb_build_object('id',a.id,'companyId',a.company_id,'companyName',c.name,'companyCode',c.code,'city',c.city,'status',a.status,'rejectionReason',a.rejection_reason,'createdAt',a.created_at) order by a.created_at desc),'[]'::jsonb)
  from public.operator_applications a join public.companies c on c.id=a.company_id where a.user_id=auth.uid();
$$;

create or replace function public.centralgo_company_operator_applications(p_company_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=public,auth
as $$
begin
  if not public.centralgo_has_company_role(p_company_id,array['company_admin']::public.centralgo_company_role[]) and not public.centralgo_is_super_admin() then raise exception 'Sin permiso' using errcode='42501'; end if;
  return (select coalesce(jsonb_agg(jsonb_build_object('id',a.id,'userId',a.user_id,'name',p.name,'email',u.email,'status',a.status,'createdAt',a.created_at) order by a.created_at),'[]'::jsonb)
    from public.operator_applications a join public.profiles p on p.id=a.user_id join auth.users u on u.id=a.user_id where a.company_id=p_company_id and a.status='pending');
end;
$$;

create or replace function public.centralgo_review_operator_application(p_application_id uuid,p_approve boolean,p_rejection_reason text default null)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare a public.operator_applications%rowtype;
begin
  select * into a from public.operator_applications where id=p_application_id for update;
  if not found then raise exception 'Solicitud inexistente' using errcode='P0002'; end if;
  if not public.centralgo_has_company_role(a.company_id,array['company_admin']::public.centralgo_company_role[]) and not public.centralgo_is_super_admin() then raise exception 'Sin permiso' using errcode='42501'; end if;
  if a.status<>'pending' then raise exception 'La solicitud ya fue revisada' using errcode='23505'; end if;
  if p_approve then
    insert into public.company_memberships(company_id,user_id,role,active) values(a.company_id,a.user_id,'operator',true)
    on conflict(company_id,user_id,role) do update set active=true;
    update public.saas_accounts set company_id=a.company_id,status='active',updated_at=now() where user_id=a.user_id and account_kind='operator';
    update public.operator_applications set status='approved',reviewed_by=auth.uid(),reviewed_at=now(),updated_at=now() where id=a.id;
  else
    if length(trim(coalesce(p_rejection_reason,'')))<3 then raise exception 'Indica el motivo del rechazo' using errcode='22023'; end if;
    update public.operator_applications set status='rejected',rejection_reason=trim(p_rejection_reason),reviewed_by=auth.uid(),reviewed_at=now(),updated_at=now() where id=a.id;
  end if;
  return jsonb_build_object('applicationId',a.id,'status',case when p_approve then 'approved' else 'rejected' end);
end;
$$;

create or replace function public.centralgo_my_operator_invitation()
returns jsonb
language sql
security definer
set search_path=public,auth
as $$
  select coalesce((select jsonb_build_object('id',i.id,'companyId',i.company_id,'companyName',c.name,'email',i.invited_email,'expiresAt',i.expires_at,'hasGoogle',public.centralgo_is_google_user(auth.uid()))
    from public.operator_invitations i join public.companies c on c.id=i.company_id join auth.users u on u.id=auth.uid()
    where i.status='pending' and i.expires_at>now() and (i.target_user_id=auth.uid() or lower(i.invited_email)=lower(u.email)) order by i.created_at desc limit 1),'null'::jsonb);
$$;

create or replace function public.centralgo_accept_operator_invitation()
returns jsonb
language plpgsql
security definer
set search_path=public,auth
as $$
declare uid uuid:=auth.uid(); inv public.operator_invitations%rowtype;
begin
  if uid is null or not public.centralgo_is_google_user(uid) then raise exception 'Continúa con la cuenta de Google invitada' using errcode='42501'; end if;
  select i.* into inv from public.operator_invitations i join auth.users u on u.id=uid
  where i.status='pending' and i.expires_at>now() and (i.target_user_id=uid or lower(i.invited_email)=lower(u.email)) order by i.created_at desc limit 1 for update of i;
  if not found then raise exception 'No existe una invitación vigente para este correo' using errcode='P0002'; end if;
  insert into public.company_memberships(company_id,user_id,role,active) values(inv.company_id,uid,'operator',true)
  on conflict(company_id,user_id,role) do update set active=true;
  update public.saas_accounts set company_id=inv.company_id,status='active',updated_at=now() where user_id=uid and account_kind='operator';
  update public.operator_invitations set target_user_id=uid,status='accepted',accepted_at=now(),updated_at=now() where id=inv.id;
  return jsonb_build_object('status','active','companyId',inv.company_id);
end;
$$;

revoke all on function public.centralgo_request_operator_join(uuid),public.centralgo_my_operator_applications(),public.centralgo_company_operator_applications(uuid),public.centralgo_review_operator_application(uuid,boolean,text),public.centralgo_my_operator_invitation(),public.centralgo_accept_operator_invitation() from public,anon,authenticated;
grant execute on function public.centralgo_request_operator_join(uuid),public.centralgo_my_operator_applications(),public.centralgo_company_operator_applications(uuid),public.centralgo_review_operator_application(uuid,boolean,text),public.centralgo_my_operator_invitation(),public.centralgo_accept_operator_invitation() to authenticated;

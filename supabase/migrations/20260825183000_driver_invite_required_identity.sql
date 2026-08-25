alter table public.drivers
  add column if not exists national_id_number text;

comment on column public.drivers.national_id_number is
  'RUT chileno o documento de identidad operativo declarado por el conductor.';

update public.drivers d
set national_id_number = upper(trim(a.national_id_number))
from public.driver_applications a
where a.driver_id = d.id
  and d.national_id_number is null
  and nullif(trim(a.national_id_number),'') is not null;

create unique index if not exists drivers_company_national_id_unique
on public.drivers (
  company_id,
  upper(regexp_replace(national_id_number,'[^0-9A-Za-z]','','g'))
)
where national_id_number is not null and trim(national_id_number) <> '';

create or replace function public.centralgo_accept_driver_recruitment_link_v2(
  p_token text,
  p_name text,
  p_phone text,
  p_national_id_number text,
  p_address text
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  uid uuid := auth.uid();
  normalized_token text := trim(coalesce(p_token,''));
  normalized_name text := trim(regexp_replace(coalesce(p_name,''),'\s+',' ','g'));
  normalized_phone text := trim(coalesce(p_phone,''));
  normalized_address text := trim(regexp_replace(coalesce(p_address,''),'\s+',' ','g'));
  raw_document text := upper(trim(coalesce(p_national_id_number,'')));
  normalized_document text;
  canonical_document text;
  rut_body text;
  rut_digit text;
  expected_digit text;
  rut_sum integer := 0;
  rut_multiplier integer := 2;
  rut_result integer;
  i integer;
  link_row public.company_driver_recruitment_links%rowtype;
  company_row public.companies%rowtype;
  profile_row public.profiles%rowtype;
  account_row public.saas_accounts%rowtype;
  existing_driver public.drivers%rowtype;
  created_driver_id uuid;
  generated_unit text;
  generated_license text;
  already_active boolean := false;
begin
  if uid is null then raise exception 'Debes iniciar sesión' using errcode='42501'; end if;
  if length(normalized_token) < 48 then raise exception 'La invitación no es válida' using errcode='22023'; end if;
  if length(normalized_name) < 5 or position(' ' in normalized_name) = 0 then raise exception 'Ingresa tu nombre completo y al menos un apellido' using errcode='22023'; end if;
  if length(regexp_replace(normalized_phone,'\D','','g')) < 8 then raise exception 'Ingresa un teléfono válido' using errcode='22023'; end if;
  if length(normalized_address) < 5 then raise exception 'Ingresa tu dirección particular' using errcode='22023'; end if;

  select * into link_row from public.company_driver_recruitment_links where token = normalized_token and active for update;
  if not found then raise exception 'La invitación fue revocada o no existe' using errcode='P0002'; end if;
  select * into company_row from public.companies where id = link_row.company_id and active;
  if not found or not public.centralgo_company_access_allowed(link_row.company_id) then raise exception 'La central invitante no está activa' using errcode='55000'; end if;

  if upper(coalesce(company_row.country_code,'CL')) = 'CL' then
    normalized_document := upper(regexp_replace(raw_document,'[^0-9K]','','g'));
    if normalized_document !~ '^[0-9]{7,8}[0-9K]$' then raise exception 'Ingresa un RUT chileno válido' using errcode='22023'; end if;
    rut_body := left(normalized_document,length(normalized_document)-1);
    rut_digit := right(normalized_document,1);
    for i in reverse length(rut_body)..1 loop
      rut_sum := rut_sum + substr(rut_body,i,1)::integer * rut_multiplier;
      rut_multiplier := rut_multiplier + 1;
      if rut_multiplier > 7 then rut_multiplier := 2; end if;
    end loop;
    rut_result := 11 - (rut_sum % 11);
    expected_digit := case when rut_result = 11 then '0' when rut_result = 10 then 'K' else rut_result::text end;
    if rut_digit <> expected_digit then raise exception 'El dígito verificador del RUT no es válido' using errcode='22023'; end if;
    canonical_document := rut_body || '-' || rut_digit;
    normalized_document := rut_body || rut_digit;
  else
    canonical_document := raw_document;
    normalized_document := upper(regexp_replace(raw_document,'[^0-9A-Za-z]','','g'));
    if length(normalized_document) < 3 then raise exception 'Ingresa tu documento de identidad' using errcode='22023'; end if;
  end if;

  select * into profile_row from public.profiles where id = uid for update;
  if not found or not profile_row.active then raise exception 'Tu perfil no está disponible' using errcode='42501'; end if;
  if profile_row.global_role is not null then raise exception 'Esta cuenta ya tiene un rol global' using errcode='23505'; end if;
  select * into existing_driver from public.drivers d where d.company_id = company_row.id and d.user_id = uid limit 1 for update;
  already_active := existing_driver.id is not null and exists(select 1 from public.company_memberships m where m.company_id = company_row.id and m.user_id = uid and m.role = 'driver' and m.active);

  if exists(select 1 from public.drivers d where d.company_id = company_row.id and d.archived_at is null and (existing_driver.id is null or d.id <> existing_driver.id) and upper(regexp_replace(coalesce(d.national_id_number,''),'[^0-9A-Za-z]','','g')) = normalized_document) then
    raise exception 'Este RUT o documento ya está registrado en la central' using errcode='23505';
  end if;
  if exists(select 1 from public.company_memberships m where m.user_id = uid and m.active and m.company_id <> company_row.id) then raise exception 'Esta cuenta ya pertenece a otra central' using errcode='23505'; end if;

  select * into account_row from public.saas_accounts where user_id = uid for update;
  if found and account_row.account_kind <> 'driver' then raise exception 'Esta cuenta ya tiene otra forma de participación' using errcode='23505'; end if;
  update public.profiles set name = normalized_name,phone = normalized_phone,updated_at = now() where id = uid;

  insert into public.saas_accounts(user_id,account_kind,company_id,status,trial_started_at,trial_ends_at,activated_at,country_code,region,city)
  values(uid,'driver',company_row.id,'active',now(),now(),now(),company_row.country_code,null,company_row.city)
  on conflict(user_id) do update set account_kind='driver',company_id=company_row.id,status='active',activated_at=now(),country_code=coalesce(public.saas_accounts.country_code,excluded.country_code),city=coalesce(public.saas_accounts.city,excluded.city),updated_at=now()
  where public.saas_accounts.account_kind='driver';
  if not exists(select 1 from public.saas_accounts s where s.user_id=uid and s.account_kind='driver') then raise exception 'Esta cuenta ya tiene otra forma de participación' using errcode='23505'; end if;
  insert into public.company_memberships(company_id,user_id,role,active) values(company_row.id,uid,'driver',true) on conflict(company_id,user_id,role) do update set active=true;

  if existing_driver.id is null then
    loop
      generated_unit := 'INV-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,6));
      exit when not exists(select 1 from public.drivers d where d.company_id=company_row.id and d.unit_number=generated_unit);
    end loop;
    generated_license := 'INV-' || upper(substr(replace(uid::text,'-',''),1,12));
    if exists(select 1 from public.drivers d where d.company_id=company_row.id and d.license_number=generated_license) then generated_license := generated_license || '-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,4)); end if;
    insert into public.drivers(company_id,user_id,vehicle_id,unit_number,display_name,phone,address,national_id_number,license_number,status)
    values(company_row.id,uid,null,generated_unit,normalized_name,normalized_phone,normalized_address,canonical_document,generated_license,'offline') returning id into created_driver_id;
  else
    created_driver_id := existing_driver.id;
    update public.drivers set display_name = normalized_name,phone = normalized_phone,address = normalized_address,national_id_number = canonical_document,updated_at = now() where id = created_driver_id;
  end if;

  update public.driver_applications set status='withdrawn',rejection_reason='Ingreso directo mediante invitación privada de la central',updated_at=now() where user_id=uid and status in ('draft','pending');
  update public.driver_vehicle_submissions set status='withdrawn',rejection_reason='Ingreso directo mediante invitación privada de la central',updated_at=now() where user_id=uid and status in ('draft','pending');
  if not already_active then update public.company_driver_recruitment_links set last_used_at=now(),uses_count=uses_count+1 where company_id=company_row.id; end if;
  perform public.centralgo_write_audit(company_row.id,case when already_active then 'ACTUALIZAR_IDENTIDAD_CONDUCTOR' else 'ALTA_DIRECTA_CONDUCTOR_INVITADO' end,format('%s confirmó nombre, documento, teléfono y dirección',normalized_name));

  return jsonb_build_object('status','active','alreadyActive',already_active,'companyId',company_row.id,'companyName',company_row.name,'driverId',created_driver_id,'unitNumber',(select d.unit_number from public.drivers d where d.id=created_driver_id),'documentsRequired',false,'immediateAccess',true,'identityComplete',true);
end;
$function$;

revoke all on function public.centralgo_accept_driver_recruitment_link_v2(text,text,text,text,text) from public,anon;
grant execute on function public.centralgo_accept_driver_recruitment_link_v2(text,text,text,text,text) to authenticated;

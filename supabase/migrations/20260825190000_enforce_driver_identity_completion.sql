create or replace function public.centralgo_get_my_driver_identity_status()
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  uid uuid := auth.uid();
  driver_row public.drivers%rowtype;
  company_row public.companies%rowtype;
begin
  if uid is null then
    raise exception 'Debes iniciar sesión' using errcode='42501';
  end if;

  select d.* into driver_row
  from public.drivers d
  join public.company_memberships m
    on m.company_id = d.company_id
   and m.user_id = uid
   and m.role = 'driver'
   and m.active
  where d.user_id = uid
    and d.archived_at is null
  order by d.updated_at desc nulls last
  limit 1;

  if not found then
    return jsonb_build_object(
      'found', false,
      'complete', true,
      'name', '',
      'phone', '',
      'nationalIdNumber', '',
      'address', '',
      'countryCode', 'CL'
    );
  end if;

  select * into company_row from public.companies where id = driver_row.company_id;

  return jsonb_build_object(
    'found', true,
    'complete',
      nullif(trim(coalesce(driver_row.display_name,'')),'') is not null
      and nullif(trim(coalesce(driver_row.phone,'')),'') is not null
      and nullif(trim(coalesce(driver_row.national_id_number,'')),'') is not null
      and nullif(trim(coalesce(driver_row.address,'')),'') is not null,
    'driverId', driver_row.id,
    'companyId', driver_row.company_id,
    'name', coalesce(driver_row.display_name,''),
    'phone', coalesce(driver_row.phone,''),
    'nationalIdNumber', coalesce(driver_row.national_id_number,''),
    'address', coalesce(driver_row.address,''),
    'countryCode', upper(coalesce(company_row.country_code,'CL'))
  );
end;
$function$;

create or replace function public.centralgo_complete_my_driver_identity(
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
  driver_row public.drivers%rowtype;
  company_row public.companies%rowtype;
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
begin
  if uid is null then
    raise exception 'Debes iniciar sesión' using errcode='42501';
  end if;

  if length(normalized_name) < 5 or position(' ' in normalized_name) = 0 then
    raise exception 'Ingresa tu nombre completo y al menos un apellido' using errcode='22023';
  end if;
  if length(regexp_replace(normalized_phone,'\D','','g')) < 8 then
    raise exception 'Ingresa un teléfono válido' using errcode='22023';
  end if;
  if length(normalized_address) < 5 then
    raise exception 'Ingresa tu dirección particular' using errcode='22023';
  end if;

  select d.* into driver_row
  from public.drivers d
  join public.company_memberships m
    on m.company_id = d.company_id
   and m.user_id = uid
   and m.role = 'driver'
   and m.active
  where d.user_id = uid
    and d.archived_at is null
  order by d.updated_at desc nulls last
  limit 1
  for update of d;

  if not found then
    raise exception 'No encontramos tu ficha activa de conductor' using errcode='P0002';
  end if;

  select * into company_row from public.companies where id = driver_row.company_id;

  if upper(coalesce(company_row.country_code,'CL')) = 'CL' then
    normalized_document := upper(regexp_replace(raw_document,'[^0-9K]','','g'));
    if normalized_document !~ '^[0-9]{7,8}[0-9K]$' then
      raise exception 'Ingresa un RUT chileno válido' using errcode='22023';
    end if;
    rut_body := left(normalized_document,length(normalized_document)-1);
    rut_digit := right(normalized_document,1);
    for i in reverse length(rut_body)..1 loop
      rut_sum := rut_sum + substr(rut_body,i,1)::integer * rut_multiplier;
      rut_multiplier := rut_multiplier + 1;
      if rut_multiplier > 7 then rut_multiplier := 2; end if;
    end loop;
    rut_result := 11 - (rut_sum % 11);
    expected_digit := case when rut_result = 11 then '0' when rut_result = 10 then 'K' else rut_result::text end;
    if rut_digit <> expected_digit then
      raise exception 'El dígito verificador del RUT no es válido' using errcode='22023';
    end if;
    canonical_document := rut_body || '-' || rut_digit;
    normalized_document := rut_body || rut_digit;
  else
    canonical_document := raw_document;
    normalized_document := upper(regexp_replace(raw_document,'[^0-9A-Za-z]','','g'));
    if length(normalized_document) < 3 then
      raise exception 'Ingresa tu documento de identidad' using errcode='22023';
    end if;
  end if;

  if exists(
    select 1 from public.drivers d
    where d.company_id = driver_row.company_id
      and d.archived_at is null
      and d.id <> driver_row.id
      and upper(regexp_replace(coalesce(d.national_id_number,''),'[^0-9A-Za-z]','','g')) = normalized_document
  ) then
    raise exception 'Este RUT o documento ya está registrado en la central' using errcode='23505';
  end if;

  update public.drivers
  set display_name = normalized_name,
      phone = normalized_phone,
      national_id_number = canonical_document,
      address = normalized_address,
      updated_at = now()
  where id = driver_row.id;

  update public.profiles
  set name = normalized_name,
      phone = normalized_phone,
      updated_at = now()
  where id = uid;

  perform public.centralgo_write_audit(
    driver_row.company_id,
    'COMPLETAR_IDENTIDAD_CONDUCTOR',
    format('%s confirmó nombre, documento, teléfono y dirección', normalized_name)
  );

  return jsonb_build_object(
    'complete', true,
    'driverId', driver_row.id,
    'companyId', driver_row.company_id,
    'name', normalized_name,
    'phone', normalized_phone,
    'nationalIdNumber', canonical_document,
    'address', normalized_address,
    'countryCode', upper(coalesce(company_row.country_code,'CL'))
  );
end;
$function$;

revoke all on function public.centralgo_get_my_driver_identity_status() from public, anon;
revoke all on function public.centralgo_complete_my_driver_identity(text,text,text,text) from public, anon;
grant execute on function public.centralgo_get_my_driver_identity_status() to authenticated;
grant execute on function public.centralgo_complete_my_driver_identity(text,text,text,text) to authenticated;

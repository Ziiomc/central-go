-- Keep a driver's operational identity independent from the email used to sign in.
-- Existing-central applicants provide name + RUT/document + licence; no document upload is required.

create or replace function public.centralgo_request_existing_central_membership(
  p_company_id uuid,
  p_applicant_name text,
  p_phone text,
  p_license_number text,
  p_claimed_unit_number text default null,
  p_notes text default null,
  p_national_id_number text default null
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  uid uuid := auth.uid();
  account_row public.saas_accounts%rowtype;
  application_row public.driver_applications%rowtype;
  normalized_name text := trim(coalesce(p_applicant_name,''));
  normalized_national_id text := upper(trim(coalesce(p_national_id_number,'')));
  normalized_license text := upper(trim(coalesce(p_license_number,'')));
begin
  if uid is null then
    raise exception 'Debes iniciar sesión' using errcode='42501';
  end if;

  select * into account_row
  from public.saas_accounts
  where user_id=uid
  for update;

  if not found or account_row.account_kind<>'driver' or account_row.status<>'active' then
    raise exception 'Completa primero tu perfil de conductor' using errcode='42501';
  end if;

  if not exists(select 1 from public.companies c where c.id=p_company_id and c.active) then
    raise exception 'La central seleccionada no está disponible' using errcode='P0002';
  end if;

  if length(normalized_name)<2 then
    raise exception 'Ingresa tu nombre completo' using errcode='22023';
  end if;
  if length(normalized_national_id)<3 then
    raise exception 'Ingresa tu RUT o documento de identidad' using errcode='22023';
  end if;
  if length(normalized_license)<3 then
    raise exception 'Ingresa tu número de licencia' using errcode='22023';
  end if;

  select * into application_row
  from public.driver_applications
  where user_id=uid and company_id=p_company_id
  for update;

  if found and application_row.status in ('pending','approved') then
    raise exception 'Ya tienes una solicitud activa para esta central' using errcode='23505';
  end if;

  -- Keep the profile display name aligned with the identity entered by the driver.
  -- Authentication email remains untouched and is only a credential.
  update public.profiles
  set name=normalized_name,
      phone=coalesce(nullif(trim(coalesce(p_phone,'')),''),phone)
  where id=uid;

  insert into public.driver_applications(
    user_id,company_id,applicant_name,phone,national_id_number,license_number,
    country_code,city,notes,status,rejection_reason,reviewed_by,reviewed_at,driver_id,
    application_mode,claimed_unit_number
  ) values(
    uid,p_company_id,normalized_name,nullif(trim(coalesce(p_phone,'')),''),
    normalized_national_id,normalized_license,account_row.country_code,account_row.city,
    left(nullif(trim(coalesce(p_notes,'')),''),500),'pending',null,null,null,null,
    'existing_member',nullif(trim(coalesce(p_claimed_unit_number,'')),'')
  )
  on conflict(user_id,company_id) do update
  set applicant_name=excluded.applicant_name,
      phone=excluded.phone,
      national_id_number=excluded.national_id_number,
      license_number=excluded.license_number,
      country_code=excluded.country_code,
      city=excluded.city,
      notes=excluded.notes,
      status='pending',
      rejection_reason=null,
      reviewed_by=null,
      reviewed_at=null,
      driver_id=null,
      application_mode='existing_member',
      claimed_unit_number=excluded.claimed_unit_number,
      updated_at=now()
  returning * into application_row;

  return jsonb_build_object(
    'applicationId',application_row.id,
    'status','pending',
    'applicationMode','existing_member'
  );
end;
$$;

revoke all on function public.centralgo_request_existing_central_membership(uuid,text,text,text,text,text,text) from public,anon;
grant execute on function public.centralgo_request_existing_central_membership(uuid,text,text,text,text,text,text) to authenticated;

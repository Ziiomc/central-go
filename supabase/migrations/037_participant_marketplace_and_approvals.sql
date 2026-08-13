-- Central GO: participant marketplace, private driver documents and partner approval.
-- Drivers receive an immediate non-operational portal. Commercial access is granted
-- only after an explicit super-admin review and never from user-controlled metadata.

alter table public.saas_accounts
  drop constraint if exists saas_accounts_account_kind_check;
alter table public.saas_accounts
  add constraint saas_accounts_account_kind_check
  check (account_kind in ('central','driver','sales_partner'));

alter table public.saas_accounts
  add column if not exists country_code text,
  add column if not exists region text,
  add column if not exists city text;

create table if not exists public.partner_applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles(id) on delete cascade,
  email text not null,
  full_name text not null,
  phone text,
  country_code text not null,
  region text,
  city text not null,
  status text not null default 'pending'
    check (status in ('pending','approved','rejected')),
  requirements_version text not null,
  accepted_requirements_at timestamptz not null,
  eligible_review_at timestamptz not null default (now()+interval '3 hours'),
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  rejection_reason text,
  partner_id uuid references public.partners(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists partner_applications_status_review_idx
  on public.partner_applications(status,eligible_review_at,created_at);

drop trigger if exists partner_applications_touch on public.partner_applications;
create trigger partner_applications_touch
before update on public.partner_applications
for each row execute function public.centralgo_touch_updated_at();

alter table public.driver_applications
  drop constraint if exists driver_applications_user_id_key;
alter table public.driver_applications
  drop constraint if exists driver_applications_status_check;
alter table public.driver_applications
  add constraint driver_applications_status_check
  check (status in ('draft','pending','approved','rejected','withdrawn'));
alter table public.driver_applications
  add column if not exists national_id_number text,
  add column if not exists license_country_code text,
  add column if not exists country_code text,
  add column if not exists city text,
  add column if not exists notes text;

alter table public.driver_applications
  alter column status set default 'draft';

create unique index if not exists driver_applications_user_company_uidx
  on public.driver_applications(user_id,company_id);

create table if not exists public.driver_vehicle_submissions (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null unique references public.driver_applications(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  license_plate text not null,
  brand text not null,
  model text not null,
  year integer not null check (year between 1950 and 2200),
  color text,
  capacity integer not null default 4 check (capacity between 1 and 20),
  registration_country_code text not null,
  technical_inspection_expiry date,
  status text not null default 'draft'
    check (status in ('draft','pending','approved','rejected','withdrawn')),
  rejection_reason text,
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  vehicle_id uuid references public.vehicles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists driver_vehicle_submissions_company_status_idx
  on public.driver_vehicle_submissions(company_id,status,created_at);

drop trigger if exists driver_vehicle_submissions_touch on public.driver_vehicle_submissions;
create trigger driver_vehicle_submissions_touch
before update on public.driver_vehicle_submissions
for each row execute function public.centralgo_touch_updated_at();

create table if not exists public.driver_application_documents (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.driver_applications(id) on delete cascade,
  vehicle_submission_id uuid references public.driver_vehicle_submissions(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  document_type text not null check (document_type in (
    'identity_document','driver_license','profile_photo','vehicle_registration',
    'vehicle_insurance','technical_inspection','other'
  )),
  storage_path text not null unique,
  original_name text not null,
  mime_type text not null check (mime_type in (
    'application/pdf','image/jpeg','image/png','image/webp'
  )),
  size_bytes bigint not null check (size_bytes between 1 and 12582912),
  country_code text not null,
  verified boolean not null default false,
  verified_by uuid references public.profiles(id) on delete set null,
  verified_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists driver_application_documents_application_idx
  on public.driver_application_documents(application_id,document_type,created_at);

alter table public.partner_applications enable row level security;
alter table public.driver_vehicle_submissions enable row level security;
alter table public.driver_application_documents enable row level security;

drop policy if exists partner_applications_read_authorized on public.partner_applications;
create policy partner_applications_read_authorized
on public.partner_applications for select to authenticated
using (
  user_id=(select auth.uid())
  or (select public.centralgo_is_super_admin())
);

drop policy if exists driver_applications_read_authorized on public.driver_applications;
create policy driver_applications_read_authorized
on public.driver_applications for select to authenticated
using (
  user_id=(select auth.uid())
  or (select public.centralgo_is_super_admin())
  or (
    status<>'draft'
    and (select public.centralgo_has_company_role(
      company_id,
      array['company_admin']::public.centralgo_company_role[]
    ))
  )
);

drop policy if exists driver_vehicle_submissions_read_authorized on public.driver_vehicle_submissions;
create policy driver_vehicle_submissions_read_authorized
on public.driver_vehicle_submissions for select to authenticated
using (
  user_id=(select auth.uid())
  or (select public.centralgo_is_super_admin())
  or (
    status<>'draft'
    and (select public.centralgo_has_company_role(
      company_id,
      array['company_admin']::public.centralgo_company_role[]
    ))
  )
);

drop policy if exists driver_vehicle_submissions_insert_own_draft on public.driver_vehicle_submissions;
create policy driver_vehicle_submissions_insert_own_draft
on public.driver_vehicle_submissions for insert to authenticated
with check (
  user_id=(select auth.uid())
  and status='draft'
  and exists (
    select 1 from public.driver_applications a
    where a.id=application_id
      and a.user_id=(select auth.uid())
      and a.company_id=company_id
      and a.status='draft'
  )
);

drop policy if exists driver_vehicle_submissions_update_own_draft on public.driver_vehicle_submissions;
create policy driver_vehicle_submissions_update_own_draft
on public.driver_vehicle_submissions for update to authenticated
using (
  user_id=(select auth.uid()) and status='draft'
)
with check (
  user_id=(select auth.uid()) and status='draft'
);

drop policy if exists driver_vehicle_submissions_delete_own_draft on public.driver_vehicle_submissions;
create policy driver_vehicle_submissions_delete_own_draft
on public.driver_vehicle_submissions for delete to authenticated
using (
  user_id=(select auth.uid()) and status='draft'
);

drop policy if exists driver_application_documents_read_authorized on public.driver_application_documents;
create policy driver_application_documents_read_authorized
on public.driver_application_documents for select to authenticated
using (
  user_id=(select auth.uid())
  or (select public.centralgo_is_super_admin())
  or exists (
    select 1 from public.driver_applications a
    where a.id=application_id
      and a.status<>'draft'
      and (select public.centralgo_has_company_role(
        a.company_id,
        array['company_admin']::public.centralgo_company_role[]
      ))
  )
);

drop policy if exists driver_application_documents_insert_own_draft on public.driver_application_documents;
create policy driver_application_documents_insert_own_draft
on public.driver_application_documents for insert to authenticated
with check (
  user_id=(select auth.uid())
  and storage_path like ((select auth.uid())::text || '/%')
  and exists (
    select 1 from public.driver_applications a
    where a.id=application_id
      and a.user_id=(select auth.uid())
      and a.status='draft'
  )
  and (
    vehicle_submission_id is null
    or exists (
      select 1 from public.driver_vehicle_submissions v
      where v.id=vehicle_submission_id
        and v.application_id=application_id
        and v.user_id=(select auth.uid())
        and v.status='draft'
    )
  )
);

drop policy if exists driver_application_documents_delete_own_draft on public.driver_application_documents;
create policy driver_application_documents_delete_own_draft
on public.driver_application_documents for delete to authenticated
using (
  user_id=(select auth.uid())
  and exists (
    select 1 from public.driver_applications a
    where a.id=application_id and a.user_id=(select auth.uid()) and a.status='draft'
  )
);

revoke all on table public.partner_applications from public,anon,authenticated;
grant select on table public.partner_applications to authenticated;
revoke all on table public.driver_vehicle_submissions from public,anon,authenticated;
grant select,insert,update,delete on table public.driver_vehicle_submissions to authenticated;
revoke all on table public.driver_application_documents from public,anon,authenticated;
grant select,insert,delete on table public.driver_application_documents to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values(
  'driver-documents',
  'driver-documents',
  false,
  12582912,
  array['application/pdf','image/jpeg','image/png','image/webp']
)
on conflict(id) do update
set public=false,
    file_size_limit=excluded.file_size_limit,
    allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists centralgo_driver_documents_upload_own on storage.objects;
create policy centralgo_driver_documents_upload_own
on storage.objects for insert to authenticated
with check (
  bucket_id='driver-documents'
  and (storage.foldername(name))[1]=(select auth.uid())::text
  and lower(storage.extension(name)) in ('pdf','jpg','jpeg','png','webp')
);

drop policy if exists centralgo_driver_documents_read_authorized on storage.objects;
create policy centralgo_driver_documents_read_authorized
on storage.objects for select to authenticated
using (
  bucket_id='driver-documents'
  and (
    (storage.foldername(name))[1]=(select auth.uid())::text
    or (select public.centralgo_is_super_admin())
    or exists (
      select 1
      from public.driver_application_documents d
      join public.driver_applications a on a.id=d.application_id
      where d.storage_path=name
        and a.status<>'draft'
        and (select public.centralgo_has_company_role(
          a.company_id,
          array['company_admin']::public.centralgo_company_role[]
        ))
    )
  )
);

drop policy if exists centralgo_driver_documents_delete_own on storage.objects;
create policy centralgo_driver_documents_delete_own
on storage.objects for delete to authenticated
using (
  bucket_id='driver-documents'
  and (storage.foldername(name))[1]=(select auth.uid())::text
  and (
    not exists (
      select 1 from public.driver_application_documents d
      where d.storage_path=name
    )
    or exists (
      select 1
      from public.driver_application_documents d
      join public.driver_applications a on a.id=d.application_id
      where d.storage_path=name
        and d.user_id=(select auth.uid())
        and a.status='draft'
    )
  )
);

create or replace function public.centralgo_complete_onboarding_v2(
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
  profile_row public.profiles%rowtype;
  normalized_kind text := lower(trim(coalesce(p_account_kind,'')));
  normalized_name text := trim(coalesce(p_name,''));
  normalized_phone text := nullif(trim(coalesce(p_phone,'')),'');
  normalized_country text := upper(left(trim(coalesce(p_country_code,'')),2));
  normalized_city text := nullif(trim(coalesce(p_city,'')),'');
  normalized_region text := nullif(trim(coalesce(p_region,'')),'');
  generated_code text;
  selected_plan uuid;
  new_company_id uuid;
  application_id uuid;
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
  if length(normalized_country)<>2 or normalized_city is null then
    raise exception 'Selecciona un país y una ciudad válidos' using errcode='22023';
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

  update public.profiles set name=normalized_name,phone=normalized_phone where id=uid;

  if normalized_kind='central' then
    if exists(select 1 from public.saas_accounts s where s.user_id=uid) then
      raise exception 'Esta cuenta ya tiene un perfil de participación' using errcode='23505';
    end if;
    if length(trim(coalesce(p_company_name,'')))<2 then
      raise exception 'Ingresa el nombre de tu central' using errcode='22023';
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
    values(trim(p_company_name),generated_code,normalized_phone,normalized_city,normalized_country,true)
    returning id into new_company_id;

    insert into public.company_memberships(company_id,user_id,role,active)
    values(new_company_id,uid,'company_admin',true);

    insert into public.subscriptions(company_id,plan_id,billing_cycle,status,trial_ends_at,current_period_end)
    values(new_company_id,selected_plan,'monthly','trialing',trial_end,trial_end);

    insert into public.saas_accounts(
      user_id,account_kind,company_id,status,trial_started_at,trial_ends_at,current_period_end,
      country_code,region,city
    ) values(
      uid,'central',new_company_id,'trialing',now(),trial_end,trial_end,
      normalized_country,normalized_region,normalized_city
    );

    insert into public.fare_configs(company_id) values(new_company_id)
    on conflict(company_id) do nothing;

    perform public.centralgo_write_audit(
      new_company_id,'AUTOREGISTRO_CENTRAL',
      format('%s creó la central %s con prueba Enterprise de 5 días',normalized_name,trim(p_company_name))
    );

    return jsonb_build_object(
      'accountKind','central','companyId',new_company_id,'companyCode',generated_code,
      'status','trialing','trialDays',5,'trialEndsAt',trial_end,'planCode','enterprise'
    );
  end if;

  if normalized_kind='driver' then
    insert into public.saas_accounts(
      user_id,account_kind,company_id,status,trial_started_at,trial_ends_at,activated_at,
      country_code,region,city
    ) values(
      uid,'driver',null,'active',now(),now(),now(),normalized_country,normalized_region,normalized_city
    )
    on conflict(user_id) do update
    set account_kind='driver',company_id=null,status='active',activated_at=now(),
        country_code=excluded.country_code,region=excluded.region,city=excluded.city,updated_at=now()
    where public.saas_accounts.account_kind='driver';

    if not exists(
      select 1 from public.saas_accounts s where s.user_id=uid and s.account_kind='driver'
    ) then
      raise exception 'Esta cuenta ya tiene otra forma de participación' using errcode='23505';
    end if;

    return jsonb_build_object('accountKind','driver','status','active','portal','driver_marketplace');
  end if;

  if not p_requirements_accepted then
    raise exception 'Debes leer y aceptar los requisitos del socio comercial' using errcode='22023';
  end if;

  insert into public.partner_applications(
    user_id,email,full_name,phone,country_code,region,city,status,requirements_version,
    accepted_requirements_at,eligible_review_at,reviewed_by,reviewed_at,rejection_reason,partner_id
  ) values(
    uid,(select u.email from auth.users u where u.id=uid),normalized_name,normalized_phone,normalized_country,normalized_region,normalized_city,
    'pending','2026-08-13',now(),now()+interval '3 hours',null,null,null,null
  )
  on conflict(user_id) do update
  set email=excluded.email,full_name=excluded.full_name,phone=excluded.phone,country_code=excluded.country_code,
      region=excluded.region,city=excluded.city,status='pending',
      requirements_version=excluded.requirements_version,accepted_requirements_at=now(),
      eligible_review_at=now()+interval '3 hours',reviewed_by=null,reviewed_at=null,
      rejection_reason=null,partner_id=null,updated_at=now()
  where public.partner_applications.status='rejected'
  returning id into application_id;

  if application_id is null then
    select id into application_id from public.partner_applications where user_id=uid;
  end if;

  insert into public.saas_accounts(
    user_id,account_kind,company_id,status,trial_started_at,trial_ends_at,
    country_code,region,city
  ) values(
    uid,'sales_partner',null,'suspended',now(),now(),normalized_country,normalized_region,normalized_city
  )
  on conflict(user_id) do update
  set account_kind='sales_partner',company_id=null,status='suspended',
      country_code=excluded.country_code,region=excluded.region,city=excluded.city,updated_at=now()
  where public.saas_accounts.account_kind='sales_partner';

  if not exists(
    select 1 from public.saas_accounts s where s.user_id=uid and s.account_kind='sales_partner'
  ) then
    raise exception 'Esta cuenta ya tiene otra forma de participación' using errcode='23505';
  end if;

  return jsonb_build_object(
    'accountKind','sales_partner','applicationId',application_id,'status','pending',
    'commissionPercent',25,'minimumReviewHours',3,
    'eligibleReviewAt',now()+interval '3 hours','requiresSuperadminApproval',true
  );
end;
$$;

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
language sql
security invoker
set search_path=public
as $$
  select public.centralgo_complete_onboarding_v2(
    p_account_kind,p_name,p_phone,p_city,p_country_code,p_company_name,
    p_central_code,p_license_number,null,false
  );
$$;

create or replace function public.centralgo_search_centrals(
  p_country_code text default null,
  p_city text default null,
  p_query text default null
)
returns table(
  id uuid,
  name text,
  code text,
  city text,
  country_code text
)
language plpgsql
security definer
set search_path=public
as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'Debes iniciar sesión' using errcode='42501'; end if;
  if not exists(
    select 1 from public.saas_accounts s
    where s.user_id=uid and s.account_kind='driver' and s.status='active'
  ) and not exists(
    select 1 from public.company_memberships m
    where m.user_id=uid and m.role='driver' and m.active
  ) then
    raise exception 'El directorio de centrales es exclusivo para conductores' using errcode='42501';
  end if;

  return query
  select c.id,c.name,c.code,c.city,c.country_code
  from public.companies c
  where c.active
    and (nullif(trim(coalesce(p_country_code,'')),'') is null or c.country_code=upper(trim(p_country_code)))
    and (nullif(trim(coalesce(p_city,'')),'') is null or c.city ilike '%'||trim(p_city)||'%')
    and (
      nullif(trim(coalesce(p_query,'')),'') is null
      or c.name ilike '%'||trim(p_query)||'%'
      or c.code ilike '%'||trim(p_query)||'%'
      or c.city ilike '%'||trim(p_query)||'%'
    )
  order by case when c.city ilike trim(coalesce(p_city,'')) then 0 else 1 end,c.name
  limit 100;
end;
$$;

create or replace function public.centralgo_my_driver_applications()
returns table(
  id uuid,
  company_id uuid,
  company_name text,
  company_code text,
  company_city text,
  company_country_code text,
  applicant_name text,
  phone text,
  national_id_number text,
  license_number text,
  license_country_code text,
  status text,
  rejection_reason text,
  created_at timestamptz,
  reviewed_at timestamptz
)
language plpgsql
security definer
set search_path=public
as $$
begin
  if auth.uid() is null then raise exception 'Debes iniciar sesión' using errcode='42501'; end if;
  return query
  select a.id,a.company_id,c.name,c.code,c.city,c.country_code,a.applicant_name,a.phone,
         a.national_id_number,a.license_number,a.license_country_code,a.status,
         a.rejection_reason,a.created_at,a.reviewed_at
  from public.driver_applications a
  join public.companies c on c.id=a.company_id
  where a.user_id=auth.uid() and a.status<>'draft'
  order by a.created_at desc;
end;
$$;

create or replace function public.centralgo_prepare_driver_application(
  p_company_id uuid,
  p_applicant_name text,
  p_phone text,
  p_national_id_number text,
  p_license_number text,
  p_license_country_code text,
  p_notes text default null
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
begin
  if uid is null then raise exception 'Debes iniciar sesión' using errcode='42501'; end if;
  select * into account_row from public.saas_accounts where user_id=uid for update;
  if not found or account_row.account_kind<>'driver' or account_row.status<>'active' then
    raise exception 'Completa primero tu perfil de conductor' using errcode='42501';
  end if;
  if not exists(select 1 from public.companies c where c.id=p_company_id and c.active) then
    raise exception 'La central seleccionada no está disponible' using errcode='P0002';
  end if;
  if length(trim(coalesce(p_applicant_name,'')))<2
     or length(trim(coalesce(p_national_id_number,'')))<3
     or length(trim(coalesce(p_license_number,'')))<3 then
    raise exception 'Completa tu identidad y licencia' using errcode='22023';
  end if;

  select * into application_row
  from public.driver_applications
  where user_id=uid and company_id=p_company_id
  for update;

  if found and application_row.status in ('pending','approved') then
    raise exception 'Ya tienes una solicitud activa para esta central' using errcode='23505';
  end if;

  insert into public.driver_applications(
    user_id,company_id,applicant_name,phone,national_id_number,license_number,
    license_country_code,country_code,city,notes,status,rejection_reason,
    reviewed_by,reviewed_at,driver_id
  ) values(
    uid,p_company_id,trim(p_applicant_name),nullif(trim(coalesce(p_phone,'')),''),
    upper(trim(p_national_id_number)),upper(trim(p_license_number)),
    upper(left(trim(p_license_country_code),2)),account_row.country_code,account_row.city,
    left(nullif(trim(coalesce(p_notes,'')),''),500),'draft',null,null,null,null
  )
  on conflict(user_id,company_id) do update
  set applicant_name=excluded.applicant_name,phone=excluded.phone,
      national_id_number=excluded.national_id_number,license_number=excluded.license_number,
      license_country_code=excluded.license_country_code,country_code=excluded.country_code,
      city=excluded.city,notes=excluded.notes,status='draft',rejection_reason=null,
      reviewed_by=null,reviewed_at=null,driver_id=null,updated_at=now()
  returning * into application_row;

  delete from public.driver_application_documents where application_id=application_row.id;
  delete from public.driver_vehicle_submissions where application_id=application_row.id;

  return jsonb_build_object('applicationId',application_row.id,'status','draft');
end;
$$;

create or replace function public.centralgo_submit_driver_application(p_application_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare application_row public.driver_applications%rowtype;
begin
  if auth.uid() is null then raise exception 'Debes iniciar sesión' using errcode='42501'; end if;
  select * into application_row from public.driver_applications
  where id=p_application_id and user_id=auth.uid() for update;
  if not found then raise exception 'Solicitud no encontrada' using errcode='P0002'; end if;
  if application_row.status<>'draft' then raise exception 'La solicitud ya fue enviada' using errcode='55000'; end if;
  if not exists(
    select 1 from public.driver_application_documents d
    where d.application_id=application_row.id and d.document_type='identity_document'
  ) or not exists(
    select 1 from public.driver_application_documents d
    where d.application_id=application_row.id and d.document_type='driver_license'
  ) then
    raise exception 'Adjunta tu documento de identidad y tu licencia de conducir' using errcode='22023';
  end if;
  if exists(select 1 from public.driver_vehicle_submissions v where v.application_id=application_row.id)
     and not exists(
       select 1 from public.driver_application_documents d
       where d.application_id=application_row.id and d.document_type='vehicle_registration'
     ) then
    raise exception 'Adjunta el documento de inscripción del vehículo' using errcode='22023';
  end if;

  update public.driver_applications set status='pending',updated_at=now()
  where id=application_row.id;
  update public.driver_vehicle_submissions set status='pending',updated_at=now()
  where application_id=application_row.id and status='draft';

  return jsonb_build_object('applicationId',application_row.id,'status','pending');
end;
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
  if auth.uid() is null then raise exception 'Debes iniciar sesión' using errcode='42501'; end if;
  select * into application_row from public.driver_applications where id=p_application_id for update;
  if not found then raise exception 'Solicitud no encontrada' using errcode='P0002'; end if;
  if not public.centralgo_is_super_admin()
     and not public.centralgo_has_company_role(
       application_row.company_id,array['company_admin']::public.centralgo_company_role[]
     ) then
    raise exception 'Solo la administración de la central puede revisar solicitudes' using errcode='42501';
  end if;
  if application_row.status<>'pending' then
    raise exception 'Esta solicitud ya fue revisada' using errcode='55000';
  end if;

  if not p_approve then
    update public.driver_applications
    set status='rejected',rejection_reason=left(nullif(trim(coalesce(p_rejection_reason,'')),''),240),
        reviewed_by=auth.uid(),reviewed_at=now()
    where id=application_row.id;
    update public.driver_vehicle_submissions
    set status='rejected',rejection_reason='Solicitud del conductor rechazada',
        reviewed_by=auth.uid(),reviewed_at=now()
    where application_id=application_row.id and status='pending';
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
    application_row.company_id,application_row.user_id,p_vehicle_id,trim(p_unit_number),
    application_row.applicant_name,application_row.phone,application_row.license_number,'offline'
  ) returning id into created_driver_id;

  update public.driver_applications
  set status='approved',rejection_reason=null,reviewed_by=auth.uid(),reviewed_at=now(),
      driver_id=created_driver_id
  where id=application_row.id;

  update public.driver_applications
  set status='withdrawn',rejection_reason='Ingreso aprobado en otra central',updated_at=now()
  where user_id=application_row.user_id and id<>application_row.id and status='pending';

  update public.driver_vehicle_submissions v
  set status='withdrawn',rejection_reason='Ingreso aprobado en otra central',updated_at=now()
  where v.user_id=application_row.user_id and v.application_id<>application_row.id and v.status='pending';

  perform public.centralgo_write_audit(
    application_row.company_id,'APROBAR_SOLICITUD_CONDUCTOR',
    format('Solicitud aprobada para %s como %s',application_row.applicant_name,trim(p_unit_number))
  );

  return jsonb_build_object(
    'status','approved','applicationId',application_row.id,'driverId',created_driver_id,
    'userId',application_row.user_id
  );
end;
$$;

create or replace function public.centralgo_review_driver_vehicle(
  p_submission_id uuid,
  p_approve boolean,
  p_unit_number text default null,
  p_rejection_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  submission_row public.driver_vehicle_submissions%rowtype;
  application_row public.driver_applications%rowtype;
  created_vehicle_id uuid;
begin
  if auth.uid() is null then raise exception 'Debes iniciar sesión' using errcode='42501'; end if;
  select * into submission_row from public.driver_vehicle_submissions where id=p_submission_id for update;
  if not found then raise exception 'Vehículo propuesto no encontrado' using errcode='P0002'; end if;
  if not public.centralgo_is_super_admin()
     and not public.centralgo_has_company_role(
       submission_row.company_id,array['company_admin']::public.centralgo_company_role[]
     ) then
    raise exception 'Solo la administración de la central puede revisar vehículos' using errcode='42501';
  end if;
  if submission_row.status<>'pending' then raise exception 'Este vehículo ya fue revisado' using errcode='55000'; end if;
  select * into application_row from public.driver_applications where id=submission_row.application_id;
  if application_row.status<>'approved' or application_row.driver_id is null then
    raise exception 'Aprueba primero al conductor' using errcode='55000';
  end if;

  if not p_approve then
    update public.driver_vehicle_submissions
    set status='rejected',rejection_reason=left(nullif(trim(coalesce(p_rejection_reason,'')),''),240),
        reviewed_by=auth.uid(),reviewed_at=now()
    where id=submission_row.id;
    return jsonb_build_object('status','rejected','submissionId',submission_row.id);
  end if;
  if length(trim(coalesce(p_unit_number,'')))<1 then
    raise exception 'Asigna un número de móvil al vehículo' using errcode='22023';
  end if;

  insert into public.vehicles(
    company_id,unit_number,license_plate,brand,model,year,color,capacity,
    technical_inspection_expiry,status
  ) values(
    submission_row.company_id,trim(p_unit_number),upper(submission_row.license_plate),
    submission_row.brand,submission_row.model,submission_row.year,submission_row.color,
    submission_row.capacity,submission_row.technical_inspection_expiry,'active'
  ) returning id into created_vehicle_id;

  update public.drivers set vehicle_id=created_vehicle_id,updated_at=now()
  where id=application_row.driver_id;
  update public.driver_vehicle_submissions
  set status='approved',vehicle_id=created_vehicle_id,rejection_reason=null,
      reviewed_by=auth.uid(),reviewed_at=now()
  where id=submission_row.id;

  perform public.centralgo_write_audit(
    submission_row.company_id,'APROBAR_VEHICULO_CONDUCTOR',
    format('Vehículo %s aprobado para la flota',upper(submission_row.license_plate))
  );

  return jsonb_build_object('status','approved','submissionId',submission_row.id,'vehicleId',created_vehicle_id);
end;
$$;

create or replace function public.centralgo_superadmin_review_partner_application(
  p_application_id uuid,
  p_approve boolean,
  p_rejection_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  application_row public.partner_applications%rowtype;
  generated_code text;
  new_partner_id uuid;
begin
  if auth.uid() is null or not public.centralgo_is_super_admin() then
    raise exception 'Solo el superadministrador puede revisar socios comerciales' using errcode='42501';
  end if;
  select * into application_row from public.partner_applications where id=p_application_id for update;
  if not found then raise exception 'Solicitud no encontrada' using errcode='P0002'; end if;
  if application_row.status<>'pending' then raise exception 'Esta solicitud ya fue revisada' using errcode='55000'; end if;

  if not p_approve then
    update public.partner_applications
    set status='rejected',rejection_reason=left(nullif(trim(coalesce(p_rejection_reason,'')),''),240),
        reviewed_by=auth.uid(),reviewed_at=now()
    where id=application_row.id;
    update public.saas_accounts set status='cancelled',updated_at=now()
    where user_id=application_row.user_id and account_kind='sales_partner';
    return jsonb_build_object('status','rejected','applicationId',application_row.id);
  end if;

  if now()<application_row.eligible_review_at then
    raise exception 'La revisión mínima de 3 horas aún no se cumple' using errcode='55000';
  end if;

  loop
    generated_code := 'CGP-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,8));
    exit when not exists(select 1 from public.partners p where p.code=generated_code);
  end loop;

  update public.profiles set global_role='sales_partner',updated_at=now()
  where id=application_row.user_id;
  insert into public.partners(user_id,kind,code,commission_percent,parent_partner_id,active)
  values(application_row.user_id,'sales',generated_code,25,null,true)
  returning id into new_partner_id;
  update public.saas_accounts
  set status='active',activated_at=now(),current_period_end=null,updated_at=now()
  where user_id=application_row.user_id and account_kind='sales_partner';
  update public.partner_applications
  set status='approved',rejection_reason=null,reviewed_by=auth.uid(),reviewed_at=now(),partner_id=new_partner_id
  where id=application_row.id;

  return jsonb_build_object(
    'status','approved','applicationId',application_row.id,'partnerId',new_partner_id,
    'partnerCode',generated_code,'commissionPercent',25
  );
end;
$$;

revoke all on function public.centralgo_complete_onboarding_v2(text,text,text,text,text,text,text,text,text,boolean)
  from public,anon,authenticated;
grant execute on function public.centralgo_complete_onboarding_v2(text,text,text,text,text,text,text,text,text,boolean)
  to authenticated;
revoke all on function public.centralgo_search_centrals(text,text,text) from public,anon,authenticated;
grant execute on function public.centralgo_search_centrals(text,text,text) to authenticated;
revoke all on function public.centralgo_my_driver_applications() from public,anon,authenticated;
grant execute on function public.centralgo_my_driver_applications() to authenticated;
revoke all on function public.centralgo_prepare_driver_application(uuid,text,text,text,text,text,text)
  from public,anon,authenticated;
grant execute on function public.centralgo_prepare_driver_application(uuid,text,text,text,text,text,text)
  to authenticated;
revoke all on function public.centralgo_submit_driver_application(uuid) from public,anon,authenticated;
grant execute on function public.centralgo_submit_driver_application(uuid) to authenticated;
revoke all on function public.centralgo_review_driver_vehicle(uuid,boolean,text,text)
  from public,anon,authenticated;
grant execute on function public.centralgo_review_driver_vehicle(uuid,boolean,text,text)
  to authenticated;
revoke all on function public.centralgo_superadmin_review_partner_application(uuid,boolean,text)
  from public,anon,authenticated;
grant execute on function public.centralgo_superadmin_review_partner_application(uuid,boolean,text)
  to authenticated;

-- Restore the private driver-recruitment link store and RPCs that already exist
-- in production but were missing from the repository migration history.

create table if not exists public.company_driver_recruitment_links (
  company_id uuid primary key references public.companies(id) on delete cascade,
  token text not null unique,
  active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  rotated_at timestamptz,
  last_used_at timestamptz,
  uses_count integer not null default 0 check (uses_count>=0)
);

create index if not exists company_driver_recruitment_links_created_by_idx
  on public.company_driver_recruitment_links(created_by);

alter table public.company_driver_recruitment_links enable row level security;
revoke all on table public.company_driver_recruitment_links from public,anon,authenticated;
grant all on table public.company_driver_recruitment_links to service_role;

create or replace function public.centralgo_get_driver_recruitment_link(
  p_company_id uuid,
  p_rotate boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $function$
declare
  uid uuid:=auth.uid();
  link_row public.company_driver_recruitment_links%rowtype;
  company_row public.companies%rowtype;
  new_token text;
begin
  if uid is null then raise exception 'Debes iniciar sesión' using errcode='42501'; end if;
  if not public.centralgo_is_super_admin()
     and not public.centralgo_has_company_role(p_company_id,array['company_admin']::public.centralgo_company_role[]) then
    raise exception 'Solo la administración de la central puede gestionar este enlace' using errcode='42501';
  end if;

  select * into company_row from public.companies where id=p_company_id and active;
  if not found or not public.centralgo_company_access_allowed(p_company_id) then
    raise exception 'La central no está activa' using errcode='55000';
  end if;

  select * into link_row
  from public.company_driver_recruitment_links
  where company_id=p_company_id
  for update;

  if not found or p_rotate or not link_row.active then
    loop
      new_token:=replace(gen_random_uuid()::text,'-','')||replace(gen_random_uuid()::text,'-','');
      exit when not exists(select 1 from public.company_driver_recruitment_links where token=new_token);
    end loop;

    insert into public.company_driver_recruitment_links(company_id,token,active,created_by,created_at,rotated_at)
    values(p_company_id,new_token,true,uid,now(),case when link_row.company_id is null then null else now() end)
    on conflict(company_id) do update
      set token=excluded.token,active=true,created_by=uid,rotated_at=now()
    returning * into link_row;
  end if;

  return jsonb_build_object(
    'companyId',company_row.id,
    'companyName',company_row.name,
    'companyCode',company_row.code,
    'token',link_row.token,
    'active',link_row.active,
    'usesCount',link_row.uses_count
  );
end;
$function$;

create or replace function public.centralgo_resolve_driver_recruitment_link(p_token text)
returns jsonb
language plpgsql
security definer
set search_path=public
as $function$
declare
  normalized_token text:=trim(coalesce(p_token,''));
  company_row public.companies%rowtype;
begin
  if length(normalized_token)<48 then return null; end if;

  select c.* into company_row
  from public.company_driver_recruitment_links l
  join public.companies c on c.id=l.company_id
  where l.token=normalized_token
    and l.active
    and c.active
    and public.centralgo_company_access_allowed(c.id)
  limit 1;

  if not found then return null; end if;
  return jsonb_build_object(
    'companyId',company_row.id,
    'companyName',company_row.name,
    'companyCode',company_row.code,
    'city',company_row.city,
    'countryCode',company_row.country_code,
    'valid',true,
    'documentsRequired',false,
    'immediateAccess',true
  );
end;
$function$;

revoke all on function public.centralgo_get_driver_recruitment_link(uuid,boolean) from public,anon;
grant execute on function public.centralgo_get_driver_recruitment_link(uuid,boolean) to authenticated,service_role;

revoke all on function public.centralgo_resolve_driver_recruitment_link(text) from public;
grant execute on function public.centralgo_resolve_driver_recruitment_link(text) to anon,authenticated,service_role;

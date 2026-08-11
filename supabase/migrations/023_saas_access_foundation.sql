-- Repository foundation for the SaaS access state already deployed in production.
-- This keeps fresh database builds aligned with the live Supabase schema.

create table if not exists public.saas_accounts (
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

create unique index if not exists saas_accounts_company_unique on public.saas_accounts(company_id) where company_id is not null;
create index if not exists saas_accounts_status_idx on public.saas_accounts(status, trial_ends_at);

drop trigger if exists saas_accounts_touch on public.saas_accounts;
create trigger saas_accounts_touch before update on public.saas_accounts for each row execute function public.centralgo_touch_updated_at();

alter table public.saas_accounts enable row level security;
drop policy if exists saas_accounts_read_own on public.saas_accounts;
create policy saas_accounts_read_own on public.saas_accounts for select to authenticated
using (user_id = (select auth.uid()) or (select public.centralgo_is_super_admin()));

revoke all on table public.saas_accounts from anon, authenticated;
grant select on public.saas_accounts to authenticated;

-- Trialing central subscriptions can never exceed five days.
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
      select 1
      from public.partners p
      join public.profiles pr on pr.id=p.user_id
      where p.user_id=(select auth.uid())
        and p.kind='sales'
        and p.active
        and pr.active
        and pr.global_role='sales_partner'
    );
$$;

revoke all on function public.centralgo_company_access_allowed(uuid) from public,anon,authenticated;
revoke all on function public.centralgo_partner_access_allowed() from public,anon,authenticated;
grant execute on function public.centralgo_company_access_allowed(uuid) to authenticated;
grant execute on function public.centralgo_partner_access_allowed() to authenticated;

-- Expired central accounts cannot bypass the frontend and write directly to the API.
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
  if exists(select 1 from public.partners p where p.user_id=auth.uid() and p.active)
     and not public.centralgo_partner_access_allowed() then
    raise exception 'Solo un Partner Comercial activo puede registrar centrales.' using errcode='42501';
  end if;
  return new;
end;
$$;

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

revoke all on function public.centralgo_guard_company_write() from public,anon,authenticated;
revoke all on function public.centralgo_guard_company_record_write() from public,anon,authenticated;
revoke all on function public.centralgo_guard_company_insert_for_partner() from public,anon,authenticated;
revoke all on function public.centralgo_cap_trial_subscription() from public,anon,authenticated;

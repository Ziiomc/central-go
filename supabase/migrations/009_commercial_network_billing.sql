create type public.centralgo_billing_cycle as enum ('monthly','annual');
create type public.centralgo_subscription_status as enum ('trialing','active','past_due','suspended','cancelled');
create type public.centralgo_partner_kind as enum ('regional','sales');
create type public.centralgo_commission_status as enum ('pending','confirmed','available','paid','reversed');
create type public.centralgo_payment_status as enum ('pending','paid','failed','refunded','partially_refunded');
create type public.centralgo_ticket_status as enum ('open','in_progress','waiting_customer','resolved','closed');

create table public.subscription_plans (
  id uuid primary key default gen_random_uuid(), code text not null unique, name text not null,
  monthly_price_clp integer not null check (monthly_price_clp >= 0), annual_price_clp integer not null check (annual_price_clp >= 0),
  max_vehicles integer check (max_vehicles is null or max_vehicles > 0), max_operators integer check (max_operators is null or max_operators > 0),
  history_days integer check (history_days is null or history_days > 0), driver_app_enabled boolean not null default true,
  support_channel text not null default 'email', features jsonb not null default '{}'::jsonb,
  recommended boolean not null default false, active boolean not null default true, sort_order integer not null default 0,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

insert into public.subscription_plans(code,name,monthly_price_clp,annual_price_clp,max_vehicles,max_operators,history_days,driver_app_enabled,support_channel,features,recommended,sort_order)
values
('start','Start',149000,708000,10,2,60,false,'email','{"description":"Digitalización controlada para centrales pequeñas"}'::jsonb,false,10),
('pro','Pro',219000,1188000,50,null,365,true,'email_priority','{"description":"Operación completa para centrales en crecimiento"}'::jsonb,false,20),
('enterprise','Enterprise',289000,1788000,null,null,null,true,'priority','{"description":"Control total, múltiples sedes e integraciones"}'::jsonb,true,30)
on conflict (code) do update set name=excluded.name, monthly_price_clp=excluded.monthly_price_clp, annual_price_clp=excluded.annual_price_clp,
  max_vehicles=excluded.max_vehicles, max_operators=excluded.max_operators, history_days=excluded.history_days,
  driver_app_enabled=excluded.driver_app_enabled, support_channel=excluded.support_channel,
  features=excluded.features, recommended=excluded.recommended, sort_order=excluded.sort_order;

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(), company_id uuid not null unique references public.companies(id) on delete cascade,
  plan_id uuid not null references public.subscription_plans(id), billing_cycle public.centralgo_billing_cycle not null default 'annual',
  status public.centralgo_subscription_status not null default 'trialing', trial_ends_at timestamptz,
  current_period_start timestamptz not null default now(), current_period_end timestamptz, cancel_at_period_end boolean not null default false,
  external_customer_id text, external_subscription_id text, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table public.partners (
  id uuid primary key default gen_random_uuid(), user_id uuid not null unique references public.profiles(id) on delete cascade,
  kind public.centralgo_partner_kind not null, code text not null unique,
  commission_percent numeric(6,3) not null check (commission_percent >= 0 and commission_percent <= 100),
  parent_partner_id uuid references public.partners(id) on delete set null, active boolean not null default true,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table public.partner_territories (
  id uuid primary key default gen_random_uuid(), partner_id uuid not null references public.partners(id) on delete cascade,
  country_code text not null, region text, city text, exclusive boolean not null default false, created_at timestamptz not null default now(),
  unique(partner_id,country_code,region,city)
);

create table public.referrals (
  id uuid primary key default gen_random_uuid(), partner_id uuid not null references public.partners(id) on delete restrict,
  company_id uuid not null unique references public.companies(id) on delete cascade, referred_at timestamptz not null default now(), active boolean not null default true
);

create table public.payments (
  id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies(id) on delete cascade,
  subscription_id uuid references public.subscriptions(id) on delete set null, provider text, external_payment_id text,
  currency text not null default 'CLP', gross_amount numeric(14,2) not null check (gross_amount >= 0),
  status public.centralgo_payment_status not null default 'pending', paid_at timestamptz, metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(), unique(provider, external_payment_id)
);

create table public.commission_ledger (
  id uuid primary key default gen_random_uuid(), partner_id uuid not null references public.partners(id) on delete restrict,
  company_id uuid not null references public.companies(id) on delete cascade, payment_id uuid references public.payments(id) on delete set null,
  commission_type text not null check (commission_type in ('direct','regional')), gross_amount numeric(14,2) not null check (gross_amount >= 0),
  rate_percent numeric(6,3) not null check (rate_percent >= 0 and rate_percent <= 100), amount numeric(14,2) not null check (amount >= 0),
  status public.centralgo_commission_status not null default 'pending', earned_at timestamptz not null default now(), available_at timestamptz,
  paid_at timestamptz, reversed_at timestamptz, notes text
);

create table public.partner_payouts (
  id uuid primary key default gen_random_uuid(), partner_id uuid not null references public.partners(id) on delete restrict,
  currency text not null default 'CLP', amount numeric(14,2) not null check (amount > 0),
  status text not null default 'pending' check (status in ('pending','processing','paid','failed','cancelled')),
  external_payout_id text, requested_at timestamptz not null default now(), paid_at timestamptz, notes text
);

create table public.support_tickets (
  id uuid primary key default gen_random_uuid(), company_id uuid references public.companies(id) on delete cascade,
  created_by uuid not null references public.profiles(id) on delete restrict, assigned_partner_id uuid references public.partners(id) on delete set null,
  subject text not null, description text not null, priority text not null default 'normal' check (priority in ('low','normal','high','urgent')),
  status public.centralgo_ticket_status not null default 'open', created_at timestamptz not null default now(), updated_at timestamptz not null default now(), resolved_at timestamptz
);

create trigger subscription_plans_touch before update on public.subscription_plans for each row execute function public.centralgo_touch_updated_at();
create trigger subscriptions_touch before update on public.subscriptions for each row execute function public.centralgo_touch_updated_at();
create trigger partners_touch before update on public.partners for each row execute function public.centralgo_touch_updated_at();
create trigger support_tickets_touch before update on public.support_tickets for each row execute function public.centralgo_touch_updated_at();

alter table public.subscription_plans enable row level security;
alter table public.subscriptions enable row level security;
alter table public.partners enable row level security;
alter table public.partner_territories enable row level security;
alter table public.referrals enable row level security;
alter table public.payments enable row level security;
alter table public.commission_ledger enable row level security;
alter table public.partner_payouts enable row level security;
alter table public.support_tickets enable row level security;

create policy plans_read_authenticated on public.subscription_plans for select to authenticated using (active or public.centralgo_is_super_admin());
create policy subscriptions_read_company on public.subscriptions for select to authenticated using (public.centralgo_is_company_member(company_id));
create policy partners_read_self_or_super on public.partners for select to authenticated using (user_id = auth.uid() or public.centralgo_is_super_admin());
create policy territories_read_partner on public.partner_territories for select to authenticated using (public.centralgo_is_super_admin() or exists(select 1 from public.partners p where p.id=partner_id and p.user_id=auth.uid()));
create policy referrals_read_partner on public.referrals for select to authenticated using (public.centralgo_is_super_admin() or exists(select 1 from public.partners p where p.id=partner_id and p.user_id=auth.uid()));
create policy payments_read_company on public.payments for select to authenticated using (public.centralgo_is_company_member(company_id));
create policy commissions_read_partner on public.commission_ledger for select to authenticated using (public.centralgo_is_super_admin() or exists(select 1 from public.partners p where p.id=partner_id and p.user_id=auth.uid()));
create policy payouts_read_partner on public.partner_payouts for select to authenticated using (public.centralgo_is_super_admin() or exists(select 1 from public.partners p where p.id=partner_id and p.user_id=auth.uid()));
create policy tickets_read_authorized on public.support_tickets for select to authenticated using (
  public.centralgo_is_super_admin() or (company_id is not null and public.centralgo_is_company_member(company_id))
  or exists(select 1 from public.partners p where p.id=assigned_partner_id and p.user_id=auth.uid())
);
create policy tickets_insert_member on public.support_tickets for insert to authenticated with check (created_by=auth.uid() and company_id is not null and public.centralgo_is_company_member(company_id));
create policy tickets_update_assignee on public.support_tickets for update to authenticated using (
  public.centralgo_is_super_admin() or exists(select 1 from public.partners p where p.id=assigned_partner_id and p.user_id=auth.uid())
) with check (
  public.centralgo_is_super_admin() or exists(select 1 from public.partners p where p.id=assigned_partner_id and p.user_id=auth.uid())
);

revoke all on table public.subscription_plans, public.subscriptions, public.partners, public.partner_territories,
  public.referrals, public.payments, public.commission_ledger, public.partner_payouts, public.support_tickets from anon, authenticated;
grant select on public.subscription_plans, public.subscriptions, public.partners, public.partner_territories,
  public.referrals, public.payments, public.commission_ledger, public.partner_payouts to authenticated;
grant select, insert, update on public.support_tickets to authenticated;

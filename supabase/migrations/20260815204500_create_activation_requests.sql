-- Central GO · solicitudes de activación comercial.
-- Esta tabla existía en producción, pero faltaba en el historial reproducible de migraciones.

create table if not exists public.activation_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  company_id uuid references public.companies(id) on delete cascade,
  account_kind text not null check (account_kind in ('central', 'sales_partner')),
  plan_code text,
  billing_cycle public.centralgo_billing_cycle not null default 'annual',
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'cancelled')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references public.profiles(id) on delete set null
);

create index if not exists activation_requests_company_idx
  on public.activation_requests(company_id, created_at desc)
  where company_id is not null;

create index if not exists activation_requests_resolved_by_idx
  on public.activation_requests(resolved_by)
  where resolved_by is not null;

create index if not exists activation_requests_user_status_idx
  on public.activation_requests(user_id, status, created_at desc);

alter table public.activation_requests enable row level security;

revoke all on table public.activation_requests from public, anon, authenticated;
grant select on table public.activation_requests to authenticated;
grant all on table public.activation_requests to service_role;

drop policy if exists activation_requests_read_own on public.activation_requests;
create policy activation_requests_read_own
  on public.activation_requests
  for select
  to authenticated
  using (
    user_id = (select auth.uid())
    or (select public.centralgo_is_super_admin())
  );

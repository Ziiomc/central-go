create table if not exists public.operator_terminals (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  label text not null default 'Terminal operativa' check (char_length(label) between 2 and 80),
  authorized_by uuid not null references auth.users(id) on delete restrict,
  active boolean not null default true,
  last_operator_user_id uuid references auth.users(id) on delete set null,
  last_seen_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists operator_terminals_company_active_idx on public.operator_terminals(company_id, active);

alter table public.operator_terminals enable row level security;

drop policy if exists "operator_terminals_member_read" on public.operator_terminals;
create policy "operator_terminals_member_read"
on public.operator_terminals for select
to authenticated
using (
  exists (
    select 1 from public.company_memberships cm
    where cm.company_id = operator_terminals.company_id
      and cm.user_id = (select auth.uid())
      and cm.active = true
  )
);

drop policy if exists "operator_terminals_admin_insert" on public.operator_terminals;
create policy "operator_terminals_admin_insert"
on public.operator_terminals for insert
to authenticated
with check (
  authorized_by = (select auth.uid())
  and exists (
    select 1 from public.company_memberships cm
    where cm.company_id = operator_terminals.company_id
      and cm.user_id = (select auth.uid())
      and cm.role = 'company_admin'
      and cm.active = true
  )
);

drop policy if exists "operator_terminals_admin_update" on public.operator_terminals;
create policy "operator_terminals_admin_update"
on public.operator_terminals for update
to authenticated
using (
  exists (
    select 1 from public.company_memberships cm
    where cm.company_id = operator_terminals.company_id
      and cm.user_id = (select auth.uid())
      and cm.role = 'company_admin'
      and cm.active = true
  )
)
with check (
  exists (
    select 1 from public.company_memberships cm
    where cm.company_id = operator_terminals.company_id
      and cm.user_id = (select auth.uid())
      and cm.role = 'company_admin'
      and cm.active = true
  )
);

grant select, insert, update on public.operator_terminals to authenticated;

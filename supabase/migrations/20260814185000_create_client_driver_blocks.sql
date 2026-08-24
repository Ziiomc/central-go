-- Central GO · bloqueos de conductores definidos por cliente.
-- La tabla existía en producción, pero faltaba en el historial reproducible.

create table if not exists public.client_driver_blocks (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  driver_id uuid not null references public.drivers(id) on delete cascade,
  reason text not null,
  active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(company_id, client_id, driver_id)
);

create index if not exists client_driver_blocks_client_id_idx
  on public.client_driver_blocks(client_id);
create index if not exists client_driver_blocks_created_by_idx
  on public.client_driver_blocks(created_by);
create index if not exists client_driver_blocks_driver_id_idx
  on public.client_driver_blocks(driver_id);
create index if not exists client_driver_blocks_lookup_idx
  on public.client_driver_blocks(company_id, client_id, active);

alter table public.client_driver_blocks enable row level security;

revoke all on table public.client_driver_blocks from public, anon, authenticated;
grant select, insert, update, delete on table public.client_driver_blocks to authenticated;
grant all on table public.client_driver_blocks to service_role;

drop policy if exists client_driver_blocks_read on public.client_driver_blocks;
create policy client_driver_blocks_read
  on public.client_driver_blocks
  for select
  to authenticated
  using (
    public.centralgo_is_super_admin()
    or public.centralgo_is_company_member(company_id)
  );

drop policy if exists client_driver_blocks_insert_manage on public.client_driver_blocks;
create policy client_driver_blocks_insert_manage
  on public.client_driver_blocks
  for insert
  to authenticated
  with check (
    public.centralgo_is_super_admin()
    or public.centralgo_has_company_role(
      company_id,
      array['company_admin','operator']::public.centralgo_company_role[]
    )
  );

drop policy if exists client_driver_blocks_update_manage on public.client_driver_blocks;
create policy client_driver_blocks_update_manage
  on public.client_driver_blocks
  for update
  to authenticated
  using (
    public.centralgo_is_super_admin()
    or public.centralgo_has_company_role(
      company_id,
      array['company_admin','operator']::public.centralgo_company_role[]
    )
  )
  with check (
    public.centralgo_is_super_admin()
    or public.centralgo_has_company_role(
      company_id,
      array['company_admin','operator']::public.centralgo_company_role[]
    )
  );

drop policy if exists client_driver_blocks_delete_manage on public.client_driver_blocks;
create policy client_driver_blocks_delete_manage
  on public.client_driver_blocks
  for delete
  to authenticated
  using (
    public.centralgo_is_super_admin()
    or public.centralgo_has_company_role(
      company_id,
      array['company_admin','operator']::public.centralgo_company_role[]
    )
  );

drop trigger if exists centralgo_saas_access_guard_client_driver_blocks
  on public.client_driver_blocks;
create trigger centralgo_saas_access_guard_client_driver_blocks
  before insert or update or delete on public.client_driver_blocks
  for each row execute function public.centralgo_guard_company_write();

-- Central GO · archivado lógico de móviles y conductores.
-- Las columnas ya existían en producción, pero faltaban en el historial reproducible.

alter table public.vehicles
  add column if not exists archived_at timestamptz;

alter table public.drivers
  add column if not exists archived_at timestamptz;

create index if not exists vehicles_company_active_idx
  on public.vehicles(company_id, unit_number)
  where archived_at is null;

create index if not exists drivers_company_active_idx
  on public.drivers(company_id, unit_number)
  where archived_at is null;

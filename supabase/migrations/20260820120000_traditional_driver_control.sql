alter table public.drivers
  add column if not exists operation_mode text not null default 'app';

alter table public.drivers
  drop constraint if exists drivers_operation_mode_check;

alter table public.drivers
  add constraint drivers_operation_mode_check
  check (operation_mode in ('app','traditional'));

comment on column public.drivers.operation_mode is
  'Driver dispatch interaction mode: app uses live mobile connectivity; traditional is controlled manually by the operator.';

create or replace function public.centralgo_operator_set_driver_operation_mode(
  p_driver_id uuid,
  p_mode text
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  driver_row public.drivers%rowtype;
begin
  if p_mode not in ('app','traditional') then
    raise exception 'Modo de operación no permitido' using errcode = '22023';
  end if;

  select * into driver_row
  from public.drivers
  where id = p_driver_id
  for update;

  if not found then
    raise exception 'Conductor no encontrado' using errcode = 'P0002';
  end if;

  if not public.centralgo_has_company_role(
    driver_row.company_id,
    array['company_admin','operator']::public.centralgo_company_role[]
  ) then
    raise exception 'Sin permiso para cambiar el modo de este móvil' using errcode = '42501';
  end if;

  if exists (
    select 1
    from public.trips t
    where t.driver_id = driver_row.id
      and t.status in ('assigned','en_route','arrived','in_progress')
  ) then
    raise exception 'No puedes cambiar el modo mientras el móvil tiene una carrera activa' using errcode = '55000';
  end if;

  update public.drivers
  set operation_mode = p_mode,
      updated_at = now()
  where id = driver_row.id;

  return p_mode;
end;
$$;

revoke all on function public.centralgo_operator_set_driver_operation_mode(uuid, text) from public, anon;
grant execute on function public.centralgo_operator_set_driver_operation_mode(uuid, text) to authenticated;

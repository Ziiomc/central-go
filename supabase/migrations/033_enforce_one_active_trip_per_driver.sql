-- Defensa de integridad adicional para el despacho.
-- Las RPC ya serializan la asignación bloqueando la fila del conductor, pero
-- este índice impide también que una escritura directa o una condición de
-- carrera deje dos servicios operativos simultáneos en el mismo móvil.

create unique index if not exists trips_one_active_per_driver_idx
on public.trips(driver_id)
where driver_id is not null
  and status in ('assigned','en_route','arrived','in_progress');

create or replace function public.centralgo_driver_queue_snapshot(target_company uuid)
returns table(
  driver_id uuid,
  user_id uuid,
  unit_number text,
  status text,
  service_enabled boolean,
  operation_mode text,
  queue_order bigint,
  connected_at timestamptz,
  presence_last_seen_at timestamptz
)
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
begin
  if not (
    public.centralgo_is_super_admin()
    or public.centralgo_has_company_role(
      target_company,
      array['company_admin','operator']::public.centralgo_company_role[]
    )
    or public.centralgo_driver_id_for_user(target_company) is not null
  ) then
    raise exception 'Sin permiso para consultar la fila de esta central' using errcode='42501';
  end if;

  return query
  select
    d.id,
    d.user_id,
    d.unit_number::text,
    d.status::text,
    d.service_enabled,
    d.operation_mode::text,
    d.dispatch_queue_order,
    coalesce(s.started_at,d.dispatch_queue_updated_at,d.updated_at),
    s.last_seen_at
  from public.drivers d
  left join lateral (
    select ps.started_at,ps.last_seen_at
    from public.driver_presence_sessions ps
    where ps.driver_id=d.id
      and ps.ended_at is null
    order by ps.started_at desc,ps.id desc
    limit 1
  ) s on true
  where d.company_id=target_company
    and d.archived_at is null
    and d.service_enabled
    and (
      (d.operation_mode='traditional' and d.status='available')
      or (
        d.operation_mode='app'
        and d.status not in ('offline','sos')
        and s.started_at is not null
      )
    )
  order by
    d.dispatch_queue_order asc,
    coalesce(s.started_at,d.dispatch_queue_updated_at,d.updated_at) asc,
    d.unit_number asc,
    d.id asc;
end;
$function$;

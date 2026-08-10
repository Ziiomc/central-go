create or replace function public.centralgo_visible_support_tickets()
returns jsonb
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  viewer_partner uuid;
  viewer_kind public.centralgo_partner_kind;
  is_super boolean := public.centralgo_is_super_admin();
begin
  if not is_super then
    select id, kind into viewer_partner, viewer_kind
    from public.partners where user_id=auth.uid() and active limit 1;
    if viewer_partner is null then
      raise exception 'Sin permiso para visualizar soporte de red' using errcode='42501';
    end if;
  end if;

  return (
    select coalesce(jsonb_agg(jsonb_build_object(
      'id', t.id,
      'companyId', t.company_id,
      'companyName', c.name,
      'createdBy', t.created_by,
      'createdByName', creator.name,
      'assignedPartnerId', t.assigned_partner_id,
      'assignedPartnerName', partner_profile.name,
      'assignedPartnerKind', assigned.kind::text,
      'subject', t.subject,
      'description', t.description,
      'priority', t.priority,
      'status', t.status::text,
      'createdAt', t.created_at,
      'updatedAt', t.updated_at,
      'resolvedAt', t.resolved_at
    ) order by case t.priority when 'urgent' then 0 when 'high' then 1 when 'normal' then 2 else 3 end, t.created_at desc), '[]'::jsonb)
    from public.support_tickets t
    left join public.companies c on c.id=t.company_id
    left join public.profiles creator on creator.id=t.created_by
    left join public.partners assigned on assigned.id=t.assigned_partner_id
    left join public.profiles partner_profile on partner_profile.id=assigned.user_id
    where is_super
       or t.assigned_partner_id=viewer_partner
       or (viewer_kind='regional' and assigned.parent_partner_id=viewer_partner)
  );
end;
$$;

create or replace function public.centralgo_update_support_ticket(
  p_ticket_id uuid,
  p_status public.centralgo_ticket_status
)
returns public.centralgo_ticket_status
language plpgsql
security definer
set search_path = public
as $$
declare
  ticket public.support_tickets%rowtype;
  viewer_partner uuid;
  viewer_kind public.centralgo_partner_kind;
  allowed boolean := public.centralgo_is_super_admin();
begin
  select * into ticket from public.support_tickets where id=p_ticket_id;
  if not found then raise exception 'Ticket no encontrado' using errcode='P0002'; end if;

  if not allowed then
    select id, kind into viewer_partner, viewer_kind
    from public.partners where user_id=auth.uid() and active limit 1;
    allowed := ticket.assigned_partner_id=viewer_partner
      or (viewer_kind='regional' and exists(
        select 1 from public.partners child
        where child.id=ticket.assigned_partner_id and child.parent_partner_id=viewer_partner and child.active
      ));
  end if;

  if not allowed then raise exception 'Sin permiso para actualizar este ticket' using errcode='42501'; end if;

  update public.support_tickets
  set status=p_status,
      resolved_at=case when p_status in ('resolved','closed') then coalesce(resolved_at,now()) else null end,
      updated_at=now()
  where id=p_ticket_id;
  return p_status;
end;
$$;

revoke all on function public.centralgo_visible_support_tickets() from public,anon;
revoke all on function public.centralgo_update_support_ticket(uuid,public.centralgo_ticket_status) from public,anon;
grant execute on function public.centralgo_visible_support_tickets() to authenticated;
grant execute on function public.centralgo_update_support_ticket(uuid,public.centralgo_ticket_status) to authenticated;

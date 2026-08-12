create table if not exists public.driver_radio_messages (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  driver_id uuid not null references public.drivers(id) on delete cascade,
  sender_user_id uuid not null references auth.users(id) on delete cascade,
  unit_number text not null,
  driver_name text not null,
  preset_code text,
  message text not null check (char_length(message) between 1 and 240),
  created_at timestamptz not null default now()
);

create index if not exists driver_radio_messages_company_created_idx
  on public.driver_radio_messages(company_id, created_at desc);
create index if not exists driver_radio_messages_driver_created_idx
  on public.driver_radio_messages(driver_id, created_at desc);

alter table public.driver_radio_messages enable row level security;

drop policy if exists driver_radio_messages_read_central on public.driver_radio_messages;
create policy driver_radio_messages_read_central
on public.driver_radio_messages
for select
to authenticated
using (
  public.centralgo_is_super_admin()
  or public.centralgo_has_company_role(
    company_id,
    array['company_admin'::public.centralgo_company_role, 'operator'::public.centralgo_company_role]
  )
);

revoke all on public.driver_radio_messages from anon;
grant select on public.driver_radio_messages to authenticated;

create or replace function public.centralgo_driver_send_radio(
  target_company uuid,
  p_message text,
  p_preset_code text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  d record;
  clean_message text;
  new_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Sesión requerida' using errcode = '42501';
  end if;

  clean_message := trim(coalesce(p_message, ''));
  if char_length(clean_message) < 1 or char_length(clean_message) > 240 then
    raise exception 'El mensaje debe tener entre 1 y 240 caracteres' using errcode = '22023';
  end if;

  select id, unit_number, display_name
  into d
  from public.drivers
  where company_id = target_company
    and user_id = auth.uid()
  limit 1;

  if d.id is null then
    raise exception 'Conductor autenticado no encontrado para esta central' using errcode = '42501';
  end if;

  insert into public.driver_radio_messages (
    company_id, driver_id, sender_user_id, unit_number, driver_name, preset_code, message
  ) values (
    target_company,
    d.id,
    auth.uid(),
    coalesce(d.unit_number, 'Móvil'),
    coalesce(d.display_name, 'Conductor'),
    nullif(trim(p_preset_code), ''),
    clean_message
  ) returning id into new_id;

  return new_id;
end;
$$;

revoke all on function public.centralgo_driver_send_radio(uuid,text,text) from public;
revoke all on function public.centralgo_driver_send_radio(uuid,text,text) from anon;
grant execute on function public.centralgo_driver_send_radio(uuid,text,text) to authenticated;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'driver_radio_messages'
  ) then
    alter publication supabase_realtime add table public.driver_radio_messages;
  end if;
end $$;

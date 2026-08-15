create table if not exists public.mercadopago_platform_connections (
  connection_key text primary key default 'primary' check (connection_key = 'primary'),
  connected_by uuid not null references public.profiles(id) on delete restrict,
  mp_user_id text,
  public_key text,
  access_token text not null,
  refresh_token text,
  token_expires_at timestamptz,
  scope text,
  connected_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.mercadopago_platform_oauth_states (
  state uuid primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  code_verifier text not null,
  return_url text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

alter table public.mercadopago_platform_connections enable row level security;
alter table public.mercadopago_platform_oauth_states enable row level security;

revoke all on table public.mercadopago_platform_connections from public, anon, authenticated;
revoke all on table public.mercadopago_platform_oauth_states from public, anon, authenticated;

comment on table public.mercadopago_platform_connections is
  'Credenciales privadas de la cuenta Mercado Pago de Central GO. Acceso exclusivo mediante service role.';
comment on table public.mercadopago_platform_oauth_states is
  'Estados OAuth PKCE de corta duración para conectar Mercado Pago.';

drop trigger if exists mercadopago_platform_connections_touch on public.mercadopago_platform_connections;
create trigger mercadopago_platform_connections_touch
before update on public.mercadopago_platform_connections
for each row execute function public.centralgo_touch_updated_at();

create or replace function public.get_platform_mercadopago_status()
returns table(
  connected boolean,
  mp_user_id text,
  connected_at timestamptz,
  token_expires_at timestamptz,
  connected_by_name text
)
language plpgsql
stable
security definer
set search_path = 'public', 'pg_temp'
as $$
begin
  if auth.uid() is null or not public.centralgo_is_super_admin() then
    raise exception 'Se requiere una cuenta Superadmin';
  end if;

  return query
  select
    true,
    connection.mp_user_id,
    connection.connected_at,
    connection.token_expires_at,
    profile.name
  from public.mercadopago_platform_connections connection
  join public.profiles profile on profile.id = connection.connected_by
  where connection.connection_key = 'primary';

  if not found then
    return query select false, null::text, null::timestamptz, null::timestamptz, null::text;
  end if;
end;
$$;

create or replace function public.disconnect_platform_mercadopago()
returns boolean
language plpgsql
security definer
set search_path = 'public', 'pg_temp'
as $$
begin
  if auth.uid() is null or not public.centralgo_is_super_admin() then
    raise exception 'Se requiere una cuenta Superadmin';
  end if;

  delete from public.mercadopago_platform_connections
  where connection_key = 'primary';
  return found;
end;
$$;

revoke all on function public.get_platform_mercadopago_status() from public, anon;
revoke all on function public.disconnect_platform_mercadopago() from public, anon;
grant execute on function public.get_platform_mercadopago_status() to authenticated;
grant execute on function public.disconnect_platform_mercadopago() to authenticated;


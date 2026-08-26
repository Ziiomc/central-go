-- Compatibilidad mínima para ejecutar las migraciones en PostgreSQL limpio de CI.
-- Supabase administra estos esquemas en producción; este archivo nunca se aplica allí.

-- Algunas migraciones de autenticación consultan auth.identities para distinguir
-- cuentas Google. El workflow ya crea auth.users; añadimos aquí la parte mínima
-- de identities que existe de forma nativa en Supabase producción.
create table if not exists auth.identities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null,
  identity_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists auth_identities_user_provider_idx
  on auth.identities(user_id, provider);

create schema if not exists storage;

create table if not exists storage.buckets (
  id text primary key,
  name text not null unique,
  owner uuid,
  public boolean not null default false,
  file_size_limit bigint,
  allowed_mime_types text[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text not null references storage.buckets(id),
  name text not null,
  owner uuid,
  owner_id text,
  metadata jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_accessed_at timestamptz not null default now(),
  unique(bucket_id,name)
);

alter table storage.objects enable row level security;

create or replace function storage.foldername(name text)
returns text[]
language sql
immutable
as $$
  select case
    when strpos(name,'/')=0 then array[]::text[]
    else trim_array(string_to_array(name,'/'),1)
  end;
$$;

create or replace function storage.extension(name text)
returns text
language sql
immutable
as $$
  select case
    when strpos(reverse(name),'.')=0 then ''
    else reverse(split_part(reverse(name),'.',1))
  end;
$$;

grant usage on schema storage to anon, authenticated;
grant select on storage.buckets to anon, authenticated;
grant select,insert,update,delete on storage.objects to authenticated;
grant execute on function storage.foldername(text), storage.extension(text) to anon, authenticated;

-- Supabase Realtime owns this table and helper in hosted projects. The local
-- PostgreSQL service only needs their public contract so radio RLS migrations
-- can be compiled and tested from a clean database.
create schema if not exists realtime;

create table if not exists realtime.messages (
  id uuid primary key default gen_random_uuid(),
  topic text not null default '',
  extension text not null default 'broadcast',
  event text,
  payload jsonb not null default '{}'::jsonb,
  private boolean not null default true,
  inserted_at timestamptz not null default now()
);

alter table realtime.messages enable row level security;

create or replace function realtime.topic()
returns text
language sql
stable
as $$
  select coalesce(
    nullif(current_setting('realtime.topic',true),''),
    nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'topic',
    ''
  );
$$;

grant usage on schema realtime to authenticated;
grant select,insert on realtime.messages to authenticated;
grant execute on function realtime.topic() to authenticated;

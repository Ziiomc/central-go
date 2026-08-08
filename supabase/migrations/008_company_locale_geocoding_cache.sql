alter table public.companies
  add column if not exists city text,
  add column if not exists country_code text not null default 'CL',
  add column if not exists center_lat double precision check (center_lat is null or center_lat between -90 and 90),
  add column if not exists center_lng double precision check (center_lng is null or center_lng between -180 and 180);

create table if not exists public.geocoding_cache (
  query_key text primary key,
  company_id uuid references public.companies(id) on delete cascade,
  query_text text not null,
  display_name text not null,
  lat double precision not null check (lat between -90 and 90),
  lng double precision not null check (lng between -180 and 180),
  provider text not null default 'nominatim',
  expires_at timestamptz not null default (now() + interval '90 days'),
  created_at timestamptz not null default now()
);

create index if not exists geocoding_cache_company_idx on public.geocoding_cache(company_id, expires_at desc);

alter table public.geocoding_cache enable row level security;
revoke all on table public.geocoding_cache from anon, authenticated;

grant select on public.companies to authenticated;

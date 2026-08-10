-- HTTP asíncrono para webhooks y automatizaciones internas de Central GO.
-- Supabase ofrece pg_net; PostgreSQL estándar de CI puede no incluirla.
-- La migración se mantiene portable para que las pruebas desde cero sigan siendo reproducibles.
do $$
begin
  if exists (
    select 1
    from pg_available_extensions
    where name = 'pg_net'
  ) then
    execute 'create extension if not exists pg_net with schema extensions';
  else
    raise notice 'pg_net no está disponible en este PostgreSQL; se omite fuera de Supabase';
  end if;
end
$$;

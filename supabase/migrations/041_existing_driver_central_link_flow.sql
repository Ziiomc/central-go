-- Existing driver linkage: schema foundation.
-- Runtime functions are versioned below in this migration.

alter table public.driver_applications
  add column if not exists application_mode text not null default 'documented';

alter table public.driver_applications
  add column if not exists claimed_unit_number text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid='public.driver_applications'::regclass
      and conname='driver_applications_application_mode_check'
  ) then
    alter table public.driver_applications
      add constraint driver_applications_application_mode_check
      check (application_mode in ('documented','existing_member'));
  end if;
end $$;

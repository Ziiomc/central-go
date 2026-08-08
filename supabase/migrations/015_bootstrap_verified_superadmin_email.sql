create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table if not exists private.centralgo_bootstrap_superadmins (
  email text primary key,
  claimed_by uuid references auth.users(id) on delete set null,
  claimed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint centralgo_bootstrap_superadmins_lower_email check (email = lower(email))
);

revoke all on table private.centralgo_bootstrap_superadmins from public, anon, authenticated;

insert into private.centralgo_bootstrap_superadmins(email)
values (lower('Ziiomc3@gmail.com'))
on conflict (email) do nothing;

create or replace function public.centralgo_handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  should_be_super boolean := false;
begin
  should_be_super := new.email_confirmed_at is not null
    and exists (
      select 1
      from private.centralgo_bootstrap_superadmins b
      where b.email = lower(coalesce(new.email, ''))
    );

  insert into public.profiles (id, name, phone, global_role)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data ->> 'name', ''), split_part(coalesce(new.email, 'usuario'), '@', 1)),
    nullif(new.raw_user_meta_data ->> 'phone', ''),
    case when should_be_super then 'super_admin'::public.centralgo_global_role else null end
  )
  on conflict (id) do update
    set global_role = case
      when should_be_super then 'super_admin'::public.centralgo_global_role
      else public.profiles.global_role
    end;

  if should_be_super then
    update private.centralgo_bootstrap_superadmins
      set claimed_by = new.id,
          claimed_at = coalesce(claimed_at, now())
    where email = lower(coalesce(new.email, ''));
  end if;

  return new;
end;
$$;

create or replace function public.centralgo_claim_verified_bootstrap_superadmin()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.email_confirmed_at is not null
     and exists (
       select 1
       from private.centralgo_bootstrap_superadmins b
       where b.email = lower(coalesce(new.email, ''))
     ) then
    update public.profiles
       set global_role = 'super_admin'::public.centralgo_global_role
     where id = new.id;

    update private.centralgo_bootstrap_superadmins
       set claimed_by = new.id,
           claimed_at = coalesce(claimed_at, now())
     where email = lower(coalesce(new.email, ''));
  end if;
  return new;
end;
$$;

revoke all on function public.centralgo_claim_verified_bootstrap_superadmin() from public, anon, authenticated;
revoke all on function public.centralgo_handle_new_user() from public, anon, authenticated;

drop trigger if exists centralgo_auth_user_verified_superadmin on auth.users;
create trigger centralgo_auth_user_verified_superadmin
after update of email_confirmed_at, email on auth.users
for each row
when (new.email_confirmed_at is not null)
execute function public.centralgo_claim_verified_bootstrap_superadmin();

-- A company can have many driver SaaS accounts.
-- Only the central account itself must remain unique per company.

drop index if exists public.saas_accounts_company_unique;

create unique index if not exists saas_accounts_central_company_unique
  on public.saas_accounts(company_id)
  where company_id is not null and account_kind = 'central';

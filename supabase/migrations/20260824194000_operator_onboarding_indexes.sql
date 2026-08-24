create index if not exists operator_applications_company_status_idx
  on public.operator_applications(company_id,status,created_at);
create index if not exists operator_applications_user_status_idx
  on public.operator_applications(user_id,status,created_at desc);
create index if not exists operator_invitations_target_status_idx
  on public.operator_invitations(target_user_id,status,expires_at);
create index if not exists operator_invitations_email_status_idx
  on public.operator_invitations(lower(invited_email),status,expires_at);

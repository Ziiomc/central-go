-- Remove an unnecessary public trigger-function surface and index operator audit foreign keys.

revoke all on function public.centralgo_notify_active_operators_on_new_trip() from public,anon,authenticated;

create index if not exists operator_applications_reviewed_by_idx
  on public.operator_applications(reviewed_by);

create index if not exists operator_invitations_invited_by_idx
  on public.operator_invitations(invited_by);

create index if not exists operator_terminals_authorized_by_idx
  on public.operator_terminals(authorized_by);

create index if not exists operator_terminals_last_operator_user_id_idx
  on public.operator_terminals(last_operator_user_id);

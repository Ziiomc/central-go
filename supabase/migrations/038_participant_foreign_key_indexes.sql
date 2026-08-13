-- Cover every foreign-key column introduced or exercised by the participant
-- marketplace so reviews, document lookups, and cascade checks stay fast as
-- applications grow.

create index if not exists partner_applications_partner_id_idx
  on public.partner_applications(partner_id);

create index if not exists partner_applications_reviewed_by_idx
  on public.partner_applications(reviewed_by);

create index if not exists driver_applications_driver_id_idx
  on public.driver_applications(driver_id);

create index if not exists driver_applications_reviewed_by_idx
  on public.driver_applications(reviewed_by);

create index if not exists driver_vehicle_submissions_user_id_idx
  on public.driver_vehicle_submissions(user_id);

create index if not exists driver_vehicle_submissions_reviewed_by_idx
  on public.driver_vehicle_submissions(reviewed_by);

create index if not exists driver_vehicle_submissions_vehicle_id_idx
  on public.driver_vehicle_submissions(vehicle_id);

create index if not exists driver_application_documents_user_id_idx
  on public.driver_application_documents(user_id);

create index if not exists driver_application_documents_vehicle_submission_id_idx
  on public.driver_application_documents(vehicle_submission_id);

create index if not exists driver_application_documents_verified_by_idx
  on public.driver_application_documents(verified_by);

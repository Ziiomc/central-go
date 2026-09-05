DROP POLICY IF EXISTS notifications_update_company_shared ON public.notifications;

CREATE POLICY notifications_update_company_shared
ON public.notifications
FOR UPDATE
TO authenticated
USING (
  recipient_user_id IS NULL
  AND public.centralgo_has_company_role(
    company_id,
    ARRAY['company_admin','operator']::public.centralgo_company_role[]
  )
)
WITH CHECK (
  recipient_user_id IS NULL
  AND public.centralgo_has_company_role(
    company_id,
    ARRAY['company_admin','operator']::public.centralgo_company_role[]
  )
);
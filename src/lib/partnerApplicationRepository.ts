import { requireSupabase } from './supabase';

export interface CommercialPartnerApplication {
  id: string;
  userId: string;
  email: string;
  fullName: string;
  phone: string;
  countryCode: string;
  region: string;
  city: string;
  status: 'pending' | 'approved' | 'rejected';
  requirementsVersion: string;
  acceptedRequirementsAt: string;
  eligibleReviewAt: string;
  createdAt: string;
  referredByPartnerId: string | null;
}

export const loadPendingCommercialPartnerApplications = async (): Promise<CommercialPartnerApplication[]> => {
  const { data, error } = await requireSupabase()
    .from('partner_applications')
    .select('id,user_id,email,full_name,phone,country_code,region,city,status,requirements_version,accepted_requirements_at,eligible_review_at,created_at,referred_by_partner_id')
    .eq('status', 'pending')
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: row.id,
    userId: row.user_id,
    email: row.email,
    fullName: row.full_name,
    phone: row.phone ?? '',
    countryCode: row.country_code,
    region: row.region ?? '',
    city: row.city,
    status: row.status,
    requirementsVersion: row.requirements_version,
    acceptedRequirementsAt: row.accepted_requirements_at,
    eligibleReviewAt: row.eligible_review_at,
    createdAt: row.created_at,
    referredByPartnerId: row.referred_by_partner_id ?? null,
  }));
};

export const reviewCommercialPartnerApplication = async (input: {
  applicationId: string;
  approve: boolean;
  rejectionReason?: string;
}) => {
  const { data, error } = await requireSupabase().rpc('centralgo_superadmin_review_partner_application', {
    p_application_id: input.applicationId,
    p_approve: input.approve,
    p_rejection_reason: input.rejectionReason || null,
  });
  if (error) throw error;
  return data;
};

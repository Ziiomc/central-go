import { requireSupabase } from './supabase';

export interface ExistingCentralMembershipRequest {
  id: string;
  userId: string;
  companyId: string;
  applicantName: string;
  phone: string;
  nationalIdNumber: string;
  licenseNumber: string;
  claimedUnitNumber: string;
  notes: string;
  createdAt: string;
}

export const requestExistingCentralMembership = async (input: {
  companyId: string;
  applicantName: string;
  phone: string;
  nationalIdNumber: string;
  licenseNumber: string;
  claimedUnitNumber?: string;
  notes?: string;
}) => {
  const { data, error } = await requireSupabase().rpc('centralgo_request_existing_central_membership', {
    p_company_id: input.companyId,
    p_applicant_name: input.applicantName.trim(),
    p_phone: input.phone.trim() || null,
    p_license_number: input.licenseNumber.trim(),
    p_claimed_unit_number: input.claimedUnitNumber?.trim() || null,
    p_notes: input.notes?.trim() || null,
    p_national_id_number: input.nationalIdNumber.trim(),
  });
  if (error) throw error;
  return data as { applicationId: string; status: 'pending'; applicationMode: 'existing_member' };
};

export const loadPendingExistingCentralMemberships = async (companyId: string): Promise<ExistingCentralMembershipRequest[]> => {
  const { data, error } = await requireSupabase()
    .from('driver_applications')
    .select('id,user_id,company_id,applicant_name,phone,national_id_number,license_number,claimed_unit_number,notes,created_at')
    .eq('company_id', companyId)
    .eq('status', 'pending')
    .eq('application_mode', 'existing_member')
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []).map((row: any) => ({
    id: row.id,
    userId: row.user_id,
    companyId: row.company_id,
    applicantName: row.applicant_name,
    phone: row.phone ?? '',
    nationalIdNumber: row.national_id_number ?? '',
    licenseNumber: row.license_number ?? '',
    claimedUnitNumber: row.claimed_unit_number ?? '',
    notes: row.notes ?? '',
    createdAt: row.created_at,
  }));
};

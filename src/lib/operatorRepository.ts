import { requireSupabase } from './supabase';

export interface OperatorApplication {
  id: string;
  companyId: string;
  companyName: string;
  companyCode: string;
  city: string;
  status: 'pending' | 'approved' | 'rejected' | 'withdrawn';
  rejectionReason: string | null;
  createdAt: string;
}

export interface CompanyOperatorApplication {
  id: string;
  userId: string;
  name: string;
  email: string;
  status: 'pending';
  createdAt: string;
}

export interface MyOperatorInvitation {
  id: string;
  companyId: string;
  companyName: string;
  email: string;
  expiresAt: string;
  hasGoogle: boolean;
}

export const loadMyOperatorApplications = async (): Promise<OperatorApplication[]> => {
  const { data, error } = await requireSupabase().rpc('centralgo_my_operator_applications');
  if (error) throw error;
  return Array.isArray(data) ? data : [];
};

export const requestOperatorJoin = async (companyId: string) => {
  const { data, error } = await requireSupabase().rpc('centralgo_request_operator_join', { p_company_id: companyId });
  if (error) throw error;
  return data as { applicationId: string; status: 'pending' };
};

export const loadCompanyOperatorApplications = async (companyId: string): Promise<CompanyOperatorApplication[]> => {
  const { data, error } = await requireSupabase().rpc('centralgo_company_operator_applications', { p_company_id: companyId });
  if (error) throw error;
  return Array.isArray(data) ? data : [];
};

export const reviewOperatorApplication = async (applicationId: string, approve: boolean, rejectionReason?: string) => {
  const { error } = await requireSupabase().rpc('centralgo_review_operator_application', {
    p_application_id: applicationId,
    p_approve: approve,
    p_rejection_reason: rejectionReason?.trim() || null,
  });
  if (error) throw error;
};

export const loadMyOperatorInvitation = async (): Promise<MyOperatorInvitation | null> => {
  const { data, error } = await requireSupabase().rpc('centralgo_my_operator_invitation');
  if (error) throw error;
  return data && typeof data === 'object' ? data as MyOperatorInvitation : null;
};

export const acceptMyOperatorInvitation = async () => {
  const { data, error } = await requireSupabase().rpc('centralgo_accept_operator_invitation');
  if (error) throw error;
  return data as { status: 'active'; companyId: string };
};

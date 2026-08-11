import { requireSupabase } from './supabase';

export interface ActivationRequestItem {
  id: string;
  userId: string;
  name: string;
  email: string;
  accountKind: 'central' | 'sales_partner';
  companyId: string | null;
  companyName: string | null;
  planCode: string | null;
  planName: string | null;
  billingCycle: 'monthly' | 'annual';
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  createdAt: string;
  resolvedAt: string | null;
}

export async function loadActivationRequests(): Promise<ActivationRequestItem[]> {
  const db = requireSupabase();
  const { data, error } = await db.rpc('centralgo_superadmin_activation_requests');
  if (error) throw error;
  return Array.isArray(data) ? data.map((row: any) => ({
    id: String(row.id),
    userId: String(row.userId),
    name: row.name ?? 'Usuario',
    email: row.email ?? '',
    accountKind: row.accountKind,
    companyId: row.companyId ?? null,
    companyName: row.companyName ?? null,
    planCode: row.planCode ?? null,
    planName: row.planName ?? null,
    billingCycle: row.billingCycle ?? 'annual',
    status: row.status,
    createdAt: row.createdAt,
    resolvedAt: row.resolvedAt ?? null,
  })) : [];
}

export async function approveActivationRequest(requestId: string) {
  const db = requireSupabase();
  const { data, error } = await db.rpc('centralgo_superadmin_activate_request', { p_request_id: requestId });
  if (error) throw error;
  return data;
}

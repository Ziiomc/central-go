import { requireSupabase } from './supabase';
import type { NetworkCentral } from '../data/networkMockData';
import type { UserRole } from '../types';

const countryNames: Record<string, string> = {
  CL: 'Chile', AR: 'Argentina', PE: 'Perú', MX: 'México', ES: 'España', EC: 'Ecuador', CO: 'Colombia', UY: 'Uruguay', BR: 'Brasil',
};

const mapSubscriptionStatus = (status?: string): NetworkCentral['status'] => {
  if (status === 'active') return 'active';
  if (status === 'trialing') return 'trial';
  if (status === 'past_due') return 'past_due';
  return 'suspended';
};

export const mapVisibleNetworkCentral = (row: any): NetworkCentral => {
  const countryCode = row.countryCode || 'CL';
  const nextBilling = row.trialEndsAt || row.currentPeriodEnd || row.createdAt || new Date().toISOString();
  const monthlyFee = row.billingCycle === 'annual'
    ? Math.round(Number(row.annualPrice ?? 0) / 12)
    : Number(row.monthlyPrice ?? 0);

  return {
    id: String(row.id),
    name: row.name ?? 'Central sin nombre',
    country: countryNames[countryCode] ?? countryCode,
    countryCode,
    region: row.address ?? '',
    city: row.city ?? '',
    owner: row.ownerName ?? 'Administrador pendiente',
    phone: row.phone ?? '',
    email: row.ownerEmail ?? '',
    vehicles: Number(row.vehicles ?? 0),
    operators: Number(row.operators ?? 0),
    plan: (row.planName ?? 'Enterprise') as NetworkCentral['plan'],
    monthlyFee,
    status: mapSubscriptionStatus(row.subscriptionStatus),
    partner: row.partnerName ?? 'Sin atribuir',
    regionalPartner: row.regionalPartnerName ?? 'Sin atribuir',
    joinedAt: String(row.createdAt ?? new Date().toISOString()).slice(0, 10),
    nextBillingAt: String(nextBilling).slice(0, 10),
    activityScore: row.active ? 100 : 0,
  };
};

export async function loadNetworkCentrals(): Promise<NetworkCentral[]> {
  const db = requireSupabase();
  const { data, error } = await db.rpc('centralgo_visible_network_centrals');
  if (error) throw error;
  const rows = Array.isArray(data) ? data : [];
  return rows.map(mapVisibleNetworkCentral);
}

export interface CreateNetworkCentralInput {
  name: string;
  code: string;
  city: string;
  countryCode: string;
  phone?: string;
  address?: string;
  plan: 'Start' | 'Pro' | 'Enterprise';
  billing: 'monthly' | 'annual';
  ownerEmail?: string;
}

export async function createNetworkCentral(
  input: CreateNetworkCentralInput,
  actorRole: UserRole,
): Promise<{ companyId: string; ownerAssigned: boolean; attributedPartnerCode?: string }> {
  const db = requireSupabase();

  if (actorRole === 'regional_partner' || actorRole === 'sales_partner') {
    const { data, error } = await db.rpc('centralgo_partner_create_company', {
      p_name: input.name.trim(),
      p_code: input.code.trim(),
      p_city: input.city.trim(),
      p_country_code: input.countryCode,
      p_phone: input.phone?.trim() || null,
      p_address: input.address?.trim() || null,
      p_plan_code: input.plan.toLowerCase(),
      p_billing_cycle: input.billing,
      p_owner_email: input.ownerEmail?.trim() || null,
      p_trial_days: 14,
    });
    if (error) throw error;
    return {
      companyId: String((data as any)?.companyId ?? ''),
      ownerAssigned: Boolean((data as any)?.ownerAssigned),
      attributedPartnerCode: (data as any)?.partnerCode ?? undefined,
    };
  }

  const { data, error } = await db.rpc('centralgo_superadmin_create_company', {
    p_name: input.name.trim(),
    p_code: input.code.trim(),
    p_city: input.city.trim(),
    p_country_code: input.countryCode,
    p_phone: input.phone?.trim() || null,
    p_address: input.address?.trim() || null,
    p_plan_code: input.plan.toLowerCase(),
    p_billing_cycle: input.billing,
    p_trial_days: 14,
    p_center_lat: null,
    p_center_lng: null,
  });
  if (error) throw error;
  const companyId = String(data);

  let ownerAssigned = false;
  if (input.ownerEmail?.trim()) {
    const { error: ownerError } = await db.rpc('centralgo_assign_company_user', {
      p_company_id: companyId,
      p_email: input.ownerEmail.trim(),
      p_role: 'company_admin',
    });
    ownerAssigned = !ownerError;
  }

  return { companyId, ownerAssigned };
}

export async function setNetworkCentralStatus(
  companyId: string,
  status: 'trialing' | 'active' | 'past_due' | 'suspended' | 'cancelled',
) {
  const db = requireSupabase();
  const { error } = await db.rpc('centralgo_superadmin_set_company_status', {
    p_company_id: companyId,
    p_status: status,
  });
  if (error) throw error;
}

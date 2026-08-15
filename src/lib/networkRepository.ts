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

export interface NetworkCentralRecord extends NetworkCentral {
  planCode: 'start' | 'pro' | 'enterprise';
  billingCycle: 'monthly' | 'annual';
  paymentFrequency: 'monthly' | 'annual';
  discountPercent: number;
  listAmount: number;
  effectiveAmount: number;
  commitmentEndAt: string | null;
  offerLabel: string | null;
  offerNotes: string | null;
  manualActivation: boolean;
}

export const mapVisibleNetworkCentral = (row: any): NetworkCentralRecord => {
  const countryCode = row.countryCode || 'CL';
  const status = mapSubscriptionStatus(row.subscriptionStatus);
  const billingCycle: 'monthly' | 'annual' = row.billingCycle === 'annual' ? 'annual' : 'monthly';
  const paymentFrequency: 'monthly' | 'annual' = row.paymentFrequency === 'annual' ? 'annual' : 'monthly';
  const fallbackMonthlyFee = billingCycle === 'annual'
    ? Math.round(Number(row.annualPrice ?? 0) / 12)
    : Number(row.monthlyPrice ?? 0);
  const monthlyFee = Number(row.monthlyEquivalent ?? fallbackMonthlyFee);
  const nextBilling = status === 'trial'
    ? (row.trialEndsAt || row.currentPeriodEnd || row.createdAt)
    : (row.currentPeriodEnd || row.trialEndsAt || row.createdAt);

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
    planCode: (row.planCode ?? 'enterprise') as NetworkCentralRecord['planCode'],
    billingCycle,
    paymentFrequency,
    discountPercent: Number(row.discountPercent ?? 0),
    listAmount: Number(row.listAmount ?? 0),
    effectiveAmount: Number(row.effectiveAmount ?? 0),
    commitmentEndAt: row.commitmentEndAt ? String(row.commitmentEndAt) : null,
    offerLabel: row.offerLabel ? String(row.offerLabel) : null,
    offerNotes: row.offerNotes ? String(row.offerNotes) : null,
    manualActivation: Boolean(row.manualActivation),
    monthlyFee: Number.isFinite(monthlyFee) ? Math.round(monthlyFee) : 0,
    status,
    partner: row.partnerName ?? 'Sin atribuir',
    regionalPartner: row.regionalPartnerName ?? 'Sin atribuir',
    joinedAt: String(row.createdAt ?? new Date().toISOString()).slice(0, 10),
    nextBillingAt: String(nextBilling ?? new Date().toISOString()).slice(0, 10),
    activityScore: row.active ? 100 : 0,
  };
};

export async function loadNetworkCentrals(): Promise<NetworkCentralRecord[]> {
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

  if (actorRole === 'sales_partner') {
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
      p_trial_days: 5,
    });
    if (error) throw error;
    return {
      companyId: String((data as any)?.companyId ?? ''),
      ownerAssigned: Boolean((data as any)?.ownerAssigned),
      attributedPartnerCode: (data as any)?.partnerCode ?? undefined,
    };
  }

  if (actorRole === 'regional_partner') {
    throw new Error('Las centrales se registran exclusivamente desde cuentas Partner Comercial.');
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
    p_trial_days: 5,
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

export interface ActivateNetworkCentralManualInput {
  companyId: string;
  planCode: 'start' | 'pro' | 'enterprise';
  term: 'monthly' | 'annual';
  paymentFrequency: 'monthly' | 'annual';
  discountPercent?: number;
  offerLabel?: string;
  offerNotes?: string;
}

export interface ManualSubscriptionResult {
  activated: boolean;
  subscriptionId: string;
  companyId: string;
  planCode: string;
  planName: string;
  term: 'monthly' | 'annual';
  paymentFrequency: 'monthly' | 'annual';
  discountPercent: number;
  listAmountClp: number;
  effectiveAmountClp: number;
  nextBillingAt: string;
  commitmentEndAt: string;
}

export async function activateNetworkCentralManual(input: ActivateNetworkCentralManualInput): Promise<ManualSubscriptionResult> {
  const db = requireSupabase();
  const { data, error } = await db.rpc('centralgo_superadmin_manual_subscription', {
    p_company_id: input.companyId,
    p_plan_code: input.planCode,
    p_term: input.term,
    p_payment_frequency: input.paymentFrequency,
    p_discount_percent: Number(input.discountPercent ?? 0),
    p_offer_label: input.offerLabel?.trim() || null,
    p_offer_notes: input.offerNotes?.trim() || null,
  });
  if (error) throw error;
  const raw = (data ?? {}) as any;
  return {
    activated: Boolean(raw.activated),
    subscriptionId: String(raw.subscriptionId ?? ''),
    companyId: String(raw.companyId ?? input.companyId),
    planCode: String(raw.planCode ?? input.planCode),
    planName: String(raw.planName ?? input.planCode),
    term: raw.term === 'annual' ? 'annual' : 'monthly',
    paymentFrequency: raw.paymentFrequency === 'annual' ? 'annual' : 'monthly',
    discountPercent: Number(raw.discountPercent ?? 0),
    listAmountClp: Number(raw.listAmountClp ?? 0),
    effectiveAmountClp: Number(raw.effectiveAmountClp ?? 0),
    nextBillingAt: String(raw.nextBillingAt ?? ''),
    commitmentEndAt: String(raw.commitmentEndAt ?? ''),
  };
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

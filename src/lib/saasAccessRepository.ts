import { requireSupabase } from './supabase';

export type SaaSAccountKind = 'central' | 'sales_partner' | 'super_admin' | 'central_user';

export interface SaaSAccessState {
  authenticated: boolean;
  allowed: boolean;
  onboardingRequired: boolean;
  paymentRequired: boolean;
  accountKind?: SaaSAccountKind;
  status?: string;
  companyId?: string;
  companyRole?: string;
  trialEndsAt?: string | null;
  currentPeriodEnd?: string | null;
  daysRemaining: number;
  planCode?: string | null;
  planName?: string | null;
}

const mapAccessState = (raw: any): SaaSAccessState => ({
  authenticated: Boolean(raw?.authenticated),
  allowed: Boolean(raw?.allowed),
  onboardingRequired: Boolean(raw?.onboardingRequired),
  paymentRequired: Boolean(raw?.paymentRequired),
  accountKind: raw?.accountKind ?? undefined,
  status: raw?.status ?? undefined,
  companyId: raw?.companyId ?? undefined,
  companyRole: raw?.companyRole ?? undefined,
  trialEndsAt: raw?.trialEndsAt ?? null,
  currentPeriodEnd: raw?.currentPeriodEnd ?? null,
  daysRemaining: Number(raw?.daysRemaining ?? 0),
  planCode: raw?.planCode ?? null,
  planName: raw?.planName ?? null,
});

export async function loadMyAccessState(): Promise<SaaSAccessState> {
  const db = requireSupabase();
  const { data, error } = await db.rpc('centralgo_my_access_state');
  if (error) throw error;
  return mapAccessState(data);
}

export async function completeSelfServiceOnboarding(input: {
  accountKind: 'central' | 'sales_partner';
  name: string;
  phone?: string;
  city?: string;
  countryCode?: string;
  companyName?: string;
}) {
  const db = requireSupabase();
  const { data, error } = await db.rpc('centralgo_self_service_onboarding', {
    p_account_kind: input.accountKind,
    p_name: input.name.trim(),
    p_phone: input.phone?.trim() || null,
    p_city: input.city?.trim() || null,
    p_country_code: input.countryCode?.trim().toUpperCase() || 'CL',
    p_company_name: input.companyName?.trim() || null,
  });
  if (error) throw error;
  return data as { accountKind: 'central' | 'sales_partner'; companyId?: string; partnerId?: string; partnerCode?: string; trialEndsAt: string; daysRemaining: number };
}

export async function requestAccountActivation(input?: {
  planCode?: 'start' | 'pro' | 'enterprise';
  billingCycle?: 'monthly' | 'annual';
}) {
  const db = requireSupabase();
  const { data, error } = await db.rpc('centralgo_request_activation', {
    p_plan_code: input?.planCode ?? null,
    p_billing_cycle: input?.billingCycle ?? 'annual',
  });
  if (error) throw error;
  return String(data ?? '');
}

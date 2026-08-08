import { requireSupabase } from './supabase';
import type { NetworkCentral } from '../data/networkMockData';

const countryNames: Record<string, string> = {
  CL: 'Chile', AR: 'Argentina', PE: 'Perú', MX: 'México', ES: 'España', EC: 'Ecuador', CO: 'Colombia', UY: 'Uruguay', BR: 'Brasil',
};

const mapSubscriptionStatus = (status?: string): NetworkCentral['status'] => {
  if (status === 'active') return 'active';
  if (status === 'trialing') return 'trial';
  if (status === 'past_due') return 'past_due';
  return 'suspended';
};

export async function loadNetworkCentrals(): Promise<NetworkCentral[]> {
  const db = requireSupabase();
  const [companiesRes, subscriptionsRes, vehiclesRes, membershipsRes, referralsRes] = await Promise.all([
    db.from('companies').select('id,name,code,phone,address,city,country_code,active,created_at').order('created_at', { ascending: false }),
    db.from('subscriptions').select('company_id,status,billing_cycle,current_period_end,trial_ends_at,subscription_plans(code,name,monthly_price_clp,annual_price_clp)'),
    db.from('vehicles').select('company_id,id'),
    db.from('company_memberships').select('company_id,user_id,role,profiles(name,phone)').eq('active', true),
    db.from('referrals').select('company_id,partner_id,partners(id,user_id,parent_partner_id,profiles(name),parent:partners!partners_parent_partner_id_fkey(id,profiles(name)))').eq('active', true),
  ]);

  for (const result of [companiesRes, subscriptionsRes, vehiclesRes, membershipsRes, referralsRes]) {
    if (result.error) throw result.error;
  }

  const subscriptionByCompany = new Map((subscriptionsRes.data ?? []).map((row: any) => [row.company_id, row]));
  const vehicleCounts = new Map<string, number>();
  for (const row of vehiclesRes.data ?? []) vehicleCounts.set((row as any).company_id, (vehicleCounts.get((row as any).company_id) ?? 0) + 1);

  const membershipsByCompany = new Map<string, any[]>();
  for (const row of membershipsRes.data ?? []) {
    const companyId = (row as any).company_id;
    const list = membershipsByCompany.get(companyId) ?? [];
    list.push(row);
    membershipsByCompany.set(companyId, list);
  }

  const referralByCompany = new Map((referralsRes.data ?? []).map((row: any) => [row.company_id, row]));

  return (companiesRes.data ?? []).map((company: any) => {
    const subscription: any = subscriptionByCompany.get(company.id);
    const rawPlan: any = Array.isArray(subscription?.subscription_plans) ? subscription.subscription_plans[0] : subscription?.subscription_plans;
    const members = membershipsByCompany.get(company.id) ?? [];
    const ownerMembership = members.find((item: any) => item.role === 'company_admin');
    const ownerProfile: any = Array.isArray(ownerMembership?.profiles) ? ownerMembership.profiles[0] : ownerMembership?.profiles;
    const referral: any = referralByCompany.get(company.id);
    const partner: any = Array.isArray(referral?.partners) ? referral.partners[0] : referral?.partners;
    const partnerProfile: any = Array.isArray(partner?.profiles) ? partner.profiles[0] : partner?.profiles;
    const parent: any = Array.isArray(partner?.parent) ? partner.parent[0] : partner?.parent;
    const regionalProfile: any = Array.isArray(parent?.profiles) ? parent.profiles[0] : parent?.profiles;
    const countryCode = company.country_code || 'CL';
    const nextBilling = subscription?.trial_ends_at || subscription?.current_period_end || company.created_at;
    const monthlyFee = subscription?.billing_cycle === 'annual'
      ? Math.round(Number(rawPlan?.annual_price_clp ?? 0) / 12)
      : Number(rawPlan?.monthly_price_clp ?? 0);

    return {
      id: company.id,
      name: company.name,
      country: countryNames[countryCode] ?? countryCode,
      countryCode,
      region: '',
      city: company.city ?? '',
      owner: ownerProfile?.name ?? 'Administrador pendiente',
      phone: company.phone ?? ownerProfile?.phone ?? '',
      email: '',
      vehicles: vehicleCounts.get(company.id) ?? 0,
      operators: members.filter((item: any) => item.role === 'operator').length,
      plan: (rawPlan?.name ?? 'Enterprise') as NetworkCentral['plan'],
      monthlyFee,
      status: mapSubscriptionStatus(subscription?.status),
      partner: partnerProfile?.name ?? 'Sin atribuir',
      regionalPartner: regionalProfile?.name ?? 'Sin atribuir',
      joinedAt: String(company.created_at).slice(0, 10),
      nextBillingAt: String(nextBilling).slice(0, 10),
      activityScore: company.active ? 100 : 0,
    };
  });
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

export async function createNetworkCentral(input: CreateNetworkCentralInput): Promise<{ companyId: string; ownerAssigned: boolean }> {
  const db = requireSupabase();
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

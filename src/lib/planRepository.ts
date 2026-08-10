import { requireSupabase } from './supabase';

export interface CommercialPlanFeatures {
  description: string;
  dispatch_map: boolean;
  driver_app: boolean;
  live_gps: boolean;
  advanced_reports: boolean;
  multi_branch: boolean;
  api_integrations: boolean;
  priority_support: boolean;
  onboarding_sla: boolean;
  regional_executive: boolean;
  client_history: string;
  sales_highlight: string;
}

export interface CommercialPlanRecord {
  id: string;
  code: 'start' | 'pro' | 'enterprise';
  name: 'Start' | 'Pro' | 'Enterprise';
  monthlyPrice: number;
  annualPrice: number;
  annualMonthlyPrice: number;
  maxVehicles: number | null;
  maxOperators: number | null;
  historyDays: number | null;
  driverAppEnabled: boolean;
  supportChannel: string;
  features: CommercialPlanFeatures;
  recommended: boolean;
}

const fallbackFeatures = (row: any): CommercialPlanFeatures => ({
  description: row.features?.description ?? '',
  dispatch_map: row.features?.dispatch_map ?? true,
  driver_app: row.features?.driver_app ?? Boolean(row.driver_app_enabled),
  live_gps: row.features?.live_gps ?? Boolean(row.driver_app_enabled),
  advanced_reports: row.features?.advanced_reports ?? row.code !== 'start',
  multi_branch: row.features?.multi_branch ?? row.code === 'enterprise',
  api_integrations: row.features?.api_integrations ?? row.code === 'enterprise',
  priority_support: row.features?.priority_support ?? row.code !== 'start',
  onboarding_sla: row.features?.onboarding_sla ?? row.code === 'enterprise',
  regional_executive: row.features?.regional_executive ?? row.code === 'enterprise',
  client_history: row.features?.client_history ?? (row.history_days ? `${row.history_days} días` : 'Completo'),
  sales_highlight: row.features?.sales_highlight ?? '',
});

export async function loadPlanCatalog(): Promise<CommercialPlanRecord[]> {
  const db = requireSupabase();
  const { data, error } = await db
    .from('subscription_plans')
    .select('id,code,name,monthly_price_clp,annual_price_clp,max_vehicles,max_operators,history_days,driver_app_enabled,support_channel,features,recommended,sort_order')
    .eq('active', true)
    .order('sort_order');
  if (error) throw error;

  return (data ?? []).map((row: any) => ({
    id: row.id,
    code: row.code,
    name: row.name,
    monthlyPrice: Number(row.monthly_price_clp ?? 0),
    annualPrice: Number(row.annual_price_clp ?? 0),
    annualMonthlyPrice: Math.round(Number(row.annual_price_clp ?? 0) / 12),
    maxVehicles: row.max_vehicles == null ? null : Number(row.max_vehicles),
    maxOperators: row.max_operators == null ? null : Number(row.max_operators),
    historyDays: row.history_days == null ? null : Number(row.history_days),
    driverAppEnabled: Boolean(row.driver_app_enabled),
    supportChannel: row.support_channel ?? 'email',
    features: fallbackFeatures(row),
    recommended: Boolean(row.recommended),
  })) as CommercialPlanRecord[];
}

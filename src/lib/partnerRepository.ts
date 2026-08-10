import { requireSupabase } from './supabase';
import type { NetworkCentral } from '../data/networkMockData';
import { mapVisibleNetworkCentral } from './networkRepository';

export interface PartnerTerritory {
  countryCode: string;
  region: string | null;
  city: string | null;
  exclusive: boolean;
}

export interface PartnerDashboardData {
  configured: boolean;
  id?: string;
  kind?: 'regional' | 'sales';
  code?: string;
  commissionPercent: number;
  territories: PartnerTerritory[];
  centrals: NetworkCentral[];
  centralCount: number;
  monthlySales: number;
  pendingCommission: number;
  availableCommission: number;
  paidCommission: number;
  teamCount: number;
}

export async function loadPartnerDashboard(): Promise<PartnerDashboardData> {
  const db = requireSupabase();
  const { data, error } = await db.rpc('centralgo_partner_dashboard');
  if (error) throw error;
  const raw = (data ?? {}) as any;
  return {
    configured: Boolean(raw.configured),
    id: raw.id ?? undefined,
    kind: raw.kind ?? undefined,
    code: raw.code ?? undefined,
    commissionPercent: Number(raw.commissionPercent ?? 0),
    territories: Array.isArray(raw.territories) ? raw.territories : [],
    centrals: Array.isArray(raw.centrals) ? raw.centrals.map(mapVisibleNetworkCentral) : [],
    centralCount: Number(raw.centralCount ?? 0),
    monthlySales: Number(raw.monthlySales ?? 0),
    pendingCommission: Number(raw.pendingCommission ?? 0),
    availableCommission: Number(raw.availableCommission ?? 0),
    paidCommission: Number(raw.paidCommission ?? 0),
    teamCount: Number(raw.teamCount ?? 0),
  };
}

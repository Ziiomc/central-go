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

export interface PartnerDirectoryItem {
  id: string;
  userId: string;
  name: string;
  email: string;
  phone: string;
  kind: 'regional' | 'sales';
  code: string;
  commissionPercent: number;
  active: boolean;
  createdAt: string;
  parentPartnerId: string | null;
  parentName: string | null;
  territories: PartnerTerritory[];
  centralCount: number;
  activeCentralCount: number;
  monthlySales: number;
  pendingCommission: number;
  availableCommission: number;
  paidCommission: number;
}

export interface PartnerInviteResult {
  invited: boolean;
  partnerId: string;
  message: string;
  delivery: 'email' | 'whatsapp';
  activationUrl: string | null;
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

export async function loadVisiblePartners(): Promise<PartnerDirectoryItem[]> {
  const db = requireSupabase();
  const { data, error } = await db.rpc('centralgo_visible_partners');
  if (error) throw error;
  const rows = Array.isArray(data) ? data : [];
  return rows.map((row: any) => ({
    id: String(row.id),
    userId: String(row.userId),
    name: row.name ?? 'Partner',
    email: row.email ?? '',
    phone: row.phone ?? '',
    kind: row.kind,
    code: row.code ?? '',
    commissionPercent: Number(row.commissionPercent ?? 0),
    active: Boolean(row.active),
    createdAt: row.createdAt ?? '',
    parentPartnerId: row.parentPartnerId ?? null,
    parentName: row.parentName ?? null,
    territories: Array.isArray(row.territories) ? row.territories : [],
    centralCount: Number(row.centralCount ?? 0),
    activeCentralCount: Number(row.activeCentralCount ?? 0),
    monthlySales: Number(row.monthlySales ?? 0),
    pendingCommission: Number(row.pendingCommission ?? 0),
    availableCommission: Number(row.availableCommission ?? 0),
    paidCommission: Number(row.paidCommission ?? 0),
  }));
}

export async function inviteNetworkPartner(input: {
  name: string;
  email: string;
  kind: 'regional' | 'sales';
  code: string;
  commissionPercent: number;
  parentPartnerId?: string | null;
  countryCode?: string;
  region?: string;
  city?: string;
  redirectTo?: string;
  delivery?: 'email' | 'whatsapp';
}): Promise<PartnerInviteResult> {
  const db = requireSupabase();
  const { data, error } = await db.functions.invoke('invite-network-user', { body: input });
  if (error) throw error;
  if (data?.error) throw new Error(String(data.error));
  return {
    invited: Boolean(data?.invited),
    partnerId: String(data?.partnerId ?? ''),
    message: data?.message ?? 'Partner configurado',
    delivery: data?.delivery === 'whatsapp' ? 'whatsapp' : 'email',
    activationUrl: typeof data?.activationUrl === 'string' && data.activationUrl ? data.activationUrl : null,
  };
}

export async function setPartnerStatus(partnerId: string, active: boolean) {
  const db = requireSupabase();
  const { error } = await db.rpc('centralgo_superadmin_set_partner_status', { p_partner_id: partnerId, p_active: active });
  if (error) throw error;
}

export async function changePartnerKind(partnerId: string, kind: 'regional' | 'sales', parentPartnerId?: string | null) {
  const db = requireSupabase();
  const { data, error } = await db.rpc('centralgo_owner_change_partner_kind', {
    p_partner_id: partnerId,
    p_kind: kind,
    p_parent_partner_id: parentPartnerId ?? null,
  });
  if (error) throw error;
  return data as { partnerId?: string; kind?: 'regional' | 'sales'; reassignedChildren?: number; unchanged?: boolean } | null;
}

export async function archivePartnerProfile(partnerId: string) {
  const db = requireSupabase();
  const { data, error } = await db.rpc('centralgo_owner_archive_partner_profile', { p_partner_id: partnerId });
  if (error) throw error;
  return data as { partnerId?: string; userId?: string; archived?: boolean } | null;
}

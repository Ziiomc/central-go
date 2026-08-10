import { requireSupabase } from './supabase';

export interface CommissionLedgerItem {
  id: string;
  partnerId: string;
  partnerName: string;
  partnerKind: 'regional' | 'sales';
  companyId: string;
  companyName: string;
  paymentId: string | null;
  commissionType: string;
  grossAmount: number;
  ratePercent: number;
  amount: number;
  status: 'pending' | 'confirmed' | 'available' | 'paid' | 'reversed';
  earnedAt: string;
  availableAt: string | null;
  paidAt: string | null;
  reversedAt: string | null;
  notes: string | null;
}

export async function loadVisibleCommissions(): Promise<CommissionLedgerItem[]> {
  const db = requireSupabase();
  const { data, error } = await db.rpc('centralgo_visible_commissions');
  if (error) throw error;
  const rows = Array.isArray(data) ? data : [];
  return rows.map((row: any) => ({
    id: String(row.id),
    partnerId: String(row.partnerId),
    partnerName: row.partnerName ?? 'Partner',
    partnerKind: row.partnerKind,
    companyId: String(row.companyId),
    companyName: row.companyName ?? 'Central',
    paymentId: row.paymentId ?? null,
    commissionType: row.commissionType ?? '',
    grossAmount: Number(row.grossAmount ?? 0),
    ratePercent: Number(row.ratePercent ?? 0),
    amount: Number(row.amount ?? 0),
    status: row.status,
    earnedAt: row.earnedAt ?? '',
    availableAt: row.availableAt ?? null,
    paidAt: row.paidAt ?? null,
    reversedAt: row.reversedAt ?? null,
    notes: row.notes ?? null,
  }));
}

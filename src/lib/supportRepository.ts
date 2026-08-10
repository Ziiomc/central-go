import { requireSupabase } from './supabase';

export type SupportTicketStatus = 'open' | 'in_progress' | 'waiting_customer' | 'resolved' | 'closed';

export interface SupportTicketRecord {
  id: string;
  companyId: string | null;
  companyName: string;
  createdBy: string;
  createdByName: string;
  assignedPartnerId: string | null;
  assignedPartnerName: string;
  assignedPartnerKind: 'regional' | 'sales' | null;
  subject: string;
  description: string;
  priority: string;
  status: SupportTicketStatus;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
}

export async function loadVisibleSupportTickets(): Promise<SupportTicketRecord[]> {
  const db = requireSupabase();
  const { data, error } = await db.rpc('centralgo_visible_support_tickets');
  if (error) throw error;
  const rows = Array.isArray(data) ? data : [];
  return rows.map((row: any) => ({
    id: String(row.id),
    companyId: row.companyId ?? null,
    companyName: row.companyName ?? 'Central',
    createdBy: String(row.createdBy ?? ''),
    createdByName: row.createdByName ?? 'Usuario',
    assignedPartnerId: row.assignedPartnerId ?? null,
    assignedPartnerName: row.assignedPartnerName ?? 'Sin asignar',
    assignedPartnerKind: row.assignedPartnerKind ?? null,
    subject: row.subject ?? '',
    description: row.description ?? '',
    priority: row.priority ?? 'normal',
    status: row.status,
    createdAt: row.createdAt ?? '',
    updatedAt: row.updatedAt ?? '',
    resolvedAt: row.resolvedAt ?? null,
  }));
}

export async function updateSupportTicketStatus(id: string, status: SupportTicketStatus) {
  const db = requireSupabase();
  const { error } = await db.rpc('centralgo_update_support_ticket', { p_ticket_id: id, p_status: status });
  if (error) throw error;
}

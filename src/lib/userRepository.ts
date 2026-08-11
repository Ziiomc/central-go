import { requireSupabase } from './supabase';

export type CompanyUserRole = 'company_admin' | 'operator' | 'driver';

export interface CompanyUserDirectoryItem {
  userId: string;
  name: string;
  email: string;
  phone: string;
  role: CompanyUserRole;
  active: boolean;
  createdAt: string;
}

export async function loadCompanyUsers(companyId: string): Promise<CompanyUserDirectoryItem[]> {
  const db = requireSupabase();
  const { data, error } = await db.rpc('centralgo_company_user_directory', { p_company_id: companyId });
  if (error) throw error;
  const rows = Array.isArray(data) ? data : [];
  return rows.map((row: any) => ({
    userId: String(row.userId),
    name: row.name ?? 'Usuario',
    email: row.email ?? '',
    phone: row.phone ?? '',
    role: row.role,
    active: Boolean(row.active),
    createdAt: row.createdAt ?? '',
  }));
}

export async function inviteCompanyUser(input: {
  companyId: string;
  email: string;
  role: CompanyUserRole;
  name?: string;
  redirectTo?: string;
  initialPassword?: string;
}): Promise<{ invited: boolean; passwordReady: boolean; message: string; userId: string }> {
  const db = requireSupabase();
  const { data, error } = await db.functions.invoke('invite-company-user', {
    body: {
      companyId: input.companyId,
      email: input.email.trim().toLowerCase(),
      role: input.role,
      name: input.name?.trim() || undefined,
      redirectTo: input.redirectTo,
      password: input.initialPassword || undefined,
    },
  });
  if (error) throw error;
  if (data?.error) throw new Error(String(data.error));
  return {
    invited: Boolean(data?.invited),
    passwordReady: Boolean(data?.passwordReady),
    message: data?.message ?? 'Usuario vinculado',
    userId: String(data?.userId ?? ''),
  };
}

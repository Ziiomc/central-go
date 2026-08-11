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

export interface CompanyInviteResult {
  invited: boolean;
  emailPending: boolean;
  passwordReady: boolean;
  needsPasswordSetup: boolean;
  message: string;
  userId: string;
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
}): Promise<CompanyInviteResult> {
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

  if (error) {
    const message = error.message || 'No fue posible administrar el acceso.';
    if (/non-2xx|edge function/i.test(message)) {
      throw new Error('No fue posible completar la invitación. Actualiza e inténtalo nuevamente; si el correo está temporalmente limitado, Central GO conservará la cuenta como pendiente.');
    }
    throw error;
  }
  if (data?.error) throw new Error(String(data.error));

  return {
    invited: Boolean(data?.invited),
    emailPending: Boolean(data?.emailPending),
    passwordReady: Boolean(data?.passwordReady),
    needsPasswordSetup: Boolean(data?.needsPasswordSetup),
    message: data?.message ?? 'Usuario vinculado',
    userId: String(data?.userId ?? ''),
  };
}

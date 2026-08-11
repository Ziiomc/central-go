import { requireSupabase } from './supabase';

export type DriverAccessAction = 'status' | 'send' | 'link';

export interface DriverAccessResult {
  email: string;
  active: boolean;
  sent: boolean;
  emailPending: boolean;
  needsSetup: boolean;
  emailConfirmed: boolean;
  actionLink?: string;
  message: string;
}

export async function requestDriverAccess(input: {
  companyId: string;
  userId: string;
  action?: DriverAccessAction;
}): Promise<DriverAccessResult> {
  const { data, error } = await requireSupabase().functions.invoke('driver-access', {
    body: input,
  });

  if (error) {
    throw new Error(error.message || 'No fue posible administrar el acceso del conductor.');
  }
  if (data?.error) throw new Error(String(data.error));

  return {
    email: String(data?.email ?? ''),
    active: Boolean(data?.active),
    sent: Boolean(data?.sent),
    emailPending: Boolean(data?.emailPending),
    needsSetup: Boolean(data?.needsSetup),
    emailConfirmed: Boolean(data?.emailConfirmed),
    actionLink: data?.actionLink ? String(data.actionLink) : undefined,
    message: String(data?.message ?? 'Acceso actualizado'),
  };
}

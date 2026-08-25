import { requireSupabase } from './supabase';

export const OPERATOR_TERMINAL_STORAGE_KEY = 'centralgo:operator-terminal';

export interface OperatorTerminalConfig {
  id: string;
  companyId: string;
  companyName: string;
  label: string;
}

export const normalizeOperatorUsername = (value: string) => value.trim().toLowerCase();

export const isValidOperatorUsername = (value: string) => /^[a-z0-9][a-z0-9._-]{2,31}$/.test(normalizeOperatorUsername(value));

export const operatorInternalEmail = (companyId: string, username: string) =>
  `${normalizeOperatorUsername(username)}@${companyId}.operators.centralgo.app`;

export const readOperatorTerminal = (): OperatorTerminalConfig | null => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(OPERATOR_TERMINAL_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<OperatorTerminalConfig>;
    if (!parsed.id || !parsed.companyId || !parsed.companyName || !parsed.label) return null;
    return {
      id: String(parsed.id),
      companyId: String(parsed.companyId),
      companyName: String(parsed.companyName),
      label: String(parsed.label),
    };
  } catch {
    return null;
  }
};

export const saveOperatorTerminal = (terminal: OperatorTerminalConfig) => {
  window.localStorage.setItem(OPERATOR_TERMINAL_STORAGE_KEY, JSON.stringify(terminal));
};

export const clearOperatorTerminal = () => {
  if (typeof window !== 'undefined') window.localStorage.removeItem(OPERATOR_TERMINAL_STORAGE_KEY);
};

export const authorizeThisOperatorTerminal = async (input: {
  companyId: string;
  companyName: string;
  label: string;
}): Promise<OperatorTerminalConfig> => {
  const db = requireSupabase();
  const { data: authData, error: authError } = await db.auth.getUser();
  if (authError || !authData.user) throw new Error('Debes iniciar sesión como administrador para autorizar este computador.');

  const label = input.label.trim() || 'Terminal operativa';
  const { data, error } = await db.from('operator_terminals').insert({
    company_id: input.companyId,
    label,
    authorized_by: authData.user.id,
    active: true,
  }).select('id,company_id,label').single();
  if (error) throw error;

  const terminal: OperatorTerminalConfig = {
    id: String(data.id),
    companyId: String(data.company_id),
    companyName: input.companyName,
    label: String(data.label),
  };
  saveOperatorTerminal(terminal);
  return terminal;
};

export const revokeThisOperatorTerminal = async (terminal: OperatorTerminalConfig) => {
  const db = requireSupabase();
  const { error } = await db.from('operator_terminals')
    .update({ active: false, updated_at: new Date().toISOString() })
    .eq('id', terminal.id)
    .eq('company_id', terminal.companyId);
  if (error) throw error;
  clearOperatorTerminal();
};

export const validateOperatorTerminalSession = async (terminal: OperatorTerminalConfig, userId: string) => {
  const db = requireSupabase();
  const [{ data: membership, error: membershipError }, { data: terminalRow, error: terminalError }] = await Promise.all([
    db.from('company_memberships')
      .select('user_id')
      .eq('company_id', terminal.companyId)
      .eq('user_id', userId)
      .eq('role', 'operator')
      .eq('active', true)
      .maybeSingle(),
    db.from('operator_terminals')
      .select('id')
      .eq('id', terminal.id)
      .eq('company_id', terminal.companyId)
      .eq('active', true)
      .maybeSingle(),
  ]);
  if (membershipError) throw membershipError;
  if (terminalError) throw terminalError;
  return Boolean(membership && terminalRow);
};

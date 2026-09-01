import type { AuthResponse, UserResponse } from '@supabase/supabase-js';
import { requireSupabase } from './supabase';
import {
  deriveCompatibleAuthPassword,
  passwordCandidatesForLogin,
  validateAuthPassword,
} from './authPasswordPolicy';

export type DirectSignupRole = 'central' | 'driver' | 'sales_partner';

const normalizeEmail = (email: string) => email.trim().toLowerCase();

const readFunctionErrorMessage = async (error: unknown): Promise<string | null> => {
  const candidate = error as { context?: Response; message?: string } | null;
  const response = candidate?.context;
  if (!response) return null;
  try {
    const payload = await response.clone().json() as { error?: string; message?: string };
    return payload?.error || payload?.message || null;
  } catch {
    return null;
  }
};

export const createPasswordAccountWithoutEmail = async (
  email: string,
  password: string,
  role: DirectSignupRole,
) => {
  const normalized = normalizeEmail(email);
  if (!normalized.includes('@')) throw new Error('Ingresa un correo válido.');
  const passwordError = validateAuthPassword(password);
  if (passwordError) throw new Error(passwordError);

  const { data, error } = await requireSupabase().functions.invoke('password-signup', {
    body: { email: normalized, password, role },
  });
  if (error) {
    const serverMessage = await readFunctionErrorMessage(error);
    throw new Error(serverMessage || error.message || 'No fue posible crear la cuenta.');
  }
  if (data?.error) throw new Error(String(data.error));
  return data as { ok: true; created?: boolean; activated?: boolean };
};

export const signInWithCompatiblePassword = async (email: string, password: string): Promise<AuthResponse> => {
  const normalized = normalizeEmail(email);
  if (!normalized.includes('@')) throw new Error('Ingresa un correo válido.');
  const candidates = await passwordCandidatesForLogin(normalized, password);
  let lastError: unknown = null;

  for (const candidate of candidates) {
    const result = await requireSupabase().auth.signInWithPassword({ email: normalized, password: candidate });
    if (!result.error) return result;
    lastError = result.error;
    if (!/invalid login credentials|weak_password|password.*(?:lowercase|uppercase|digit|symbol|character)/i.test(result.error.message ?? '')) {
      break;
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Correo o contraseña incorrectos.');
};

export const updateWithCompatiblePassword = async (email: string, password: string): Promise<UserResponse> => {
  const passwordError = validateAuthPassword(password);
  if (passwordError) throw new Error(passwordError);
  const internalPassword = await deriveCompatibleAuthPassword(normalizeEmail(email), password);
  return requireSupabase().auth.updateUser({ password: internalPassword });
};

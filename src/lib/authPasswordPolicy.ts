export const AUTH_PASSWORD_MIN_LENGTH = 8;

const HAS_LOWERCASE = /[a-z]/;
const HAS_UPPERCASE = /[A-Z]/;
const HAS_NUMBER = /[0-9]/;
const HAS_SYMBOL = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>/?`~]/;

export interface AuthPasswordChecks {
  length: boolean;
}

export const getAuthPasswordChecks = (password: string): AuthPasswordChecks => ({
  length: password.length >= AUTH_PASSWORD_MIN_LENGTH,
});

export const validateAuthPassword = (password: string) => {
  const checks = getAuthPasswordChecks(password);
  if (!checks.length) return `La contraseña debe tener al menos ${AUTH_PASSWORD_MIN_LENGTH} caracteres.`;
  return null;
};

export const isServerCompatibleAuthPassword = (password: string) =>
  password.length >= 10 &&
  HAS_LOWERCASE.test(password) &&
  HAS_UPPERCASE.test(password) &&
  HAS_NUMBER.test(password) &&
  HAS_SYMBOL.test(password);

export const deriveCompatibleAuthPassword = async (email: string, password: string) => {
  const normalizedEmail = email.trim().toLowerCase();
  const payload = new TextEncoder().encode(`centralgo-password-v1|${normalizedEmail}|${password}`);
  const digest = await globalThis.crypto.subtle.digest('SHA-256', payload);
  const hex = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
  return `Cg1!${hex}`;
};

export const passwordCandidatesForLogin = async (email: string, password: string) => {
  const compatible = await deriveCompatibleAuthPassword(email, password);

  // Accounts created by the current flow store the derived password. Older
  // Central GO accounts (including the first manual operator terminals) may
  // still store exactly the password the administrator originally assigned.
  // Always try both so a frontend authentication upgrade can never invalidate
  // an already-issued operator credential.
  return compatible === password ? [compatible] : [compatible, password];
};

export const friendlyAuthError = (error: unknown, fallback: string) => {
  const message = error instanceof Error ? error.message : String(error ?? '');
  if (/password should contain at least one character of each|weak_password|password.*(?:lowercase|uppercase|digit|symbol|character)/i.test(message)) {
    return 'La contraseña debe tener al menos 8 caracteres.';
  }
  if (/email not confirmed|email_not_confirmed/i.test(message)) return 'Esta cuenta antigua aún no está activada. En “Crear cuenta”, usa el mismo correo y define una contraseña para activarla sin enlaces por email.';
  if (/invalid login credentials/i.test(message)) return 'Correo o contraseña incorrectos.';
  if (/user already registered|already been registered/i.test(message)) return 'Este correo ya está registrado. Usa “Ya tengo cuenta”.';
  if (/rate limit|too many requests/i.test(message)) return 'Hubo demasiados intentos seguidos. Espera un momento y vuelve a intentar.';
  return message || fallback;
};

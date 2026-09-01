export const AUTH_PASSWORD_MIN_LENGTH = 8;

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

export const friendlyAuthError = (error: unknown, fallback: string) => {
  const message = error instanceof Error ? error.message : String(error ?? '');
  if (/password should contain at least one character of each|weak_password|password.*(?:lowercase|uppercase|digit|symbol|character)/i.test(message)) {
    return 'La contraseña debe tener al menos 8 caracteres.';
  }
  if (/email not confirmed|email_not_confirmed/i.test(message)) return 'Tu correo aún no está confirmado. Revisa tu bandeja de entrada o solicita un nuevo enlace.';
  if (/invalid login credentials/i.test(message)) return 'Correo o contraseña incorrectos.';
  if (/user already registered|already been registered/i.test(message)) return 'Este correo ya está registrado. Usa “Ya tengo cuenta” o recupera tu contraseña.';
  if (/email rate limit exceeded|over_email_send_rate_limit|rate limit|too many requests/i.test(message)) return 'Se alcanzó temporalmente el límite de correos. Espera unos minutos antes de volver a intentarlo.';
  if (/email link is invalid|expired|otp_expired|one-time token not found/i.test(message)) return 'Este enlace ya fue utilizado o dejó de ser válido. Solicita uno nuevo.';
  return message || fallback;
};

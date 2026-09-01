export const AUTH_PASSWORD_MIN_LENGTH = 10;

const HAS_LOWERCASE = /[a-z]/;
const HAS_UPPERCASE = /[A-Z]/;
const HAS_NUMBER = /[0-9]/;
const HAS_SYMBOL = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>/?`~]/;

export interface AuthPasswordChecks {
  length: boolean;
  lowercase: boolean;
  uppercase: boolean;
  number: boolean;
  symbol: boolean;
}

export const getAuthPasswordChecks = (password: string): AuthPasswordChecks => ({
  length: password.length >= AUTH_PASSWORD_MIN_LENGTH,
  lowercase: HAS_LOWERCASE.test(password),
  uppercase: HAS_UPPERCASE.test(password),
  number: HAS_NUMBER.test(password),
  symbol: HAS_SYMBOL.test(password),
});

export const validateAuthPassword = (password: string) => {
  const checks = getAuthPasswordChecks(password);
  if (!checks.length) return `La contraseña debe tener al menos ${AUTH_PASSWORD_MIN_LENGTH} caracteres.`;
  if (!checks.lowercase) return 'Agrega al menos una letra minúscula a la contraseña.';
  if (!checks.uppercase) return 'Agrega al menos una letra mayúscula a la contraseña.';
  if (!checks.number) return 'Agrega al menos un número a la contraseña.';
  if (!checks.symbol) return 'Agrega al menos un símbolo, por ejemplo !, @, # o $.';
  return null;
};

export const friendlyAuthError = (error: unknown, fallback: string) => {
  const message = error instanceof Error ? error.message : String(error ?? '');
  if (/password should contain at least one character of each|weak_password|password.*(?:lowercase|uppercase|digit|symbol|character)/i.test(message)) {
    return 'La contraseña debe tener 10 caracteres o más e incluir minúscula, mayúscula, número y símbolo.';
  }
  if (/email not confirmed|email_not_confirmed/i.test(message)) return 'Tu correo aún no está confirmado. Revisa tu bandeja de entrada o solicita un nuevo enlace.';
  if (/invalid login credentials/i.test(message)) return 'Correo o contraseña incorrectos.';
  if (/user already registered|already been registered/i.test(message)) return 'Este correo ya está registrado. Usa “Ya tengo cuenta” o recupera tu contraseña.';
  if (/email rate limit exceeded|over_email_send_rate_limit|rate limit|too many requests/i.test(message)) return 'Se alcanzó temporalmente el límite de correos. Espera unos minutos antes de volver a intentarlo.';
  if (/email link is invalid|expired|otp_expired|one-time token not found/i.test(message)) return 'Este enlace ya fue utilizado o dejó de ser válido. Solicita uno nuevo.';
  return message || fallback;
};

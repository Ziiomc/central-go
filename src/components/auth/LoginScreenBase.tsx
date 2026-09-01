import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Building2, CarFront, Handshake, Headphones, Loader2, MailCheck } from 'lucide-react';
import {
  ONBOARDING_INTENT_KEY,
  type OnboardingRole,
  useAuth,
} from '../../context/AuthContext';
import { requireSupabase } from '../../lib/supabase';
import { runtimeConfig } from '../../config/runtime';
import { AuthShell } from './AuthShell';
import { PasswordRequirements } from './PasswordRequirements';
import { friendlyAuthError } from '../../lib/authPasswordPolicy';

type DriverActivationPayload = { tokenHash: string; type: 'invite' | 'recovery' };

const getSafeDriverActivationPayload = (): DriverActivationPayload | null => {
  if (typeof window === 'undefined') return null;
  const params = new URLSearchParams(window.location.search);
  if (params.get('driver_activation') !== '1') return null;
  const tokenHash = params.get('driver_token_hash')?.trim() ?? '';
  const type = params.get('driver_type');
  if (!tokenHash || tokenHash.length < 20 || (type !== 'invite' && type !== 'recovery')) return null;
  return { tokenHash, type };
};

const roleOptions: Array<{
  id: OnboardingRole;
  label: string;
  detail: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { id: 'central', label: 'Central', detail: '5 días Full', icon: Building2 },
  { id: 'driver', label: 'Conductor', detail: 'Portal inmediato', icon: CarFront },
  { id: 'operator', label: 'Operadora', detail: 'Acceso administrado', icon: Headphones },
  { id: 'sales_partner', label: 'Socio comercial', detail: 'Requiere aprobación', icon: Handshake },
];

export const LoginScreen: React.FC = () => {
  const { signInWithGoogle, signUp, signIn, requestPasswordReset, identityError } = useAuth();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [role, setRole] = useState<OnboardingRole>('central');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [googleAvailable, setGoogleAvailable] = useState<boolean | null>(null);
  const [recoveryCooldown, setRecoveryCooldown] = useState(0);
  const driverActivation = useMemo(() => getSafeDriverActivationPayload(), []);
  const isDriverActivation = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('driver_activation') === '1';

  useEffect(() => {
    if (recoveryCooldown <= 0) return;
    const timer = window.setInterval(() => setRecoveryCooldown((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [recoveryCooldown]);

  useEffect(() => {
    let active = true;
    fetch(`${runtimeConfig.supabaseUrl}/auth/v1/settings`, {
      headers: { apikey: runtimeConfig.supabasePublishableKey },
    })
      .then((response) => response.ok ? response.json() : Promise.reject(new Error('Auth settings unavailable')))
      .then((settings) => { if (active) setGoogleAvailable(settings?.external?.google === true); })
      .catch(() => { if (active) setGoogleAvailable(null); });
    return () => { active = false; };
  }, []);

  const resetMessages = () => {
    setError('');
    setNotice('');
  };

  const googleLogin = async () => {
    if (googleAvailable === false) {
      setError('El acceso con Google está en configuración. Usa tu correo para entrar.');
      return;
    }
    setBusy(true);
    resetMessages();
    try {
      await signInWithGoogle(mode === 'register' ? role : undefined);
    } catch (err) {
      setError(friendlyAuthError(err, 'No fue posible continuar con Google.'));
      setBusy(false);
    }
  };

  const emailLink = async () => {
    const normalized = email.trim().toLowerCase();
    if (!normalized.includes('@')) {
      setError('Ingresa un correo válido.');
      return;
    }
    if (role === 'operator' && mode === 'register') return;
    setBusy(true);
    resetMessages();
    try {
      if (mode === 'register' && typeof window !== 'undefined') {
        window.localStorage.setItem(ONBOARDING_INTENT_KEY, role);
      }
      const db = requireSupabase();
      const { error: otpError } = await db.auth.signInWithOtp({
        email: normalized,
        options: {
          shouldCreateUser: mode === 'register',
          emailRedirectTo: `${runtimeConfig.officialAppUrl}/`,
          ...(mode === 'register' ? { data: { account_kind: role } } : {}),
        },
      });
      if (otpError) throw otpError;
      setNotice(mode === 'register'
        ? `Te enviamos un enlace seguro a ${normalized}. Ábrelo para crear tu cuenta y continuar. No necesitas contraseña.`
        : `Te enviamos un enlace seguro a ${normalized}. Ábrelo para entrar a Central GO. No necesitas contraseña.`);
    } catch (err) {
      setError(friendlyAuthError(err, mode === 'register' ? 'No fue posible enviar el enlace para crear tu cuenta.' : 'No fue posible enviar el enlace de acceso.'));
    } finally {
      setBusy(false);
    }
  };

  const emailSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    resetMessages();
    try {
      if (mode === 'register') {
        if (password !== confirmPassword) throw new Error('Las contraseñas no coinciden.');
        const active = await signUp(email, password, role);
        if (!active) {
          setNotice('Cuenta creada. Revisa tu correo y confirma el enlace para continuar con tu perfil.');
          setPassword('');
          setConfirmPassword('');
          setBusy(false);
        }
      } else {
        await signIn(email, password);
      }
    } catch (err) {
      setError(friendlyAuthError(err, mode === 'register' ? 'No fue posible crear tu cuenta.' : 'No fue posible iniciar sesión.'));
      setBusy(false);
    }
  };

  const recoverPassword = async () => {
    if (recoveryCooldown > 0) return;
    setBusy(true);
    resetMessages();
    try {
      await requestPasswordReset(email);
      setRecoveryCooldown(60);
      setNotice('Correo de recuperación enviado. Abre solamente el mensaje más reciente.');
    } catch (err) {
      setRecoveryCooldown(60);
      setError(friendlyAuthError(err, 'No fue posible enviar el enlace de recuperación.'));
    } finally {
      setBusy(false);
    }
  };

  const activateDriver = async () => {
    if (!driverActivation || busy) return;
    setBusy(true);
    resetMessages();
    try {
      const db = requireSupabase();
      const { data, error: verifyError } = await db.auth.verifyOtp({
        token_hash: driverActivation.tokenHash,
        type: driverActivation.type,
      });
      if (verifyError) throw verifyError;
      if (!data.session) throw new Error('No fue posible iniciar la sesión del conductor.');
      const clean = new URL(window.location.href);
      clean.searchParams.delete('driver_activation');
      clean.searchParams.delete('driver_token_hash');
      clean.searchParams.delete('driver_type');
      window.history.replaceState({}, document.title, `${clean.pathname}${clean.search}${clean.hash}`);
      window.location.replace('/driver');
    } catch (err) {
      setError(friendlyAuthError(err, 'No fue posible activar la cuenta del conductor.'));
      setBusy(false);
    }
  };

  const changeMode = (next: 'login' | 'register') => {
    setMode(next);
    setShowPassword(false);
    setPassword('');
    setConfirmPassword('');
    resetMessages();
  };

  if (isDriverActivation) {
    return (
      <AuthShell compact eyebrow="Acceso profesional" title="Activa tu cuenta de conductor">
        <p className="cg-card-kicker">Central GO conductor</p>
        <h1 className="cg-card-title">Tu acceso está listo</h1>
        <p className="cg-card-copy">Confirma el enlace seguro para entrar a la aplicación del conductor.</p>
        {error && <div className="cg-alert cg-alert-error">{error}</div>}
        {driverActivation && (
          <button type="button" disabled={busy} onClick={() => void activateDriver()} className="cg-primary-button mt-6">
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            {busy ? 'Activando…' : 'Activar mi cuenta'}
          </button>
        )}
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <p className="cg-card-kicker">Bienvenido a Central GO</p>
      <h2 className="cg-card-title">{mode === 'login' ? 'Vuelve a tu operación' : 'Crea tu cuenta'}</h2>
      <p className="cg-card-copy">
        {mode === 'login'
          ? 'La forma más simple es entrar con un enlace enviado a tu correo. También puedes usar Google o tu contraseña.'
          : 'Puedes crear tu cuenta sólo con tu correo. No necesitas Google ni crear una contraseña.'}
      </p>

      {(error || identityError) && <div className="cg-alert cg-alert-error">{error || friendlyAuthError(identityError, identityError)}</div>}
      {notice && <div className="cg-alert cg-alert-success">{notice}</div>}

      <div className="cg-segmented" role="tablist" aria-label="Acceso a Central GO">
        <button type="button" role="tab" aria-selected={mode === 'login'} data-active={mode === 'login'} onClick={() => changeMode('login')}>Iniciar sesión</button>
        <button type="button" role="tab" aria-selected={mode === 'register'} data-active={mode === 'register'} onClick={() => changeMode('register')}>Crear cuenta</button>
      </div>

      {mode === 'register' && (
        <>
          <div className="cg-role-grid" aria-label="Cómo quieres participar">
            {roleOptions.map(({ id, label, detail, icon: Icon }) => (
              <button key={id} type="button" className="cg-role-card" data-active={role === id} aria-pressed={role === id} onClick={() => { setRole(id); setShowPassword(false); resetMessages(); }}>
                <span className="cg-role-icon"><Icon /></span>
                <strong>{label}</strong>
                <small>{detail}</small>
              </button>
            ))}
          </div>
          {role === 'sales_partner' && <div className="cg-alert cg-alert-warning"><AlertTriangle className="mr-1.5 inline h-4 w-4" />La cuenta comercial necesita aprobación del superadministrador. El plazo habitual informado es de hasta 3 horas, pero puede aprobarse antes.</div>}
        </>
      )}

      <button type="button" disabled={busy || googleAvailable === false} onClick={() => void googleLogin()} className="cg-google-button">
        <span className="cg-google-mark" aria-hidden="true">G</span>
        {googleAvailable === false ? 'Google en configuración' : mode === 'login' ? 'Continuar con Google' : 'Crear cuenta con Google'}
      </button>
      {googleAvailable === false && <p className="cg-auth-hint">No hay problema: puedes entrar directamente con tu correo.</p>}

      {role !== 'operator' && <div className="cg-divider">o usa sólo tu correo</div>}

      {role !== 'operator' && <div className="cg-form">
        <label className="cg-field">
          <span>Correo electrónico</span>
          <input required type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="tu@correo.com" />
        </label>
        <button type="button" disabled={busy || !email.trim()} onClick={() => void emailLink()} className="cg-primary-button">
          <MailCheck className="h-4 w-4" />
          {busy ? 'Enviando…' : mode === 'register' ? 'Crear cuenta sólo con correo' : 'Entrar con enlace al correo'}
        </button>
        <button type="button" disabled={busy} onClick={() => { setShowPassword((value) => !value); resetMessages(); }} className="cg-subtle-button w-full">
          {showPassword ? 'Ocultar contraseña' : mode === 'register' ? 'Prefiero crear una contraseña' : 'Entrar con contraseña'}
        </button>
      </div>}

      {role !== 'operator' && showPassword && <>
        <div className="cg-divider">contraseña opcional</div>
        <form onSubmit={emailSubmit} className="cg-form">
          <label className="cg-field">
            <span>Contraseña</span>
            <input required minLength={mode === 'register' ? 10 : undefined} type="password" autoComplete={mode === 'register' ? 'new-password' : 'current-password'} value={password} onChange={(event) => setPassword(event.target.value)} placeholder={mode === 'register' ? 'Contraseña segura' : 'Tu contraseña'} />
          </label>
          {mode === 'register' && <PasswordRequirements password={password} />}
          {mode === 'register' && (
            <label className="cg-field">
              <span>Repetir contraseña</span>
              <input required minLength={10} type="password" autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} placeholder="Repite tu contraseña" />
            </label>
          )}
          <button disabled={busy || !email.trim()} className="cg-primary-button">
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            {busy ? (mode === 'register' ? 'Creando cuenta…' : 'Ingresando…') : (mode === 'register' ? 'Crear cuenta con contraseña' : 'Entrar con contraseña')}
          </button>
        </form>
      </>}
      {mode === 'register' && role === 'operator' && <div className="cg-alert cg-alert-info">El administrador crea el acceso de cada operadora y autoriza el computador desde el módulo Operadores. También puede invitar una cuenta Google.</div>}

      {mode === 'login' && showPassword && (
        <button type="button" disabled={busy || !email.trim() || recoveryCooldown > 0} onClick={() => void recoverPassword()} className="cg-subtle-button w-full disabled:opacity-40">
          {recoveryCooldown > 0 ? `Puedes volver a solicitar en ${recoveryCooldown}s` : 'Olvidé mi contraseña'}
        </button>
      )}

      <p className="cg-auth-hint">
        {mode === 'register' ? 'Recomendado: sólo correo. Tu usuario queda guardado en Central GO y Google es opcional.' : 'Recomendado: enlace al correo. No necesitas recordar una contraseña.'}
      </p>
    </AuthShell>
  );
};

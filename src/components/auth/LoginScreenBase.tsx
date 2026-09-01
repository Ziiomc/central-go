import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Building2, CarFront, Handshake, Headphones, Loader2 } from 'lucide-react';
import { ONBOARDING_INTENT_KEY, type OnboardingRole, useAuth } from '../../context/AuthContext';
import { requireSupabase } from '../../lib/supabase';
import { runtimeConfig } from '../../config/runtime';
import { createPasswordAccountWithoutEmail, signInWithCompatiblePassword } from '../../lib/passwordAuth';
import { friendlyAuthError } from '../../lib/authPasswordPolicy';
import { AuthShell } from './AuthShell';
import { PasswordRequirements } from './PasswordRequirements';

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
  const { signInWithGoogle, identityError } = useAuth();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [role, setRole] = useState<OnboardingRole>('central');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [googleAvailable, setGoogleAvailable] = useState<boolean | null>(null);
  const driverActivation = useMemo(() => getSafeDriverActivationPayload(), []);
  const isDriverActivation = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('driver_activation') === '1';

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

  const resetMessages = () => setError('');

  const googleLogin = async () => {
    if (googleAvailable === false) {
      setError('El acceso con Google está en configuración. Usa tu correo y contraseña.');
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

  const emailSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    resetMessages();
    try {
      const normalized = email.trim().toLowerCase();
      if (!normalized.includes('@')) throw new Error('Ingresa un correo válido.');

      if (mode === 'register') {
        if (role === 'operator') throw new Error('El administrador de la central crea las cuentas de operadores.');
        if (password !== confirmPassword) throw new Error('Las contraseñas no coinciden.');
        window.localStorage.setItem(ONBOARDING_INTENT_KEY, role);
        await createPasswordAccountWithoutEmail(normalized, password, role as 'central' | 'driver' | 'sales_partner');
      }

      const { data } = await signInWithCompatiblePassword(normalized, password);
      if (!data.session) throw new Error('No fue posible iniciar la sesión.');
      window.location.replace('/');
    } catch (err) {
      setError(friendlyAuthError(err, mode === 'register' ? 'No fue posible crear tu cuenta.' : 'No fue posible iniciar sesión.'));
      setBusy(false);
    }
  };

  const activateDriver = async () => {
    if (!driverActivation || busy) return;
    setBusy(true);
    resetMessages();
    try {
      const db = requireSupabase();
      const { data, error: verifyError } = await db.auth.verifyOtp({ token_hash: driverActivation.tokenHash, type: driverActivation.type });
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
    setPassword('');
    setConfirmPassword('');
    resetMessages();
  };

  if (isDriverActivation) {
    return (
      <AuthShell compact eyebrow="Acceso profesional" title="Activa tu cuenta de conductor">
        <p className="cg-card-kicker">Central GO conductor</p>
        <h1 className="cg-card-title">Tu acceso está listo</h1>
        <p className="cg-card-copy">Este acceso antiguo sigue disponible para quienes ya recibieron una invitación.</p>
        {error && <div className="cg-alert cg-alert-error">{error}</div>}
        {driverActivation && <button type="button" disabled={busy} onClick={() => void activateDriver()} className="cg-primary-button mt-6">{busy && <Loader2 className="h-4 w-4 animate-spin" />}{busy ? 'Activando…' : 'Activar mi cuenta'}</button>}
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <p className="cg-card-kicker">Bienvenido a Central GO</p>
      <h2 className="cg-card-title">{mode === 'login' ? 'Vuelve a tu operación' : 'Crea tu cuenta'}</h2>
      <p className="cg-card-copy">
        {mode === 'login'
          ? 'Ingresa con tu correo y contraseña. Google sigue disponible como alternativa.'
          : 'Crea tu cuenta con correo y una contraseña sencilla. La cuenta queda activa de inmediato, sin enlaces de confirmación.'}
      </p>

      {(error || identityError) && <div className="cg-alert cg-alert-error">{error || friendlyAuthError(identityError, identityError)}</div>}

      <div className="cg-segmented" role="tablist" aria-label="Acceso a Central GO">
        <button type="button" role="tab" aria-selected={mode === 'login'} data-active={mode === 'login'} onClick={() => changeMode('login')}>Iniciar sesión</button>
        <button type="button" role="tab" aria-selected={mode === 'register'} data-active={mode === 'register'} onClick={() => changeMode('register')}>Crear cuenta</button>
      </div>

      {mode === 'register' && <>
        <div className="cg-role-grid" aria-label="Cómo quieres participar">
          {roleOptions.map(({ id, label, detail, icon: Icon }) => <button key={id} type="button" className="cg-role-card" data-active={role === id} aria-pressed={role === id} onClick={() => { setRole(id); resetMessages(); }}><span className="cg-role-icon"><Icon /></span><strong>{label}</strong><small>{detail}</small></button>)}
        </div>
        {role === 'sales_partner' && <div className="cg-alert cg-alert-warning"><AlertTriangle className="mr-1.5 inline h-4 w-4" />La cuenta comercial necesita aprobación del superadministrador. El plazo habitual informado es de hasta 3 horas, pero puede aprobarse antes.</div>}
      </>}

      <button type="button" disabled={busy || googleAvailable === false} onClick={() => void googleLogin()} className="cg-google-button">
        <span className="cg-google-mark" aria-hidden="true">G</span>
        {googleAvailable === false ? 'Google en configuración' : mode === 'login' ? 'Continuar con Google' : 'Crear cuenta con Google'}
      </button>
      {googleAvailable === false && <p className="cg-auth-hint">Puedes usar normalmente tu correo y contraseña.</p>}

      {role !== 'operator' && <div className="cg-divider">o usa tu correo y contraseña</div>}

      {role !== 'operator' && <form onSubmit={emailSubmit} className="cg-form">
        <label className="cg-field"><span>Correo electrónico</span><input required type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="tu@correo.com" /></label>
        <label className="cg-field"><span>Contraseña</span><input required minLength={mode === 'register' ? 8 : undefined} type="password" autoComplete={mode === 'register' ? 'new-password' : 'current-password'} value={password} onChange={(event) => setPassword(event.target.value)} placeholder={mode === 'register' ? 'Mínimo 8 caracteres' : 'Tu contraseña'} /></label>
        {mode === 'register' && <PasswordRequirements password={password} />}
        {mode === 'register' && <label className="cg-field"><span>Repetir contraseña</span><input required minLength={8} type="password" autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} placeholder="Repite tu contraseña" /></label>}
        <button disabled={busy} className="cg-primary-button">{busy && <Loader2 className="h-4 w-4 animate-spin" />}{busy ? (mode === 'register' ? 'Creando cuenta…' : 'Ingresando…') : (mode === 'register' ? 'Crear mi cuenta' : 'Iniciar sesión')}</button>
      </form>}

      {mode === 'register' && role === 'operator' && <div className="cg-alert cg-alert-info">El administrador crea el usuario y una contraseña sencilla para cada operadora desde el módulo Operadores. No se necesita un enlace por correo.</div>}
      {mode === 'login' && <p className="cg-auth-hint">¿Olvidaste tu contraseña? Solicita al administrador de tu central o a soporte de Central GO que restablezca el acceso. No enviaremos enlaces de recuperación por correo.</p>}
      {mode === 'register' && <p className="cg-auth-hint">Contraseña simple: 8 caracteres mínimo. Sin requisitos obligatorios de mayúsculas, números o símbolos.</p>}
    </AuthShell>
  );
};

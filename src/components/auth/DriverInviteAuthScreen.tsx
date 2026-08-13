import React, { useEffect, useState } from 'react';
import { Building2, CarFront, Loader2 } from 'lucide-react';
import { ONBOARDING_INTENT_KEY } from '../../context/AuthContext';
import { requireSupabase } from '../../lib/supabase';
import { buildDriverInviteUrl, rememberDriverInviteCode } from '../../lib/driverInvite';
import { AuthShell } from './AuthShell';

const friendly = (error: unknown, fallback: string) => {
  const message = error instanceof Error ? error.message : String(error ?? '');
  if (/invalid login credentials/i.test(message)) return 'Correo o contraseña incorrectos.';
  if (/user already registered|already been registered/i.test(message)) return 'Este correo ya está registrado. Usa “Ya tengo cuenta”.';
  if (/rate limit|too many requests/i.test(message)) return 'Hay demasiados intentos. Intenta nuevamente en unos minutos.';
  return message || fallback;
};

export const DriverInviteAuthScreen: React.FC<{ inviteCode: string }> = ({ inviteCode }) => {
  const [mode, setMode] = useState<'register' | 'login'>('register');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    rememberDriverInviteCode(inviteCode);
    window.localStorage.setItem(ONBOARDING_INTENT_KEY, 'driver');
  }, [inviteCode]);

  const redirectUrl = () => buildDriverInviteUrl(inviteCode);

  const google = async () => {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      rememberDriverInviteCode(inviteCode);
      window.localStorage.setItem(ONBOARDING_INTENT_KEY, 'driver');
      const { error: oauthError } = await requireSupabase().auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: redirectUrl() },
      });
      if (oauthError) throw oauthError;
    } catch (err) {
      setError(friendly(err, 'No fue posible continuar con Google.'));
      setBusy(false);
    }
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const normalized = email.trim().toLowerCase();
      if (!normalized.includes('@')) throw new Error('Ingresa un correo válido.');
      if (password.length < 10) throw new Error('La contraseña debe tener al menos 10 caracteres.');
      rememberDriverInviteCode(inviteCode);
      window.localStorage.setItem(ONBOARDING_INTENT_KEY, 'driver');
      const db = requireSupabase();
      if (mode === 'register') {
        if (password !== confirm) throw new Error('Las contraseñas no coinciden.');
        const { data, error: signUpError } = await db.auth.signUp({
          email: normalized,
          password,
          options: {
            emailRedirectTo: redirectUrl(),
            data: { account_kind: 'driver', driver_invite: inviteCode },
          },
        });
        if (signUpError) throw signUpError;
        if (data.session) {
          window.location.assign(redirectUrl());
          return;
        }
        setNotice('Cuenta creada. Revisa tu correo y confirma el enlace para continuar como conductor.');
        setPassword('');
        setConfirm('');
      } else {
        const { data, error: signInError } = await db.auth.signInWithPassword({ email: normalized, password });
        if (signInError) throw signInError;
        if (data.session) window.location.assign(redirectUrl());
      }
    } catch (err) {
      setError(friendly(err, mode === 'register' ? 'No fue posible crear tu cuenta.' : 'No fue posible iniciar sesión.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell compact eyebrow="Invitación de una central" title="Únete como conductor">
      <div className="flex items-center gap-3">
        <span className="cg-role-icon h-12 w-12"><CarFront className="h-6 w-6" /></span>
        <div>
          <p className="cg-card-kicker">Central GO · Conductor</p>
          <h1 className="cg-card-title text-2xl">Crea tu cuenta de chofer</h1>
        </div>
      </div>
      <div className="mt-4 rounded-2xl border border-[var(--cg-border)] bg-[var(--cg-primary-soft)] p-4">
        <p className="flex items-center gap-2 text-xs font-black text-[var(--cg-text)]"><Building2 className="h-4 w-4 text-[var(--cg-primary)]" /> Invitación de central {inviteCode}</p>
        <p className="mt-1 text-[11px] leading-relaxed text-[var(--cg-muted)]">La invitación no te activa automáticamente. Crearás tu perfil, enviarás tus antecedentes y la central decidirá tu incorporación.</p>
      </div>

      {error && <div className="cg-alert cg-alert-error">{error}</div>}
      {notice && <div className="cg-alert cg-alert-success">{notice}</div>}

      <div className="cg-segmented" role="tablist">
        <button type="button" data-active={mode === 'register'} onClick={() => { setMode('register'); setError(''); setNotice(''); }}>Crear cuenta</button>
        <button type="button" data-active={mode === 'login'} onClick={() => { setMode('login'); setError(''); setNotice(''); }}>Ya tengo cuenta</button>
      </div>

      <button type="button" disabled={busy} onClick={() => void google()} className="cg-google-button">
        <span className="cg-google-mark" aria-hidden="true">G</span>
        {busy ? 'Conectando…' : 'Continuar con Google'}
      </button>
      <div className="cg-divider">o usa tu correo</div>

      <form onSubmit={submit} className="cg-form">
        <label className="cg-field"><span>Correo electrónico</span><input required type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="tu@correo.com" /></label>
        <label className="cg-field"><span>Contraseña</span><input required minLength={10} type="password" autoComplete={mode === 'register' ? 'new-password' : 'current-password'} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Mínimo 10 caracteres" /></label>
        {mode === 'register' && <label className="cg-field"><span>Repetir contraseña</span><input required minLength={10} type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Repite tu contraseña" /></label>}
        <button disabled={busy} className="cg-primary-button">{busy && <Loader2 className="h-4 w-4 animate-spin" />}{busy ? 'Procesando…' : mode === 'register' ? 'Crear cuenta de conductor' : 'Entrar como conductor'}</button>
      </form>
      <p className="cg-auth-hint">Podrás registrarte con Google o correo y luego completar cédula, licencia y, si corresponde, los documentos del vehículo.</p>
    </AuthShell>
  );
};

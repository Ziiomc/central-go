import React, { useEffect, useMemo, useState } from 'react';
import centralGoLogo from '../../assets/images/central-go-logo.svg';
import { useAuth } from '../../context/AuthContext';
import { requireSupabase } from '../../lib/supabase';

const friendlyAuthError = (error: unknown, fallback: string) => {
  const message = error instanceof Error ? error.message : String(error ?? '');
  if (/email rate limit exceeded|over_email_send_rate_limit|too many requests|rate limit/i.test(message)) {
    return 'Supabase alcanzó temporalmente el límite de correos del proyecto. Tu cuenta sigue activa. Si ya recibiste un correo de recuperación, usa únicamente el más reciente: pedir otro invalida el enlace anterior. Espera antes de volver a intentarlo y haz una sola solicitud.';
  }
  if (/email link is invalid|expired|otp_expired|one-time token not found/i.test(message)) {
    return 'Este enlace de acceso ya fue utilizado o dejó de ser válido. Pide al administrador que genere un enlace seguro nuevo y usa únicamente el último.';
  }
  if (/invalid login credentials/i.test(message)) return 'Correo o contraseña incorrectos.';
  return message || fallback;
};

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

export const LoginScreen: React.FC = () => {
  const { signInWithGoogle, signIn, requestPasswordReset, identityError } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [recoveryCooldown, setRecoveryCooldown] = useState(0);
  const driverActivation = useMemo(() => getSafeDriverActivationPayload(), []);
  const isDriverActivation = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('driver_activation') === '1';

  useEffect(() => {
    if (recoveryCooldown <= 0) return;
    const timer = window.setInterval(() => setRecoveryCooldown((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [recoveryCooldown > 0]);

  const googleLogin = async () => {
    setBusy(true); setError(''); setNotice('');
    try { await signInWithGoogle(); }
    catch (err) { setError(friendlyAuthError(err, 'No fue posible continuar con Google.')); setBusy(false); }
  };

  const emailLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true); setError(''); setNotice('');
    try { await signIn(email, password); }
    catch (err) {
      setError(friendlyAuthError(err, 'No fue posible iniciar sesión.'));
      setBusy(false);
    }
  };

  const recoverPassword = async () => {
    if (recoveryCooldown > 0) return;
    setBusy(true); setError(''); setNotice('');
    try {
      await requestPasswordReset(email);
      setRecoveryCooldown(60);
      setNotice('Correo de recuperación enviado. Abre solamente el correo más reciente para crear tu contraseña. No solicites otro mientras tengas este enlace, porque el nuevo invalidaría al anterior.');
    } catch (err) {
      setRecoveryCooldown(60);
      setError(friendlyAuthError(err, 'No fue posible enviar el enlace de recuperación.'));
    } finally { setBusy(false); }
  };

  const activateDriver = async () => {
    if (!driverActivation || busy) return;
    setBusy(true); setError(''); setNotice('');
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

  if (isDriverActivation) {
    return (
      <main className="min-h-screen bg-[#070709] text-zinc-100 flex items-center justify-center p-4 relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(37,99,235,0.18),transparent_44%)]" />
        <section className="relative w-full max-w-md rounded-3xl border border-zinc-800 bg-[#0d0d0f]/95 p-7 sm:p-9 shadow-2xl shadow-black/60">
          <div className="flex items-center gap-3"><img src={centralGoLogo} alt="Central GO" className="h-14 w-14 rounded-2xl border-2 border-blue-400/60 bg-zinc-950 p-1" /><div><p className="text-[10px] font-black uppercase tracking-[0.24em] text-blue-300">Central GO</p><h1 className="text-2xl font-black text-white">Acceso de conductor</h1></div></div>
          <p className="mt-5 text-sm leading-relaxed text-zinc-400">Tu central te dio acceso a la interfaz profesional de conductor. Confirma la activación y luego podrás crear tu contraseña personal.</p>
          <div className="mt-5 rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.06] p-4"><p className="text-xs font-black text-emerald-300">Activación protegida por Central GO</p><p className="mt-1 text-[11px] leading-relaxed text-zinc-400">La verificación se realiza dentro de Central GO. No serás enviado a una página externa de Supabase.</p></div>
          {error && <div className="mt-5 rounded-xl border border-rose-500/25 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{error}</div>}
          {!driverActivation ? (
            <div className="mt-5 rounded-xl border border-rose-500/25 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">Este enlace no es válido. Solicita al administrador de la central que genere uno nuevo.</div>
          ) : (
            <button type="button" disabled={busy} onClick={() => void activateDriver()} className="mt-6 w-full rounded-xl bg-blue-600 px-4 py-3.5 text-sm font-black text-white transition hover:bg-blue-500 disabled:opacity-60">{busy ? 'Activando cuenta…' : 'Activar mi cuenta de conductor'}</button>
          )}
          <p className="mt-4 text-center text-[10px] leading-relaxed text-zinc-600">Después de confirmar, Central GO te pedirá crear una contraseña de al menos 10 caracteres.</p>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#070709] text-zinc-100 flex items-center justify-center p-4 relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(245,158,11,0.14),transparent_44%)]" />
      <section className="relative w-full max-w-md rounded-3xl border border-zinc-800 bg-[#0d0d0f]/95 p-7 sm:p-9 shadow-2xl shadow-black/60">
        <div className="flex items-center gap-3"><img src={centralGoLogo} alt="Central GO" className="h-14 w-14 rounded-2xl border-2 border-amber-400/70 bg-zinc-950 p-1" /><div><p className="text-[10px] font-black uppercase tracking-[0.24em] text-amber-300">Central GO</p><h1 className="text-2xl font-black text-white">Partner Comercial</h1></div></div>
        <p className="mt-5 text-sm leading-relaxed text-zinc-400">Cualquier persona puede crear gratis su cuenta de Partner Comercial. Desde tu panel registras tus centrales y cada una queda visible para Superadmin.</p>
        <div className="mt-5 rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.06] p-4"><p className="text-xs font-black text-emerald-300">Registro abierto y sin vencimiento</p><p className="mt-1 text-[11px] leading-relaxed text-zinc-400">Tu cuenta comercial permanece activa. Las centrales que registres reciben 5 días de prueba y después pueden ser activadas según su plan.</p></div>
        {(error || identityError) && <div className="mt-4 rounded-xl border border-rose-500/25 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{error || friendlyAuthError(identityError, identityError)}</div>}
        {notice && <div className="mt-4 rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">{notice}</div>}

        <button type="button" disabled={busy} onClick={() => void googleLogin()} className="mt-6 w-full rounded-xl bg-white px-4 py-3.5 text-sm font-black text-zinc-950 transition hover:bg-zinc-100 disabled:opacity-60">{busy ? 'Conectando…' : 'Crear cuenta / continuar con Google'}</button>

        <div className="my-5 flex items-center gap-3"><div className="h-px flex-1 bg-zinc-800"/><span className="text-[10px] font-bold uppercase tracking-widest text-zinc-600">¿Ya tienes cuenta? entra con correo</span><div className="h-px flex-1 bg-zinc-800"/></div>

        <form onSubmit={emailLogin} className="space-y-3">
          <input required type="email" autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="Correo electrónico" className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm outline-none focus:border-amber-400/70" />
          <input required type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Contraseña" className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm outline-none focus:border-amber-400/70" />
          <button disabled={busy} className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3.5 text-sm font-black text-white transition hover:bg-zinc-800 disabled:opacity-60">{busy ? 'Ingresando…' : 'Iniciar sesión'}</button>
        </form>
        <button type="button" disabled={busy || !email.trim() || recoveryCooldown > 0} onClick={() => void recoverPassword()} className="mt-3 w-full py-2 text-xs font-bold text-amber-300 disabled:opacity-40">{recoveryCooldown > 0 ? `Puedes volver a solicitar en ${recoveryCooldown}s` : 'Olvidé mi contraseña'}</button>

        <p className="mt-2 text-center text-[10px] leading-relaxed text-zinc-600">Los enlaces de recuperación son de un solo uso. Si solicitas más de uno, abre siempre el correo más reciente.</p>
        <p className="mt-3 text-center text-[10px] text-zinc-600">Las centrales se registran exclusivamente desde cuentas Partner Comercial</p>
      </section>
    </main>
  );
};
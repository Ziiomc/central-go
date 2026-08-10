import React, { useState } from 'react';
import { ExternalLink, KeyRound, Loader2, LockKeyhole, Mail, MonitorPlay, ShieldCheck, Sparkles } from 'lucide-react';
import centralGoLogo from '../../assets/images/central-go-logo.svg';
import { useAuth } from '../../context/AuthContext';
import { runtimeConfig } from '../../config/runtime';

const friendlyAuthError = (error: unknown) => {
  const message = error instanceof Error ? error.message : String(error ?? '');
  if (/failed to fetch|networkerror|load failed|network request failed/i.test(message)) {
    return 'No pudimos conectar con el servidor de Central GO. La aplicación intentó también la ruta de respaldo. Recarga la página y vuelve a intentar; si continúa, prueba otra red y repórtalo a soporte.';
  }
  if (/invalid login credentials/i.test(message)) return 'Correo o contraseña incorrectos.';
  if (/email not confirmed/i.test(message)) return 'Debes confirmar tu correo antes de iniciar sesión.';
  if (/rate limit|too many requests/i.test(message)) return 'Hay demasiados intentos seguidos. Espera un momento y vuelve a intentar.';
  return message || 'No fue posible completar la autenticación.';
};

export const LoginScreen: React.FC = () => {
  const { signIn, requestPasswordReset, identityError } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const isOfficialOrigin = (() => {
    try { return window.location.origin === new URL(runtimeConfig.officialAppUrl).origin; }
    catch { return false; }
  })();

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(''); setNotice(''); setBusy(true);
    try { await signIn(email, password); }
    catch (err) { setError(friendlyAuthError(err)); }
    finally { setBusy(false); }
  };

  const recover = async () => {
    setError(''); setNotice('');
    if (!email.trim()) { setError('Escribe primero el correo de tu cuenta.'); return; }
    setBusy(true);
    try {
      await requestPasswordReset(email);
      setNotice('Te enviamos un enlace para definir una nueva contraseña. Revisa también Spam o Promociones.');
    } catch (err) { setError(friendlyAuthError(err)); }
    finally { setBusy(false); }
  };

  const openDemo = () => {
    const url = new URL(window.location.href);
    url.pathname = '/';
    url.search = '?demo=1&view=operator';
    url.hash = '';
    window.location.href = url.toString();
  };

  return (
    <main className="min-h-screen bg-[#070709] text-zinc-100 flex items-center justify-center p-4 relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(245,158,11,0.12),transparent_42%)]" />
      <section className="relative w-full max-w-md rounded-3xl border border-zinc-800 bg-[#0d0d0f]/95 p-6 sm:p-8 shadow-2xl shadow-black/60 backdrop-blur">
        <div className="flex items-center gap-3"><img src={centralGoLogo} alt="Central GO" className="h-14 w-14 rounded-2xl border-2 border-amber-400/70 bg-zinc-950 p-1" /><div><p className="text-[10px] font-black uppercase tracking-[0.24em] text-amber-300">Central GO Oficial</p><h1 className="text-2xl font-black text-white">Acceso seguro</h1></div></div>
        {!isOfficialOrigin && <div className="mt-5 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3.5 text-xs leading-relaxed text-amber-100"><p className="font-black">Estás en una dirección de desarrollo o no oficial.</p><p className="mt-1 text-amber-100/75">Para recuperar contraseñas e invitaciones usa la versión oficial de Central GO.</p><a href={runtimeConfig.officialAppUrl} className="mt-3 inline-flex items-center gap-2 rounded-lg bg-amber-400 px-3 py-2 font-black text-zinc-950"><ExternalLink className="h-4 w-4" />Abrir Central GO Oficial</a></div>}

        <button type="button" onClick={openDemo} className="group mt-5 w-full rounded-2xl border border-purple-400/25 bg-gradient-to-r from-purple-500/15 via-zinc-950 to-amber-500/10 p-4 text-left transition hover:border-amber-400/45 hover:bg-zinc-900">
          <div className="flex items-center gap-3">
            <div className="rounded-xl border border-purple-400/20 bg-purple-500/10 p-2.5 text-purple-300 transition group-hover:text-amber-300"><MonitorPlay className="h-5 w-5" /></div>
            <div className="min-w-0 flex-1"><div className="flex items-center gap-2"><p className="text-sm font-black text-white">Modo Demo</p><span className="rounded-full bg-amber-400 px-2 py-0.5 text-[8px] font-black uppercase text-zinc-950">Recorrido completo</span></div><p className="mt-1 text-[10px] leading-relaxed text-zinc-500">Prueba despacho, mapa con taxis, App Conductor, administrador, partners, VHF, operadora virtual y planes. No requiere cuenta.</p></div>
            <Sparkles className="h-4 w-4 shrink-0 text-amber-400" />
          </div>
        </button>

        <div className="mt-4 rounded-2xl border border-blue-500/20 bg-blue-500/[0.05] p-3.5 text-[11px] leading-relaxed text-blue-200/80">Los accesos nuevos se crean desde el panel de la central o desde Superadmin. Si recibiste una invitación por correo, ábrela primero para activar tu cuenta y definir tu contraseña.</div>
        <form onSubmit={submit} className="mt-6 space-y-4">
          <label className="block"><span className="mb-1.5 flex items-center gap-2 text-xs font-bold text-zinc-400"><Mail className="h-4 w-4" />Correo</span><input required type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm outline-none transition focus:border-amber-400/70" placeholder="tu@correo.com" /></label>
          <label className="block"><span className="mb-1.5 flex items-center gap-2 text-xs font-bold text-zinc-400"><LockKeyhole className="h-4 w-4" />Contraseña</span><input required type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm outline-none transition focus:border-amber-400/70" placeholder="••••••••••" /></label>
          {(error || identityError) && <div aria-live="polite" className="rounded-xl border border-rose-500/25 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{error || identityError}</div>}
          {notice && <div aria-live="polite" className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">{notice}</div>}
          <button disabled={busy} className="flex w-full items-center justify-center gap-2 rounded-xl bg-amber-400 px-4 py-3.5 text-sm font-black text-zinc-950 transition hover:bg-amber-300 disabled:opacity-60">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}{busy ? 'Validando…' : 'Entrar a Central GO'}</button>
        </form>
        <button type="button" disabled={busy} onClick={() => void recover()} className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-xs font-bold text-zinc-400 hover:text-white disabled:opacity-50"><KeyRound className="h-4 w-4" />Olvidé mi contraseña</button>
        <p className="mt-5 text-center text-[10px] leading-relaxed text-zinc-600">Autenticación segura · permisos por central · datos persistentes.</p>
      </section>
    </main>
  );
};

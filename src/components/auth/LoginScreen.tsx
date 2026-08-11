import React, { useState } from 'react';
import { Building2, Check, ChevronDown, KeyRound, Loader2, LockKeyhole, Mail, ShieldCheck, Store } from 'lucide-react';
import centralGoLogo from '../../assets/images/central-go-logo.svg';
import { useAuth } from '../../context/AuthContext';

const friendlyAuthError = (error: unknown) => {
  const message = error instanceof Error ? error.message : String(error ?? '');
  if (/provider.*not.*enabled|unsupported provider/i.test(message)) return 'El acceso con Google todavía no está habilitado en el servidor. Central GO ya está preparado; falta activar el proveedor Google.';
  if (/failed to fetch|networkerror|load failed|network request failed/i.test(message)) return 'No pudimos conectar con el servidor de Central GO. Revisa tu conexión y vuelve a intentar.';
  if (/invalid login credentials/i.test(message)) return 'Correo o contraseña incorrectos.';
  if (/rate limit|too many requests/i.test(message)) return 'Hay demasiados intentos seguidos. Espera un momento y vuelve a intentar.';
  return message || 'No fue posible completar la autenticación.';
};

export const LoginScreen: React.FC = () => {
  const { signInWithGoogle, signIn, requestPasswordReset, identityError } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [emailAccess, setEmailAccess] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const google = async () => {
    setBusy(true); setError(''); setNotice('');
    try { await signInWithGoogle(); }
    catch (err) { setError(friendlyAuthError(err)); setBusy(false); }
  };

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
      setNotice('Te enviamos un enlace para recuperar tu acceso. Revisa también Spam o Promociones.');
    } catch (err) { setError(friendlyAuthError(err)); }
    finally { setBusy(false); }
  };

  return (
    <main className="min-h-screen bg-[#070709] text-zinc-100 flex items-center justify-center p-4 relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(245,158,11,0.14),transparent_44%)]" />
      <div className="relative grid w-full max-w-5xl gap-5 lg:grid-cols-[1.05fr_.95fr]">
        <section className="rounded-3xl border border-zinc-800 bg-[#0d0d0f]/95 p-6 sm:p-8 shadow-2xl shadow-black/60 backdrop-blur">
          <div className="flex items-center gap-3"><img src={centralGoLogo} alt="Central GO" className="h-14 w-14 rounded-2xl border-2 border-amber-400/70 bg-zinc-950 p-1" /><div><p className="text-[10px] font-black uppercase tracking-[0.24em] text-amber-300">Central GO Oficial</p><h1 className="text-2xl font-black text-white">Empieza gratis por 5 días</h1></div></div>
          <p className="mt-5 text-sm leading-relaxed text-zinc-400">Crea tu acceso en segundos. No necesitas tarjeta para comenzar y no tienes que esperar aprobación.</p>

          <button type="button" disabled={busy} onClick={() => void google()} className="mt-6 flex w-full items-center justify-center gap-3 rounded-2xl border border-zinc-700 bg-white px-4 py-4 text-sm font-black text-zinc-900 transition hover:bg-zinc-100 disabled:opacity-60">
            {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <span className="flex h-6 w-6 items-center justify-center rounded-full border border-zinc-200 font-black text-blue-600">G</span>}
            {busy ? 'Abriendo Google…' : 'Continuar con Google'}
          </button>

          <div className="mt-5 grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-amber-400/20 bg-amber-400/[0.04] p-4"><Building2 className="h-5 w-5 text-amber-300" /><p className="mt-2 text-xs font-black text-white">Registrar Central</p><p className="mt-1 text-[9px] leading-relaxed text-zinc-500">Despacho, mapa, flota, clientes y operación.</p></div>
            <div className="rounded-2xl border border-blue-500/20 bg-blue-500/[0.04] p-4"><Store className="h-5 w-5 text-blue-300" /><p className="mt-2 text-xs font-black text-white">Partner Comercial</p><p className="mt-1 text-[9px] leading-relaxed text-zinc-500">Planes, ventas, cartera y comisiones.</p></div>
          </div>

          {(error || identityError) && <div aria-live="polite" className="mt-4 rounded-xl border border-rose-500/25 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{error || identityError}</div>}
          {notice && <div aria-live="polite" className="mt-4 rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">{notice}</div>}

          <button type="button" onClick={() => setEmailAccess((value) => !value)} className="mt-5 flex w-full items-center justify-center gap-2 border-t border-zinc-800 pt-5 text-[10px] font-bold text-zinc-500 hover:text-zinc-300">Acceso existente por correo <ChevronDown className={`h-3.5 w-3.5 transition ${emailAccess?'rotate-180':''}`} /></button>
          {emailAccess && <form onSubmit={submit} className="mt-4 space-y-3"><label className="block"><span className="mb-1.5 flex items-center gap-2 text-[10px] font-bold text-zinc-500"><Mail className="h-3.5 w-3.5" />Correo</span><input required type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm outline-none focus:border-amber-400/70" placeholder="tu@correo.com" /></label><label className="block"><span className="mb-1.5 flex items-center gap-2 text-[10px] font-bold text-zinc-500"><LockKeyhole className="h-3.5 w-3.5" />Contraseña</span><input required type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm outline-none focus:border-amber-400/70" placeholder="••••••••••" /></label><button disabled={busy} className="flex w-full items-center justify-center gap-2 rounded-xl bg-zinc-800 px-4 py-3 text-xs font-black text-white hover:bg-zinc-700 disabled:opacity-60"><ShieldCheck className="h-4 w-4" />Entrar con correo</button><button type="button" disabled={busy} onClick={() => void recover()} className="flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2 text-[10px] font-bold text-zinc-500 hover:text-white"><KeyRound className="h-3.5 w-3.5" />Olvidé mi contraseña</button></form>}
        </section>

        <aside className="rounded-3xl border border-zinc-800 bg-gradient-to-b from-zinc-900/85 to-[#0a0a0c] p-6 sm:p-8">
          <span className="inline-flex rounded-full border border-emerald-500/25 bg-emerald-500/10 px-3 py-1.5 text-[9px] font-black uppercase tracking-widest text-emerald-300">5 días completos · sin tarjeta</span>
          <h2 className="mt-5 text-3xl font-black tracking-tight text-white">Prueba el sistema trabajando, no mirando una demo.</h2>
          <p className="mt-3 text-sm leading-relaxed text-zinc-400">Tu cuenta guarda datos reales desde el primer día. Cuando termine la prueba, tus datos permanecen seguros y eliges cómo continuar.</p>
          <div className="mt-7 space-y-3">{['Acceso inmediato con tu cuenta Google','Central prueba todas las funciones Enterprise','Partner entra directo a su panel comercial','Al día 5 se bloquea la operación hasta activar','Sin enlaces de invitación para registrarse'].map((item)=><div key={item} className="flex items-start gap-3 rounded-xl border border-zinc-800 bg-zinc-950/50 p-3"><span className="mt-0.5 rounded-full bg-emerald-500/10 p-1 text-emerald-300"><Check className="h-3.5 w-3.5" /></span><span className="text-[11px] font-bold leading-relaxed text-zinc-300">{item}</span></div>)}</div>
          <p className="mt-7 text-[9px] leading-relaxed text-zinc-600">Al continuar aceptas que Central GO cree la cuenta seleccionada y active automáticamente su prueba gratuita de 5 días.</p>
        </aside>
      </div>
    </main>
  );
};

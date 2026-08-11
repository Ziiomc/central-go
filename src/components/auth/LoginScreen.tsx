import React, { useState } from 'react';
import centralGoLogo from '../../assets/images/central-go-logo.svg';
import { useAuth } from '../../context/AuthContext';

export const LoginScreen: React.FC = () => {
  const { signInWithGoogle, signIn, identityError } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const googleLogin = async () => {
    setBusy(true); setError('');
    try { await signInWithGoogle(); }
    catch (err) { setError(err instanceof Error ? err.message : 'No fue posible continuar con Google.'); setBusy(false); }
  };

  const emailLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true); setError('');
    try { await signIn(email, password); }
    catch (err) {
      const message = err instanceof Error ? err.message : '';
      setError(/invalid login credentials/i.test(message) ? 'Correo o contraseña incorrectos.' : (message || 'No fue posible iniciar sesión.'));
      setBusy(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#070709] text-zinc-100 flex items-center justify-center p-4 relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(245,158,11,0.14),transparent_44%)]" />
      <section className="relative w-full max-w-md rounded-3xl border border-zinc-800 bg-[#0d0d0f]/95 p-7 sm:p-9 shadow-2xl shadow-black/60">
        <div className="flex items-center gap-3"><img src={centralGoLogo} alt="Central GO" className="h-14 w-14 rounded-2xl border-2 border-amber-400/70 bg-zinc-950 p-1" /><div><p className="text-[10px] font-black uppercase tracking-[0.24em] text-amber-300">Central GO</p><h1 className="text-2xl font-black text-white">Empieza gratis</h1></div></div>
        <p className="mt-5 text-sm leading-relaxed text-zinc-400">5 días con acceso completo. Sin tarjeta para comenzar. Después eliges el plan que mejor se adapte a tu central.</p>
        <div className="mt-5 grid grid-cols-2 gap-2 text-center text-[11px] font-bold"><div className="rounded-xl border border-zinc-800 bg-zinc-950 p-3">Soy una Central</div><div className="rounded-xl border border-zinc-800 bg-zinc-950 p-3">Soy Partner Comercial</div></div>
        {(error || identityError) && <div className="mt-4 rounded-xl border border-rose-500/25 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{error || identityError}</div>}

        <button type="button" disabled={busy} onClick={() => void googleLogin()} className="mt-6 w-full rounded-xl bg-white px-4 py-3.5 text-sm font-black text-zinc-950 transition hover:bg-zinc-100 disabled:opacity-60">{busy ? 'Conectando…' : 'Continuar con Google'}</button>

        <div className="my-5 flex items-center gap-3"><div className="h-px flex-1 bg-zinc-800"/><span className="text-[10px] font-bold uppercase tracking-widest text-zinc-600">o inicia sesión con correo</span><div className="h-px flex-1 bg-zinc-800"/></div>

        <form onSubmit={emailLogin} className="space-y-3">
          <input required type="email" autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="Correo electrónico" className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm outline-none focus:border-amber-400/70" />
          <input required type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Contraseña" className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm outline-none focus:border-amber-400/70" />
          <button disabled={busy} className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3.5 text-sm font-black text-white transition hover:bg-zinc-800 disabled:opacity-60">{busy ? 'Ingresando…' : 'Iniciar sesión'}</button>
        </form>

        <p className="mt-5 text-center text-[10px] text-zinc-600">Inicio seguro · tus datos permanecen protegidos</p>
      </section>
    </main>
  );
};
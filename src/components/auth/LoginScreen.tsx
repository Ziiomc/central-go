import React, { useState } from 'react';
import { Loader2, LockKeyhole, Mail, ShieldCheck, UserRound } from 'lucide-react';
import centralGoLogo from '../../assets/images/central-go-logo.svg';
import { useAuth } from '../../context/AuthContext';

export const LoginScreen: React.FC = () => {
  const { signIn, signUp, identityError } = useAuth();
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setNotice('');
    setBusy(true);
    try {
      if (mode === 'login') {
        await signIn(email, password);
      } else {
        if (name.trim().length < 2) throw new Error('Escribe tu nombre.');
        if (password.length < 8) throw new Error('La contraseña debe tener al menos 8 caracteres.');
        const result = await signUp(name, email, password);
        if (result.needsEmailConfirmation) {
          setNotice('Cuenta creada. Revisa tu correo para confirmar el acceso antes de iniciar sesión.');
          setMode('login');
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No fue posible completar el acceso.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#070709] text-zinc-100 flex items-center justify-center p-4 relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(245,158,11,0.12),transparent_42%)]" />
      <section className="relative w-full max-w-md rounded-3xl border border-zinc-800 bg-[#0d0d0f]/95 p-6 sm:p-8 shadow-2xl shadow-black/60 backdrop-blur">
        <div className="flex items-center gap-3">
          <img src={centralGoLogo} alt="Central GO" className="h-14 w-14 rounded-2xl border-2 border-amber-400/70 bg-zinc-950 p-1 shadow-lg shadow-amber-500/20" />
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-amber-300">Central GO Comercial</p>
            <h1 className="text-2xl font-black text-white">Acceso seguro</h1>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-2 rounded-xl border border-zinc-800 bg-zinc-950 p-1">
          <button type="button" onClick={() => { setMode('login'); setError(''); }} className={`rounded-lg px-3 py-2 text-xs font-black transition ${mode === 'login' ? 'bg-amber-400 text-zinc-950' : 'text-zinc-500 hover:text-zinc-200'}`}>Iniciar sesión</button>
          <button type="button" onClick={() => { setMode('signup'); setError(''); }} className={`rounded-lg px-3 py-2 text-xs font-black transition ${mode === 'signup' ? 'bg-amber-400 text-zinc-950' : 'text-zinc-500 hover:text-zinc-200'}`}>Crear cuenta</button>
        </div>

        <form onSubmit={submit} className="mt-6 space-y-4">
          {mode === 'signup' && (
            <label className="block">
              <span className="mb-1.5 flex items-center gap-2 text-xs font-bold text-zinc-400"><UserRound className="h-4 w-4" /> Nombre</span>
              <input autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm outline-none transition focus:border-amber-400/70" placeholder="Nombre y apellido" />
            </label>
          )}
          <label className="block">
            <span className="mb-1.5 flex items-center gap-2 text-xs font-bold text-zinc-400"><Mail className="h-4 w-4" /> Correo</span>
            <input required type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm outline-none transition focus:border-amber-400/70" placeholder="nombre@central.cl" />
          </label>
          <label className="block">
            <span className="mb-1.5 flex items-center gap-2 text-xs font-bold text-zinc-400"><LockKeyhole className="h-4 w-4" /> Contraseña</span>
            <input required type="password" minLength={8} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} value={password} onChange={(e) => setPassword(e.target.value)} className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm outline-none transition focus:border-amber-400/70" placeholder="••••••••" />
          </label>

          {(error || identityError) && <div className="rounded-xl border border-rose-500/25 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{error || identityError}</div>}
          {notice && <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">{notice}</div>}

          <button disabled={busy} className="flex w-full items-center justify-center gap-2 rounded-xl bg-amber-400 px-4 py-3.5 text-sm font-black text-zinc-950 shadow-lg shadow-amber-500/20 transition hover:bg-amber-300 disabled:opacity-60">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
            {mode === 'login' ? 'Entrar a Central GO' : 'Crear cuenta segura'}
          </button>
        </form>

        <p className="mt-5 text-center text-[11px] leading-relaxed text-zinc-600">Las cuentas comerciales usan autenticación Supabase y permisos por central. La contraseña de demostración no se utiliza aquí.</p>
      </section>
    </main>
  );
};

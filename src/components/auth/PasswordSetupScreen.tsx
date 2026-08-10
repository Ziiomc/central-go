import React, { useState } from 'react';
import { CheckCircle2, Loader2, LockKeyhole, ShieldCheck } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import centralGoLogo from '../../assets/images/central-go-logo.svg';

export const PasswordSetupScreen: React.FC<{ recovery?: boolean }> = ({ recovery = false }) => {
  const { updatePassword } = useAuth();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    if (password.length < 10) { setError('Usa al menos 10 caracteres.'); return; }
    if (password !== confirm) { setError('Las contraseñas no coinciden.'); return; }
    setBusy(true);
    try {
      await updatePassword(password);
      setDone(true);
      window.setTimeout(() => { window.location.href = '/'; }, 900);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No fue posible guardar la contraseña.');
    } finally { setBusy(false); }
  };

  return (
    <main className="min-h-screen bg-[#070709] p-4 text-zinc-100 flex items-center justify-center">
      <section className="w-full max-w-md rounded-3xl border border-zinc-800 bg-[#0d0d0f] p-6 sm:p-8 shadow-2xl">
        <div className="flex items-center gap-3"><img src={centralGoLogo} alt="Central GO" className="h-12 w-12 rounded-2xl border border-amber-400/60 bg-zinc-950 p-1" /><div><p className="text-[9px] font-black uppercase tracking-widest text-amber-300">Cuenta oficial</p><h1 className="text-xl font-black text-white">{recovery ? 'Crea una nueva contraseña' : 'Activa tu acceso'}</h1></div></div>
        {done ? <div className="mt-6 rounded-2xl border border-emerald-500/25 bg-emerald-500/10 p-5 text-center"><CheckCircle2 className="mx-auto h-8 w-8 text-emerald-400" /><p className="mt-2 text-sm font-black text-emerald-200">Contraseña guardada</p><p className="mt-1 text-xs text-zinc-500">Abriendo Central GO…</p></div> : <form onSubmit={submit} className="mt-6 space-y-4"><p className="text-sm leading-relaxed text-zinc-400">{recovery ? 'Define una contraseña nueva para recuperar tu cuenta.' : 'Tu invitación fue aceptada. Antes de entrar, define una contraseña personal para futuros accesos.'}</p><label className="block"><span className="mb-1.5 flex items-center gap-2 text-xs font-bold text-zinc-400"><LockKeyhole className="h-4 w-4" />Contraseña</span><input required minLength={10} type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm outline-none focus:border-amber-400/70" placeholder="Mínimo 10 caracteres" /></label><label className="block"><span className="mb-1.5 text-xs font-bold text-zinc-400">Repetir contraseña</span><input required minLength={10} type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm outline-none focus:border-amber-400/70" placeholder="Repite tu contraseña" /></label>{error && <div className="rounded-xl border border-rose-500/25 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{error}</div>}<button disabled={busy} className="flex w-full items-center justify-center gap-2 rounded-xl bg-amber-400 px-4 py-3.5 text-sm font-black text-zinc-950 disabled:opacity-60">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}{busy ? 'Guardando…' : 'Guardar contraseña y continuar'}</button></form>}
      </section>
    </main>
  );
};

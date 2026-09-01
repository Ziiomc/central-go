import React, { useState } from 'react';
import { Building2, KeyRound, Loader2, MonitorCheck, ShieldCheck, UserRound } from 'lucide-react';
import { AuthShell } from './AuthShell';
import { requireSupabase } from '../../lib/supabase';
import { signInWithCompatiblePassword } from '../../lib/passwordAuth';
import {
  operatorInternalEmail,
  type OperatorTerminalConfig,
  validateOperatorTerminalSession,
} from '../../lib/operatorTerminal';

interface OperatorTerminalLoginProps {
  terminal: OperatorTerminalConfig;
  onAdminAccess: () => void;
}

const friendlyError = (error: unknown) => {
  const message = error instanceof Error ? error.message : String(error ?? '');
  if (/invalid login credentials/i.test(message)) return 'Usuario o contraseña incorrectos.';
  if (/terminal|permission|policy|row-level security/i.test(message)) return 'Este computador ya no está autorizado para operar. Pide al administrador que vuelva a habilitarlo.';
  return message || 'No fue posible iniciar el turno.';
};

export const OperatorTerminalLogin: React.FC<OperatorTerminalLoginProps> = ({ terminal, onAdminAccess }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    const db = requireSupabase();
    try {
      const email = operatorInternalEmail(terminal.companyId, username);
      const { data } = await signInWithCompatiblePassword(email, password);
      if (!data.user) throw new Error('No fue posible validar la cuenta del operador.');

      const allowed = await validateOperatorTerminalSession(terminal, data.user.id);
      if (!allowed) {
        await db.auth.signOut();
        throw new Error('La cuenta o esta terminal no están autorizadas para esta central.');
      }

      window.location.replace('/');
    } catch (err) {
      try { await db.auth.signOut(); } catch { /* keep login screen */ }
      setError(friendlyError(err));
      setBusy(false);
    }
  };

  return (
    <AuthShell compact eyebrow="Terminal operativa" title="Inicio de turno">
      <div className="flex items-center gap-3 rounded-2xl border border-blue-500/20 bg-blue-500/[.07] p-4">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-blue-400/25 bg-blue-500/10 text-blue-300"><MonitorCheck className="h-5 w-5" /></span>
        <div className="min-w-0">
          <p className="truncate text-sm font-black text-white">{terminal.companyName}</p>
          <p className="mt-0.5 flex items-center gap-1.5 truncate text-[10px] font-bold text-zinc-500"><Building2 className="h-3 w-3" />{terminal.label}</p>
        </div>
        <ShieldCheck className="ml-auto h-5 w-5 shrink-0 text-emerald-400" />
      </div>

      <h1 className="cg-card-title mt-5 text-xl">Acceso de operador</h1>
      <p className="cg-card-copy">Ingresa el usuario y la contraseña entregados por la administración. No necesitas una cuenta Google.</p>

      {error && <div className="cg-alert cg-alert-error mt-4">{error}</div>}

      <form onSubmit={submit} className="cg-form mt-5">
        <label className="cg-field">
          <span>Usuario</span>
          <div className="relative">
            <UserRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-600" />
            <input required autoFocus autoCapitalize="none" autoCorrect="off" spellCheck={false} value={username} onChange={(event) => setUsername(event.target.value)} className="pl-10" placeholder="operador01" />
          </div>
        </label>
        <label className="cg-field">
          <span>Contraseña</span>
          <div className="relative">
            <KeyRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-600" />
            <input required type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} className="pl-10" placeholder="Contraseña del turno" />
          </div>
        </label>
        <button disabled={busy} className="cg-primary-button">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <MonitorCheck className="h-4 w-4" />}
          {busy ? 'Validando terminal…' : 'Iniciar turno'}
        </button>
      </form>

      <button type="button" onClick={onAdminAccess} disabled={busy} className="cg-subtle-button mt-3 w-full">Acceso de administrador</button>
      <p className="cg-auth-hint">Esta estación está vinculada a {terminal.companyName}. Al cerrar el turno volverá automáticamente a esta pantalla.</p>
    </AuthShell>
  );
};

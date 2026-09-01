import React, { useEffect, useState } from 'react';
import { Building2, Loader2, ShieldCheck } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { runtimeConfig } from '../../config/runtime';
import { googleOAuthOptions } from '../../lib/googleOAuth';
import { requireSupabase } from '../../lib/supabase';
import { acceptMyOperatorInvitation, loadMyOperatorInvitation, type MyOperatorInvitation } from '../../lib/operatorRepository';
import { AuthShell } from './AuthShell';

export const OperatorInviteAcceptGate: React.FC = () => {
  const { refreshIdentity, signOut } = useAuth();
  const [invitation, setInvitation] = useState<MyOperatorInvitation | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    const prepare = async () => {
      try {
        const pending = await loadMyOperatorInvitation();
        if (!active) return;
        if (!pending) throw new Error('No encontramos una invitación vigente para este correo.');
        setInvitation(pending);
        if (pending.hasGoogle) {
          await acceptMyOperatorInvitation();
          window.history.replaceState({}, document.title, '/');
          await refreshIdentity();
        }
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : 'No fue posible validar la invitación.');
      } finally {
        if (active) setBusy(false);
      }
    };
    void prepare();
    return () => { active = false; };
  }, [refreshIdentity]);

  const continueWithGoogle = async () => {
    setBusy(true); setError('');
    try {
      await requireSupabase().auth.signOut({ scope: 'local' });
      const { error: oauthError } = await requireSupabase().auth.signInWithOAuth({
        provider: 'google',
        options: googleOAuthOptions(`${runtimeConfig.officialAppUrl}/?operator_invite=1`),
      });
      if (oauthError) throw oauthError;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No fue posible continuar con Google.');
      setBusy(false);
    }
  };

  return <AuthShell compact eyebrow="Registro de operador/a" title="Verifica tu acceso con Google">
    <div className="flex items-center gap-3"><span className="cg-role-icon h-12 w-12"><Building2 className="h-6 w-6" /></span><div><p className="cg-card-kicker">Central invitante</p><h1 className="cg-card-title text-xl">{invitation?.companyName ?? 'Validando invitación…'}</h1></div></div>
    <p className="cg-card-copy mt-5">Entra con la cuenta de Google correspondiente al correo registrado por la central. Al validarla, el siguiente paso será crear tu contraseña.</p>
    {error && <div className="cg-alert cg-alert-error mt-5">{error}</div>}
    {busy ? <div className="cg-alert cg-alert-info mt-5"><Loader2 className="mr-2 inline h-4 w-4 animate-spin" />Verificando acceso…</div> : invitation && !invitation.hasGoogle && <button type="button" onClick={() => void continueWithGoogle()} className="cg-google-button mt-5"><span className="cg-google-mark">G</span>Continuar con {invitation.email}</button>}
    {!busy && error && <button type="button" onClick={() => void signOut()} className="cg-subtle-button mt-4">Salir y usar otra cuenta</button>}
    <p className="cg-auth-hint"><ShieldCheck className="mr-1 inline h-3.5 w-3.5" />Después podrás iniciar sesión con Google o con correo y contraseña.</p>
  </AuthShell>;
};

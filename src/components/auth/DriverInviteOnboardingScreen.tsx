import React, { useEffect, useState } from 'react';
import { ArrowLeft, Building2, CarFront, Loader2, Search } from 'lucide-react';
import { ONBOARDING_INTENT_KEY, useAuth } from '../../context/AuthContext';
import { rememberDriverInviteCode } from '../../lib/driverInvite';
import { requireSupabase } from '../../lib/supabase';
import { AuthShell } from './AuthShell';
import { WorldLocationPicker, type WorldLocationValue } from './WorldLocationPicker';

export const DriverInviteOnboardingScreen: React.FC<{ inviteCode: string }> = ({ inviteCode }) => {
  const { authUser, refreshIdentity, signOut } = useAuth();
  const [name, setName] = useState(authUser?.user_metadata?.full_name ?? authUser?.user_metadata?.name ?? '');
  const [phone, setPhone] = useState('');
  const [location, setLocation] = useState<WorldLocationValue>({ countryCode: 'CL', countryName: 'Chile', region: '', regionCode: '', city: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    rememberDriverInviteCode(inviteCode);
    window.localStorage.setItem(ONBOARDING_INTENT_KEY, 'driver');
  }, [inviteCode]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const { error: onboardingError } = await requireSupabase().rpc('centralgo_complete_onboarding_v2', {
        p_account_kind: 'driver',
        p_name: name,
        p_phone: phone || null,
        p_city: location.city || null,
        p_country_code: location.countryCode,
        p_company_name: null,
        p_central_code: null,
        p_license_number: null,
        p_region: location.region || null,
        p_requirements_accepted: false,
      });
      if (onboardingError) throw onboardingError;
      window.localStorage.removeItem(ONBOARDING_INTENT_KEY);
      rememberDriverInviteCode(inviteCode);
      await refreshIdentity();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No fue posible completar tu perfil de conductor.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell compact eyebrow="Invitación de central" title="Completa tu perfil de conductor">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="cg-card-kicker">Central GO · Conductor</p>
          <h1 className="cg-card-title">Último paso</h1>
          <p className="cg-card-copy">Tu cuenta quedó marcada como conductor por la invitación recibida.</p>
        </div>
        <button type="button" onClick={() => void signOut()} className="cg-subtle-button inline-flex shrink-0 items-center gap-1"><ArrowLeft className="h-3.5 w-3.5" /> Salir</button>
      </div>

      <div className="mt-5 rounded-2xl border border-[var(--cg-border)] bg-[var(--cg-primary-soft)] p-4">
        <p className="flex items-center gap-2 text-sm font-black text-[var(--cg-text)]"><Building2 className="h-4 w-4 text-[var(--cg-primary)]" /> Central invitante {inviteCode}</p>
        <p className="mt-1 text-[11px] leading-relaxed text-[var(--cg-muted)]">Al terminar verás esa central primero y podrás enviarle tu cédula, licencia y datos de contacto para que evalúe tu alta.</p>
      </div>

      <form onSubmit={submit} className="cg-form mt-5">
        <label className="cg-field"><span>Nombre completo</span><input required value={name} onChange={(e) => setName(e.target.value)} placeholder="Tu nombre y apellido" /></label>
        <label className="cg-field"><span>Teléfono</span><input required type="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+56 9…" /></label>
        <WorldLocationPicker value={location} onChange={setLocation} />
        <div className="cg-alert cg-alert-info mt-0"><Search className="mr-1.5 inline h-4 w-4" />Después podrás ver la central invitante y también explorar centrales activas de otras ciudades.</div>
        {error && <div className="cg-alert cg-alert-error mt-0">{error}</div>}
        <button disabled={busy} className="cg-primary-button">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CarFront className="h-4 w-4" />}{busy ? 'Creando perfil…' : 'Crear mi perfil de conductor'}</button>
      </form>
    </AuthShell>
  );
};

import React, { useEffect, useState } from 'react';
import { ArrowLeft, Building2, CarFront, IdCard, Loader2, MapPin, Phone, UserRound } from 'lucide-react';
import { ONBOARDING_INTENT_KEY, useAuth } from '../../context/AuthContext';
import { acceptDriverInvite, clearDriverInvite, rememberDriverInviteCode } from '../../lib/driverInvite';
import { normalizeIdentityDocument, validateDriverIdentity } from '../../lib/driverIdentity';
import { requireSupabase } from '../../lib/supabase';
import { AuthShell } from './AuthShell';
import { WorldLocationPicker, type WorldLocationValue } from './WorldLocationPicker';

export const DriverInviteOnboardingScreen: React.FC<{ inviteCode: string }> = ({ inviteCode }) => {
  const { authUser, refreshIdentity, signOut } = useAuth();
  const [name, setName] = useState(authUser?.user_metadata?.full_name ?? authUser?.user_metadata?.name ?? '');
  const [phone, setPhone] = useState(authUser?.user_metadata?.phone ?? '');
  const [nationalIdNumber, setNationalIdNumber] = useState('');
  const [address, setAddress] = useState('');
  const [location, setLocation] = useState<WorldLocationValue>({ countryCode: 'CL', countryName: 'Chile', region: '', regionCode: '', city: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    rememberDriverInviteCode(inviteCode);
    window.localStorage.setItem(ONBOARDING_INTENT_KEY, 'driver');
  }, [inviteCode]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const identity = { name, phone, nationalIdNumber, address };
    const validationError = validateDriverIdentity(identity, location.countryCode);
    if (validationError) {
      setError(validationError);
      return;
    }
    if (!location.city) {
      setError('Selecciona tu región y ciudad.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const { error: onboardingError } = await requireSupabase().rpc('centralgo_complete_onboarding_v2', {
        p_account_kind: 'driver',
        p_name: name.trim(),
        p_phone: phone.trim(),
        p_city: location.city,
        p_country_code: location.countryCode,
        p_company_name: null,
        p_central_code: null,
        p_license_number: null,
        p_region: location.region || null,
        p_requirements_accepted: false,
      });
      if (onboardingError) throw onboardingError;
      await acceptDriverInvite(inviteCode, {
        ...identity,
        nationalIdNumber: normalizeIdentityDocument(nationalIdNumber, location.countryCode),
      });
      clearDriverInvite();
      window.localStorage.removeItem(ONBOARDING_INTENT_KEY);
      await refreshIdentity();
      window.location.replace('/driver');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No fue posible completar tu alta como conductor.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell compact eyebrow="Invitación de central" title="Completa tus datos de conductor">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="cg-card-kicker">Central GO · Conductor</p>
          <h1 className="cg-card-title">Confirma tu identidad</h1>
          <p className="cg-card-copy">Google confirma tu correo, pero tú debes registrar los datos que verá la central.</p>
        </div>
        <button type="button" onClick={() => void signOut()} className="cg-subtle-button inline-flex shrink-0 items-center gap-1"><ArrowLeft className="h-3.5 w-3.5" /> Salir</button>
      </div>

      <div className="mt-5 rounded-2xl border border-[var(--cg-border)] bg-[var(--cg-primary-soft)] p-4">
        <p className="flex items-center gap-2 text-sm font-black text-[var(--cg-text)]"><Building2 className="h-4 w-4 text-[var(--cg-primary)]" /> Invitación privada verificada</p>
        <p className="mt-1 text-[11px] leading-relaxed text-[var(--cg-muted)]">Tu nombre, RUT, teléfono y dirección quedarán visibles sólo para la administración autorizada de la central.</p>
      </div>

      <form onSubmit={submit} className="cg-form mt-5">
        <label className="cg-field"><span>Correo de acceso</span><input readOnly value={authUser?.email ?? ''} className="opacity-70" /></label>
        <label className="cg-field"><span className="flex items-center gap-1.5"><UserRound className="h-3.5 w-3.5" /> Nombre completo</span><input required autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Nombres y apellidos" /></label>
        <label className="cg-field"><span className="flex items-center gap-1.5"><IdCard className="h-3.5 w-3.5" /> RUT o documento</span><input required autoComplete="off" value={nationalIdNumber} onChange={(event) => setNationalIdNumber(event.target.value)} onBlur={() => setNationalIdNumber((value) => normalizeIdentityDocument(value, location.countryCode))} placeholder="12.345.678-5" /></label>
        <label className="cg-field"><span className="flex items-center gap-1.5"><Phone className="h-3.5 w-3.5" /> Teléfono</span><input required type="tel" autoComplete="tel" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="+56 9 1234 5678" /></label>
        <label className="cg-field"><span className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" /> Dirección particular</span><input required autoComplete="street-address" value={address} onChange={(event) => setAddress(event.target.value)} placeholder="Calle, número y sector" /></label>
        <WorldLocationPicker value={location} onChange={setLocation} />
        {error && <div className="cg-alert cg-alert-error mt-0">{error}</div>}
        <button disabled={busy} className="cg-primary-button">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CarFront className="h-4 w-4" />}{busy ? 'Guardando y entrando…' : 'Guardar datos y entrar a la central'}</button>
      </form>
    </AuthShell>
  );
};

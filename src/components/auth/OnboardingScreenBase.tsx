import React, { useState } from 'react';
import { AlertTriangle, ArrowLeft, Building2, CarFront, FileDown, Handshake, Loader2, Search, Sparkles } from 'lucide-react';
import {
  ONBOARDING_INTENT_KEY,
  type OnboardingRole,
  useAuth,
} from '../../context/AuthContext';
import { requireSupabase } from '../../lib/supabase';
import { AuthShell } from './AuthShell';
import { WorldLocationPicker, type WorldLocationValue } from './WorldLocationPicker';

const validRole = (value: unknown): value is OnboardingRole =>
  value === 'central' || value === 'driver' || value === 'sales_partner';

const getInitialRole = (metadataRole: unknown): OnboardingRole => {
  const stored = typeof window !== 'undefined' ? window.localStorage.getItem(ONBOARDING_INTENT_KEY) : null;
  if (validRole(stored)) return stored;
  return validRole(metadataRole) ? metadataRole : 'central';
};

const roleContent: Record<OnboardingRole, {
  title: string;
  description: string;
  action: string;
  icon: React.ComponentType<{ className?: string }>;
}> = {
  central: {
    title: 'Quiero operar mi central',
    description: 'Crea tu espacio de trabajo y usa todas las funciones durante 5 días, sin tarjeta.',
    action: 'Crear mi central y comenzar',
    icon: Building2,
  },
  driver: {
    title: 'Quiero conducir',
    description: 'Entra de inmediato a tu portal, busca centrales por país o ciudad y presenta tus antecedentes cuando corresponda.',
    action: 'Crear mi portal de conductor',
    icon: CarFront,
  },
  sales_partner: {
    title: 'Quiero ser socio comercial',
    description: 'Postula para vender y dar soporte a tus centrales. El superadministrador revisará tu solicitud.',
    action: 'Enviar postulación comercial',
    icon: Handshake,
  },
};

export const OnboardingScreen: React.FC = () => {
  const { authUser, refreshIdentity, signOut } = useAuth();
  const [role, setRole] = useState<OnboardingRole>(() =>
    getInitialRole(authUser?.user_metadata?.account_kind),
  );
  const [name, setName] = useState(authUser?.user_metadata?.full_name ?? authUser?.user_metadata?.name ?? '');
  const [phone, setPhone] = useState('');
  const [location, setLocation] = useState<WorldLocationValue>({
    countryCode: 'CL', countryName: 'Chile', region: '', regionCode: '', city: '',
  });
  const [companyName, setCompanyName] = useState('');
  const [requirementsAccepted, setRequirementsAccepted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const content = roleContent[role];
  const ContentIcon = content.icon;

  const chooseRole = (nextRole: OnboardingRole) => {
    setRole(nextRole);
    setError('');
    window.localStorage.setItem(ONBOARDING_INTENT_KEY, nextRole);
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const { error: onboardingError } = await requireSupabase().rpc('centralgo_complete_onboarding_v2', {
        p_account_kind: role,
        p_name: name,
        p_phone: phone || null,
        p_city: location.city || null,
        p_country_code: location.countryCode,
        p_company_name: role === 'central' ? companyName : null,
        p_central_code: null,
        p_license_number: null,
        p_region: location.region || null,
        p_requirements_accepted: role === 'sales_partner' && requirementsAccepted,
      });
      if (onboardingError) throw onboardingError;
      window.localStorage.removeItem(ONBOARDING_INTENT_KEY);
      await refreshIdentity();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No fue posible completar tu registro.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell
      compact
      eyebrow="Configuración inicial"
      title="Elige cómo participar"
      description="Tu panel y permisos se prepararán según el rol que elijas."
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="cg-card-kicker">Último paso</p>
          <h1 className="cg-card-title">¿Cómo participas?</h1>
          <p className="cg-card-copy">Puedes usar la misma cuenta con correo o Google. El acceso operativo se configura aquí.</p>
        </div>
        <button type="button" onClick={() => void signOut()} className="cg-subtle-button inline-flex shrink-0 items-center gap-1">
          <ArrowLeft className="h-3.5 w-3.5" /> Salir
        </button>
      </div>

      <div className="cg-role-grid" aria-label="Selecciona tu rol">
        {(Object.keys(roleContent) as OnboardingRole[]).map((id) => {
          const option = roleContent[id];
          const Icon = option.icon;
          return (
            <button key={id} type="button" className="cg-role-card" data-active={role === id} aria-pressed={role === id} onClick={() => chooseRole(id)}>
              <span className="cg-role-icon"><Icon /></span>
              <strong>{id === 'central' ? 'Central' : id === 'driver' ? 'Conductor' : 'Socio comercial'}</strong>
              <small>{id === 'central' ? '5 días Full' : id === 'driver' ? 'Portal inmediato' : 'Aprobación previa'}</small>
            </button>
          );
        })}
      </div>

      <div className="mt-5 rounded-2xl border border-[var(--cg-border)] bg-[var(--cg-primary-soft)] p-4">
        <div className="flex items-start gap-3">
          <span className="cg-role-icon shrink-0"><ContentIcon className="h-4 w-4" /></span>
          <div>
            <h2 className="text-sm font-black text-[var(--cg-text)]">{content.title}</h2>
            <p className="mt-1 text-[11px] leading-relaxed text-[var(--cg-muted)]">{content.description}</p>
          </div>
        </div>
      </div>

      <form onSubmit={submit} className="cg-form mt-5">
        <label className="cg-field">
          <span>Nombre completo</span>
          <input required value={name} onChange={(event) => setName(event.target.value)} placeholder="Tu nombre y apellido" />
        </label>

        <div className="cg-form-row">
          <label className="cg-field">
            <span>Teléfono</span>
            <input required type="tel" autoComplete="tel" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="+56 9…" />
          </label>
        </div>

        <WorldLocationPicker value={location} onChange={setLocation} />

        {role === 'central' && (
          <label className="cg-field">
            <span>Nombre de la central</span>
            <input required value={companyName} onChange={(event) => setCompanyName(event.target.value)} placeholder="Ej. Radio Taxi Central" />
          </label>
        )}

        {role === 'driver' && (
          <div className="cg-alert cg-alert-info mt-0">
            <Search className="mr-1.5 inline h-4 w-4" /> Tu acceso es inmediato. Dentro del portal podrás buscar una central. Si ya perteneces a ella, podrás solicitar vinculación sin documentos; una postulación nueva puede requerir antecedentes.
          </div>
        )}

        {role === 'sales_partner' && (
          <div className="space-y-3">
            <div className="cg-alert cg-alert-warning mt-0">
              <AlertTriangle className="mr-1.5 inline h-4 w-4" /> Esta opción no entrega acceso comercial automático. La revisión corresponde exclusivamente al superadministrador. El plazo habitual informado es de hasta 3 horas, pero puede aprobarse antes.
            </div>
            <a href="/docs/requisitos-socio-comercial-central-go.pdf" target="_blank" rel="noreferrer" className="cg-document-link">
              <FileDown className="h-4 w-4" /> Descargar requisitos y responsabilidades
            </a>
            <label className="cg-consent-row">
              <input required type="checkbox" checked={requirementsAccepted} onChange={(event) => setRequirementsAccepted(event.target.checked)} />
              <span>Leí y acepto que deberé cerrar ventas y brindar atención y soporte personalizado a las centrales de mi cartera. La comisión comercial es de 20% sobre suscripciones pagadas y confirmadas.</span>
            </label>
          </div>
        )}

        {role === 'central' && (
          <div className="cg-alert cg-alert-success mt-0">
            <Sparkles className="mr-1.5 inline h-4 w-4" /> Prueba Full Enterprise por 5 días. Sin tarjeta y con tus datos conservados al finalizar.
          </div>
        )}

        {error && <div className="cg-alert cg-alert-error mt-0">{error}</div>}

        <button disabled={busy} className="cg-primary-button">
          {busy && <Loader2 className="h-4 w-4 animate-spin" />}
          {busy ? 'Configurando tu acceso…' : content.action}
        </button>
        <p className="cg-auth-hint">
          {role === 'driver'
            ? 'Portal inmediato · el acceso a viajes y GPS comienza solo cuando una central te aprueba o valida una invitación directa.'
            : role === 'sales_partner'
              ? 'Postulación gratuita · revisión exclusiva del superadministrador · comisión comercial del 20%.'
              : 'Acceso completo durante 5 días · después eliges el plan que mejor te sirve.'}
        </p>
      </form>
    </AuthShell>
  );
};

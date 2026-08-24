import React, { useEffect, useMemo, useState } from 'react';
import { Clock3, Crown, Loader2, LockKeyhole, ShieldAlert, Sparkles } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useApp } from '../../context/AppContext';
import { requireSupabase } from '../../lib/supabase';
import { UpgradePlanModal } from '../billing/UpgradePlanModal';

const daysLeft = (end?: string | null) => end ? Math.max(0, Math.ceil((new Date(end).getTime() - Date.now()) / 86400000)) : 0;
const ACTIVE_TRIP_STATUSES = new Set(['assigned', 'en_route', 'arrived', 'in_progress']);

type CompanySubscriptionState = {
  status: string;
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
};

export const TrialGate: React.FC<React.PropsWithChildren> = ({ children }) => {
  const { saasAccount, profile } = useAuth();
  const { currentCompany, currentRole, trips, drivers } = useApp();
  const [plansOpen, setPlansOpen] = useState(false);
  const [subscription, setSubscription] = useState<CompanySubscriptionState | null>(null);
  const [checkingSubscription, setCheckingSubscription] = useState(false);
  const commercialRole = profile?.globalRole === 'sales_partner' || profile?.globalRole === 'regional_partner';
  const companyUser = ['company_admin', 'operator'].includes(currentRole) && currentCompany.id !== 'network';

  useEffect(() => {
    let alive = true;
    if (!companyUser) {
      setSubscription(null);
      setCheckingSubscription(false);
      return () => { alive = false; };
    }

    setCheckingSubscription(true);
    void Promise.resolve(requireSupabase()
      .from('subscriptions')
      .select('status,trial_ends_at,current_period_end')
      .eq('company_id', currentCompany.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle())
      .then(({ data, error }) => {
        if (!alive) return;
        if (error) {
          // Database write guards remain fail-closed. Keep a known SaaS state as
          // fallback so a transient read error does not interrupt an active shift.
          console.warn('[Central GO] subscription access check unavailable', error);
          setSubscription(null);
          return;
        }
        setSubscription(data ? {
          status: String(data.status),
          trialEndsAt: data.trial_ends_at ?? null,
          currentPeriodEnd: data.current_period_end ?? null,
        } : { status: 'legacy', trialEndsAt: null, currentPeriodEnd: null });
      })
      .finally(() => { if (alive) setCheckingSubscription(false); });

    return () => { alive = false; };
  }, [companyUser, currentCompany.id]);

  const effective = useMemo<CompanySubscriptionState>(() => {
    if (subscription) return subscription;
    if (saasAccount?.accountKind === 'central' && (!saasAccount.companyId || saasAccount.companyId === currentCompany.id)) {
      return {
        status: saasAccount.status,
        trialEndsAt: saasAccount.trialEndsAt ?? null,
        currentPeriodEnd: saasAccount.currentPeriodEnd ?? null,
      };
    }
    return { status: 'legacy', trialEndsAt: null, currentPeriodEnd: null };
  }, [subscription, saasAccount, currentCompany.id]);

  const liveService = useMemo(
    () => trips.some((trip) => trip.companyId === currentCompany.id && ACTIVE_TRIP_STATUSES.has(trip.status)),
    [currentCompany.id, trips],
  );
  const openSOS = useMemo(
    () => drivers.some((driver) => driver.companyId === currentCompany.id && driver.sosActive),
    [currentCompany.id, drivers],
  );

  if (profile?.globalRole === 'super_admin' || commercialRole || saasAccount?.accountKind === 'sales_partner' || !companyUser) return <>{children}</>;

  if (checkingSubscription && !subscription && !saasAccount) {
    return <main className="flex min-h-[55vh] items-center justify-center"><div className="flex items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-950/70 px-4 py-3 text-xs font-bold text-zinc-400"><Loader2 className="h-4 w-4 animate-spin text-amber-300"/>Validando acceso de la central…</div></main>;
  }

  const now = Date.now();
  const trialing = effective.status === 'trialing' && Boolean(effective.trialEndsAt) && new Date(effective.trialEndsAt!).getTime() > now;
  const active = effective.status === 'active' && (!effective.currentPeriodEnd || new Date(effective.currentPeriodEnd).getTime() > now);
  const legacy = effective.status === 'legacy';
  const expiredTrial = effective.status === 'trialing' && (!effective.trialEndsAt || new Date(effective.trialEndsAt).getTime() <= now);
  const inactive = ['expired', 'past_due', 'suspended', 'cancelled'].includes(effective.status) || expiredTrial || (effective.status === 'active' && !active);
  const days = trialing ? daysLeft(effective.trialEndsAt) : 0;
  const companyId = currentCompany.id !== 'network' ? currentCompany.id : saasAccount?.companyId;
  const safeCloseMode = inactive && !active && (liveService || openSOS);

  if (safeCloseMode) {
    return (
      <>
        <div className="sticky top-0 z-[90] border-b border-rose-400/35 bg-gradient-to-r from-rose-600 via-amber-500 to-rose-600 px-3 py-2.5 text-white shadow-xl shadow-black/20">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-center gap-x-3 gap-y-1 text-center text-[10px] font-black sm:text-xs">
            <span className="inline-flex items-center gap-1.5 uppercase tracking-wider"><ShieldAlert className="h-4 w-4"/> Modo cierre seguro</span>
            <span>{openSOS ? 'Hay una alerta SOS activa. La seguridad permanece disponible.' : 'El período terminó durante una carrera activa. Puedes supervisar y cerrar ese servicio; no se aceptan carreras nuevas.'}</span>
            <button disabled={!companyId} onClick={() => setPlansOpen(true)} className="ml-1 rounded-lg bg-zinc-950 px-3 py-1.5 text-[10px] font-black text-white shadow-sm disabled:opacity-50">Activar Central GO</button>
          </div>
        </div>
        {children}
        {plansOpen && companyId && <UpgradePlanModal companyId={companyId} onClose={() => setPlansOpen(false)} />}
      </>
    );
  }

  if (inactive && !active) {
    return (
      <main className="min-h-screen bg-[#070709] text-white flex items-center justify-center p-5 relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(245,158,11,0.15),transparent_48%)]" />
        <section className="relative max-w-lg rounded-3xl border border-amber-400/30 bg-[#0d0d0f] p-8 text-center shadow-2xl shadow-black/60">
          <LockKeyhole className="mx-auto h-10 w-10 text-amber-300" />
          <p className="mt-4 text-[10px] font-black uppercase tracking-[0.2em] text-amber-300">Tus datos siguen seguros</p>
          <h1 className="mt-2 text-2xl font-black">El acceso de la central requiere activación</h1>
          <p className="mt-3 text-sm leading-relaxed text-zinc-400">La prueba o el período contratado terminó. No eliminamos carreras, usuarios, clientes ni configuración. Activa un plan para continuar operando Central GO.</p>
          <button disabled={!companyId} onClick={() => setPlansOpen(true)} className="mt-6 inline-flex items-center gap-2 rounded-xl bg-amber-400 px-5 py-3 font-black text-zinc-950 disabled:opacity-40"><Crown className="h-4 w-4"/> Activar Central GO</button>
        </section>
        {plansOpen && companyId && <UpgradePlanModal companyId={companyId} onClose={() => setPlansOpen(false)} />}
      </main>
    );
  }

  if (!trialing || active || legacy) return <>{children}</>;

  return (
    <>
      <div className="sticky top-0 z-[70] border-b border-amber-400/25 bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-400 px-3 py-2 text-zinc-950 shadow-lg shadow-amber-950/10">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-center gap-x-3 gap-y-1 text-center text-[10px] font-black sm:text-xs">
          <span className="inline-flex items-center gap-1.5 uppercase tracking-wider"><Sparkles className="h-4 w-4"/> 5 días gratis</span>
          <span className="inline-flex items-center gap-1.5"><Clock3 className="h-4 w-4"/> Te {days === 1 ? 'queda' : 'quedan'} {days} {days === 1 ? 'día' : 'días'} de acceso completo</span>
          <button disabled={!companyId} onClick={() => setPlansOpen(true)} className="ml-1 rounded-lg bg-zinc-950 px-3 py-1.5 text-[10px] font-black text-white shadow-sm disabled:opacity-50">Activar modo Pro</button>
        </div>
      </div>
      {children}
      {plansOpen && companyId && <UpgradePlanModal companyId={companyId} onClose={() => setPlansOpen(false)} />}
    </>
  );
};

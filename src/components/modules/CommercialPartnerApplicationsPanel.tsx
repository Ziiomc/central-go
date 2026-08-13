import React, { useCallback, useEffect, useState } from 'react';
import { Check, Clock3, FileDown, Loader2, MapPin, RefreshCw, ShieldCheck, UserRoundCheck, X } from 'lucide-react';
import {
  loadPendingCommercialPartnerApplications,
  reviewCommercialPartnerApplication,
  type CommercialPartnerApplication,
} from '../../lib/partnerApplicationRepository';

const remainingLabel = (date: string) => {
  const milliseconds = new Date(date).getTime() - Date.now();
  if (milliseconds <= 0) return 'Lista para revisión';
  const totalMinutes = Math.ceil(milliseconds / 60000);
  return `Disponible en ${Math.floor(totalMinutes / 60)} h ${totalMinutes % 60} min`;
};

export const CommercialPartnerApplicationsPanel: React.FC<{ onApproved?: () => void }> = ({ onApproved }) => {
  const [applications, setApplications] = useState<CommercialPartnerApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [, setClock] = useState(Date.now());

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try { setApplications(await loadPendingCommercialPartnerApplications()); }
    catch (err) { setError(err instanceof Error ? err.message : 'No fue posible cargar las postulaciones.'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    const timer = window.setInterval(() => setClock(Date.now()), 30000);
    return () => window.clearInterval(timer);
  }, []);

  const review = async (application: CommercialPartnerApplication, approve: boolean) => {
    setBusyId(application.id);
    setError('');
    setNotice('');
    try {
      await reviewCommercialPartnerApplication({
        applicationId: application.id,
        approve,
        rejectionReason: approve ? undefined : 'La postulación no cumple los requisitos comerciales actuales.',
      });
      setApplications((current) => current.filter((item) => item.id !== application.id));
      setNotice(approve ? `${application.fullName} fue aprobado con una comisión del 25%.` : `La postulación de ${application.fullName} fue rechazada.`);
      if (approve) onApproved?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No fue posible revisar la postulación.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section className="rounded-2xl border border-amber-400/25 bg-amber-400/[0.045] p-4 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="flex items-center gap-2 text-xs font-black text-amber-300"><UserRoundCheck className="h-4 w-4" /> Postulaciones de socios comerciales</p>
          <p className="mt-1 text-[10px] leading-relaxed text-zinc-500">Solo el superadministrador puede aprobar. El sistema bloquea cualquier aprobación antes de las 3 horas mínimas.</p>
        </div>
        <div className="flex gap-2">
          <a href="/docs/requisitos-socio-comercial-central-go.pdf" target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-[10px] font-black text-zinc-300"><FileDown className="h-3.5 w-3.5" />Ver requisitos</a>
          <button type="button" onClick={() => void load()} disabled={loading} className="rounded-lg border border-zinc-700 bg-zinc-900 p-2 text-zinc-400" title="Actualizar"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /></button>
        </div>
      </div>

      {error && <div className="mt-3 rounded-xl border border-rose-500/25 bg-rose-500/10 p-3 text-xs text-rose-200">{error}</div>}
      {notice && <div className="mt-3 rounded-xl border border-emerald-500/25 bg-emerald-500/10 p-3 text-xs text-emerald-200">{notice}</div>}
      {loading && <div className="mt-4 flex items-center gap-2 text-xs text-zinc-500"><Loader2 className="h-4 w-4 animate-spin" />Cargando postulaciones…</div>}

      {!loading && applications.length === 0 ? (
        <div className="mt-4 rounded-xl border border-zinc-800 bg-zinc-950/40 p-5 text-center text-[10px] text-zinc-500"><ShieldCheck className="mx-auto mb-2 h-5 w-5 text-emerald-400" />No hay postulaciones pendientes.</div>
      ) : (
        <div className="mt-4 grid gap-3 xl:grid-cols-2">
          {applications.map((application) => {
            const eligible = Date.now() >= new Date(application.eligibleReviewAt).getTime();
            return (
              <article key={application.id} className="rounded-xl border border-zinc-800 bg-[#0d0d0f] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0"><p className="truncate text-sm font-black text-white">{application.fullName}</p><p className="mt-1 truncate text-[10px] text-zinc-500">{application.email} · {application.phone || 'Sin teléfono'}</p></div>
                  <span className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-1 text-[8px] font-black uppercase ${eligible ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-300' : 'border-amber-500/25 bg-amber-500/10 text-amber-300'}`}><Clock3 className="h-3 w-3" />{remainingLabel(application.eligibleReviewAt)}</span>
                </div>
                <p className="mt-3 flex items-center gap-1.5 text-[10px] text-zinc-400"><MapPin className="h-3.5 w-3.5 text-blue-300" />{[application.city, application.region, application.countryCode].filter(Boolean).join(', ')}</p>
                <div className="mt-3 rounded-lg border border-zinc-800 bg-zinc-950/60 p-3 text-[9px] leading-relaxed text-zinc-500">Aceptó la versión {application.requirementsVersion}: cierre de ventas, soporte personalizado regional y comisión del 25% sobre inscripciones pagadas y confirmadas.</div>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button type="button" disabled={busyId === application.id} onClick={() => void review(application, false)} className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-rose-500/25 bg-rose-500/10 px-3 py-2 text-[10px] font-black text-rose-300 disabled:opacity-50"><X className="h-3.5 w-3.5" />Rechazar</button>
                  <button type="button" disabled={!eligible || busyId === application.id} onClick={() => void review(application, true)} className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-emerald-400/25 bg-emerald-500 px-3 py-2 text-[10px] font-black text-white disabled:cursor-not-allowed disabled:opacity-40">{busyId === application.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}Aprobar 25%</button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
};


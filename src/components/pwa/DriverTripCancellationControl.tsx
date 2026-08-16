import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, Loader2, X, XCircle } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { cancelOwnDriverTrip } from '../../lib/driverTripCancellationRepository';

const ACTIVE_STATUSES = ['assigned', 'en_route', 'arrived', 'in_progress'];
const CANCEL_REASONS = [
  'Pasajero solicita cancelar',
  'Problema con el pasajero',
  'Problema mecánico o del vehículo',
  'Emergencia o situación de seguridad',
  'Otro motivo',
];

export const DriverTripCancellationControl: React.FC = () => {
  const { drivers, trips, currentUser, currentRole, currentCompany } = useApp();
  const driver = drivers.find((item) => item.userId === currentUser.id);
  const activeTrip = useMemo(
    () => trips.find((trip) => trip.driverId === driver?.id && ACTIVE_STATUSES.includes(trip.status)),
    [driver?.id, trips],
  );

  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);
  const [hiddenBadge, setHiddenBadge] = useState<HTMLElement | null>(null);
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [otherReason, setOtherReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!activeTrip) {
      setOpen(false);
      setPortalTarget(null);
      if (hiddenBadge) hiddenBadge.style.removeProperty('display');
      setHiddenBadge(null);
      return;
    }

    let currentBadge: HTMLElement | null = null;
    const bind = () => {
      const app = document.querySelector<HTMLElement>('.cg-driver-app');
      if (!app) return;
      const codeLabel = Array.from(app.querySelectorAll<HTMLParagraphElement>('p'))
        .find((element) => element.textContent?.trim() === `Carrera ${activeTrip.code}`);
      const header = codeLabel?.parentElement?.parentElement;
      if (!(header instanceof HTMLElement)) return;

      const badge = Array.from(header.querySelectorAll<HTMLElement>('span'))
        .find((element) => element.textContent?.trim() === 'Activa') ?? null;

      if (currentBadge && currentBadge !== badge) currentBadge.style.removeProperty('display');
      currentBadge = badge;
      if (badge) badge.style.setProperty('display', 'none', 'important');
      setHiddenBadge(badge);
      setPortalTarget(header);
    };

    bind();
    const observer = new MutationObserver(bind);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => {
      observer.disconnect();
      currentBadge?.style.removeProperty('display');
    };
  }, [activeTrip?.id, activeTrip?.code]);

  useEffect(() => {
    if (!open) {
      setReason('');
      setOtherReason('');
      setError('');
      setBusy(false);
    }
  }, [open]);

  if (currentRole !== 'driver' || currentCompany.id === 'network' || !activeTrip) return null;

  const finalReason = reason === 'Otro motivo' ? otherReason.trim() : reason;
  const confirmCancellation = async () => {
    if (!finalReason) {
      setError(reason === 'Otro motivo' ? 'Escribe el motivo de cancelación.' : 'Selecciona un motivo de cancelación.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await cancelOwnDriverTrip(activeTrip.id, finalReason);
      if ('vibrate' in navigator) navigator.vibrate([120, 70, 120]);
      setOpen(false);
      window.dispatchEvent(new Event('centralgo:driver-resync'));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No fue posible cancelar la carrera.');
      setBusy(false);
    }
  };

  const headerControl = portalTarget ? createPortal(
    <div className="ml-auto flex shrink-0 items-center gap-1.5">
      <span className="rounded-full border border-blue-500/25 bg-blue-500/10 px-2 py-1 text-[8px] font-black uppercase text-blue-300">Activa</span>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1 rounded-lg border border-rose-500/35 bg-rose-500/10 px-2 py-1 text-[8px] font-black uppercase text-rose-300 transition active:scale-[.98]"
        aria-label={`Cancelar carrera ${activeTrip.code}`}
      >
        <XCircle className="h-3 w-3" />
        Cancelar
      </button>
    </div>,
    portalTarget,
  ) : null;

  return <>
    {headerControl}
    {open && createPortal(
      <div className="fixed inset-0 z-[220] flex items-end justify-center bg-black/75 p-3 backdrop-blur-sm sm:items-center" role="dialog" aria-modal="true" aria-labelledby="driver-cancel-title">
        <div className="w-full max-w-md overflow-hidden rounded-3xl border border-rose-500/25 bg-[#111216] shadow-2xl shadow-black/60">
          <div className="flex items-start justify-between gap-3 border-b border-zinc-800 px-4 py-4">
            <div className="flex min-w-0 items-start gap-3">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-rose-500/25 bg-rose-500/10 text-rose-300"><AlertTriangle className="h-5 w-5" /></div>
              <div className="min-w-0"><h3 id="driver-cancel-title" className="text-sm font-black text-white">Cancelar carrera {activeTrip.code}</h3><p className="mt-1 text-[10px] leading-relaxed text-zinc-400">Selecciona el motivo. La central será avisada y el móvil quedará disponible nuevamente.</p></div>
            </div>
            <button type="button" disabled={busy} onClick={() => setOpen(false)} className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-zinc-800 bg-zinc-950 text-zinc-400 disabled:opacity-40" aria-label="Cerrar"><X className="h-4 w-4" /></button>
          </div>

          <div className="space-y-2 p-4">
            {CANCEL_REASONS.map((option) => {
              const selected = reason === option;
              return <button
                key={option}
                type="button"
                disabled={busy}
                onClick={() => { setReason(option); setError(''); }}
                className={`flex w-full items-center justify-between rounded-xl border px-3.5 py-3 text-left text-[11px] font-bold transition ${selected ? 'border-rose-400/50 bg-rose-500/15 text-rose-100' : 'border-zinc-800 bg-zinc-950/70 text-zinc-300 active:bg-zinc-900'}`}
              >
                <span>{option}</span>
                <span className={`h-4 w-4 rounded-full border ${selected ? 'border-rose-300 bg-rose-400 shadow-[inset_0_0_0_4px_#111216]' : 'border-zinc-600'}`} />
              </button>;
            })}

            {reason === 'Otro motivo' && <textarea
              autoFocus
              maxLength={180}
              value={otherReason}
              onChange={(event) => { setOtherReason(event.target.value); setError(''); }}
              placeholder="Describe brevemente qué ocurrió…"
              className="min-h-24 w-full resize-none rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-3 text-xs text-white outline-none placeholder:text-zinc-600 focus:border-rose-400"
            />}

            {error && <p className="rounded-xl border border-rose-500/25 bg-rose-500/10 px-3 py-2 text-[10px] font-bold text-rose-200">{error}</p>}
          </div>

          <div className="grid grid-cols-2 gap-2 border-t border-zinc-800 p-4">
            <button type="button" disabled={busy} onClick={() => setOpen(false)} className="rounded-xl border border-zinc-700 bg-zinc-900 py-3 text-xs font-black text-zinc-300 disabled:opacity-40">Volver</button>
            <button type="button" disabled={busy || !finalReason} onClick={() => void confirmCancellation()} className="flex items-center justify-center gap-2 rounded-xl bg-rose-600 py-3 text-xs font-black text-white shadow-lg shadow-rose-950/30 disabled:cursor-not-allowed disabled:opacity-40">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
              {busy ? 'Cancelando…' : 'Cancelar carrera'}
            </button>
          </div>
        </div>
      </div>,
      document.body,
    )}
  </>;
};

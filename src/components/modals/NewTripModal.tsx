import React, { useEffect, useRef, useState } from 'react';
import { CalendarClock, Clock3, Eraser, Loader2, MapPin, MessageSquareText, Phone, Plus, UserRound, WalletCards, X, Zap } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import type { DispatchMode, PaymentMethod } from '../../types';
import { runtimeConfig } from '../../config/runtime';
import { geocodeCommercialAddress } from '../../lib/geocoding';
import { estimateDrivingDistanceKm } from '../../lib/tripDistance';

type TripDraft = {
  origin: string;
  destination: string;
  clientName: string;
  clientPhone: string;
  payment: PaymentMethod;
  notes: string;
  scheduleEnabled: boolean;
  scheduledLocal: string;
  reservationDispatchMode: DispatchMode;
  savedAt: number;
};

const pad = (value: number) => String(value).padStart(2, '0');
const nextHourLocal = () => {
  const date = new Date(Date.now() + 60 * 60 * 1000);
  date.setMinutes(0, 0, 0);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};
const draftKey = (companyId: string) => `centralgo:new-trip-draft:v2:${companyId}`;

export const NewTripModal: React.FC = () => {
  const {
    newTripModalOpen,
    setNewTripModalOpen,
    clients,
    createTrip,
    addClient,
    fareConfig,
    currentCompany,
  } = useApp();

  const originRef = useRef<HTMLInputElement>(null);
  const submissionRequestRef = useRef<string | null>(null);
  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');
  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [payment, setPayment] = useState<PaymentMethod>('efectivo');
  const [notes, setNotes] = useState('');
  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [scheduledLocal, setScheduledLocal] = useState(nextHourLocal());
  const [reservationDispatchMode, setReservationDispatchMode] = useState<DispatchMode>('manual');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const setBlankForm = () => {
    submissionRequestRef.current = null;
    setOrigin('');
    setDestination('');
    setClientName('');
    setClientPhone('');
    setPayment('efectivo');
    setNotes('');
    setScheduleEnabled(false);
    setScheduledLocal(nextHourLocal());
    setReservationDispatchMode('manual');
    setError('');
    setSubmitting(false);
  };

  useEffect(() => {
    if (!newTripModalOpen) return;
    submissionRequestRef.current = null;
    setError('');
    setSubmitting(false);
    try {
      const raw = window.localStorage.getItem(draftKey(currentCompany.id));
      if (raw) {
        const draft = JSON.parse(raw) as Partial<TripDraft>;
        setOrigin(draft.origin ?? '');
        setDestination(draft.destination ?? '');
        setClientName(draft.clientName ?? '');
        setClientPhone(draft.clientPhone ?? '');
        setPayment(draft.payment ?? 'efectivo');
        setNotes(draft.notes ?? '');
        setScheduleEnabled(Boolean(draft.scheduleEnabled));
        setScheduledLocal(draft.scheduledLocal || nextHourLocal());
        setReservationDispatchMode(draft.reservationDispatchMode === 'automatic' ? 'automatic' : 'manual');
      } else {
        setBlankForm();
      }
    } catch {
      setBlankForm();
    }
    window.setTimeout(() => originRef.current?.focus(), 50);
  }, [newTripModalOpen, currentCompany.id]);

  useEffect(() => {
    if (!newTripModalOpen) return;
    const timer = window.setTimeout(() => {
      const meaningful = Boolean(origin.trim() || destination.trim() || clientName.trim() || clientPhone.trim() || notes.trim() || scheduleEnabled || payment !== 'efectivo');
      try {
        if (!meaningful) {
          window.localStorage.removeItem(draftKey(currentCompany.id));
          return;
        }
        const draft: TripDraft = {
          origin,
          destination,
          clientName,
          clientPhone,
          payment,
          notes,
          scheduleEnabled,
          scheduledLocal,
          reservationDispatchMode,
          savedAt: Date.now(),
        };
        window.localStorage.setItem(draftKey(currentCompany.id), JSON.stringify(draft));
      } catch {
        // El formulario sigue funcionando aunque el navegador no permita almacenamiento local.
      }
    }, 180);
    return () => window.clearTimeout(timer);
  }, [newTripModalOpen, currentCompany.id, origin, destination, clientName, clientPhone, payment, notes, scheduleEnabled, scheduledLocal, reservationDispatchMode]);

  const close = () => {
    submissionRequestRef.current = null;
    setError('');
    setSubmitting(false);
    setNewTripModalOpen(false);
  };

  const clearDraft = () => {
    try { window.localStorage.removeItem(draftKey(currentCompany.id)); } catch { /* noop */ }
    setBlankForm();
    window.setTimeout(() => originRef.current?.focus(), 20);
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (submitting) return;

    const cleanOrigin = origin.trim();
    const cleanDestination = destination.trim() || 'A convenir / Taxímetro';
    const cleanName = clientName.trim();
    const cleanPhone = clientPhone.trim();

    if (cleanOrigin.length < 3) {
      setError('Escribe la dirección de retiro.');
      originRef.current?.focus();
      return;
    }

    let scheduledFor: string | undefined;
    if (scheduleEnabled) {
      const scheduledDate = new Date(scheduledLocal);
      if (!scheduledLocal || Number.isNaN(scheduledDate.getTime()) || scheduledDate.getTime() < Date.now() + 2 * 60 * 1000) {
        setError('La reserva debe quedar al menos 2 minutos después de la hora actual.');
        return;
      }
      scheduledFor = scheduledDate.toISOString();
    }

    const requestId = submissionRequestRef.current ?? crypto.randomUUID();
    submissionRequestRef.current = requestId;
    setSubmitting(true);
    setError('');

    try {
      const originPoint = runtimeConfig.isCommercial
        ? await geocodeCommercialAddress(currentCompany.id, cleanOrigin)
        : { lat: -35.8454, lng: -71.5979 };

      const flexibleDestination = /^a convenir/i.test(cleanDestination);
      const destinationPoint = runtimeConfig.isCommercial
        ? flexibleDestination
          ? originPoint
          : await geocodeCommercialAddress(currentCompany.id, cleanDestination)
        : { lat: -35.849, lng: -71.603 };

      const distanceKm = flexibleDestination ? 0 : estimateDrivingDistanceKm(originPoint, destinationPoint);
      const estimatedFare = Math.round(fareConfig.baseFare + Math.max(0.5, distanceKm) * fareConfig.pricePerKm);

      const phoneDigits = cleanPhone.replace(/\D/g, '');
      const existingClient = clients.find((client) =>
        phoneDigits.length >= 7 && client.phone.replace(/\D/g, '') === phoneDigits,
      );

      let clientId = existingClient?.id;
      let resolvedName = cleanName || existingClient?.name || 'Cliente Particular';
      let resolvedPhone = cleanPhone || existingClient?.phone || 'Sin teléfono';

      if (!clientId && (cleanName || cleanPhone)) {
        const saved = await Promise.resolve(addClient({
          companyId: currentCompany.id,
          name: cleanName || cleanPhone || 'Cliente',
          phone: cleanPhone,
          email: undefined,
          frequentAddresses: [{
            label: 'Retiro habitual',
            address: cleanOrigin,
            lat: originPoint.lat,
            lng: originPoint.lng,
          }],
          rating: 5,
          isVIP: false,
          hasCurrentAccount: false,
        }));
        clientId = saved.id;
        resolvedName = saved.name;
        resolvedPhone = saved.phone || resolvedPhone;
      }

      await Promise.resolve(createTrip({
        operatorRequestId: requestId,
        clientId,
        clientName: resolvedName,
        clientPhone: resolvedPhone,
        origin: { ...originPoint, address: cleanOrigin },
        destination: { ...destinationPoint, address: cleanDestination },
        paymentMethod: payment,
        notes: notes.trim() || undefined,
        dispatchMode: scheduleEnabled ? reservationDispatchMode : 'manual',
        scheduledFor,
        estimatedDistanceKm: distanceKm,
        estimatedDurationMins: distanceKm > 0 ? Math.max(5, Math.round(distanceKm * 3)) : 0,
        estimatedFare,
      }));

      try { window.localStorage.removeItem(draftKey(currentCompany.id)); } catch { /* noop */ }
      setBlankForm();
      setNewTripModalOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No fue posible crear la carrera.');
      setSubmitting(false);
    }
  };

  if (!newTripModalOpen) return null;

  const inputClass = 'h-11 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-blue-500';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/75 p-3 backdrop-blur-sm">
      <div className="my-4 w-full max-w-2xl overflow-hidden rounded-2xl border border-zinc-700 bg-[#0d0d0f] shadow-[0_30px_90px_rgba(0,0,0,.55)]">
        <header className="flex items-center justify-between gap-3 border-b border-zinc-800 px-4 py-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[.18em] text-zinc-500">Despacho</p>
            <h2 className="text-lg font-black text-white">Nueva carrera</h2>
            <p className="mt-0.5 text-[10px] text-zinc-500">Los datos se guardan automáticamente en este equipo mientras escribes.</p>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={clearDraft} className="flex h-9 items-center gap-1.5 rounded-xl border border-zinc-800 bg-zinc-950 px-2.5 text-[10px] font-black text-zinc-400 hover:text-white" title="Borrar borrador guardado">
              <Eraser className="h-3.5 w-3.5" />Borrar
            </button>
            <button type="button" onClick={close} className="grid h-9 w-9 place-items-center rounded-xl border border-zinc-800 bg-zinc-950 text-zinc-400 hover:text-white" aria-label="Cerrar">
              <X className="h-4 w-4" />
            </button>
          </div>
        </header>

        <form onSubmit={submit} className="p-4">
          <section className="mb-3 grid grid-cols-2 gap-2 rounded-xl border border-zinc-800 bg-zinc-950/70 p-1.5">
            <button type="button" onClick={() => setScheduleEnabled(false)} className={`flex min-h-10 items-center justify-center gap-2 rounded-lg text-xs font-black transition ${!scheduleEnabled ? 'bg-amber-400 text-zinc-950' : 'text-zinc-400 hover:bg-zinc-900 hover:text-white'}`}>
              <Zap className="h-4 w-4" />Ahora
            </button>
            <button type="button" onClick={() => setScheduleEnabled(true)} className={`flex min-h-10 items-center justify-center gap-2 rounded-lg text-xs font-black transition ${scheduleEnabled ? 'bg-blue-600 text-white' : 'text-zinc-400 hover:bg-zinc-900 hover:text-white'}`}>
              <CalendarClock className="h-4 w-4" />Reserva
            </button>
          </section>

          {scheduleEnabled && (
            <section className="mb-3 rounded-xl border border-blue-500/25 bg-blue-500/[0.06] p-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="space-y-1.5">
                  <span className="flex items-center gap-1.5 text-xs font-black text-blue-200"><Clock3 className="h-3.5 w-3.5" />Fecha y hora de retiro</span>
                  <input type="datetime-local" value={scheduledLocal} onChange={(event) => setScheduledLocal(event.target.value)} className={`${inputClass} [color-scheme:dark]`} />
                </label>
                <div className="space-y-1.5">
                  <span className="text-xs font-black text-blue-200">Al acercarse la hora</span>
                  <div className="grid grid-cols-2 gap-1.5">
                    <button type="button" onClick={() => setReservationDispatchMode('manual')} className={`h-11 rounded-xl border text-[10px] font-black ${reservationDispatchMode === 'manual' ? 'border-cyan-400/40 bg-cyan-400/10 text-cyan-200' : 'border-zinc-800 bg-zinc-950 text-zinc-500'}`}>Manual</button>
                    <button type="button" onClick={() => setReservationDispatchMode('automatic')} className={`h-11 rounded-xl border text-[10px] font-black ${reservationDispatchMode === 'automatic' ? 'border-emerald-400/40 bg-emerald-400/10 text-emerald-200' : 'border-zinc-800 bg-zinc-950 text-zinc-500'}`}>Automático</button>
                  </div>
                </div>
              </div>
              <p className="mt-2 text-[10px] leading-relaxed text-blue-200/70">La reserva queda fuera de la planilla principal hasta la ventana operativa y conserva las alarmas de aviso.</p>
            </section>
          )}

          <div className="grid gap-3 md:grid-cols-2">
            <label className="space-y-1.5 md:col-span-2">
              <span className="flex items-center gap-1.5 text-xs font-black text-zinc-300"><MapPin className="h-3.5 w-3.5 text-amber-300" />Retiro *</span>
              <input ref={originRef} required value={origin} onChange={(event) => setOrigin(event.target.value)} placeholder="Dirección de retiro" className={inputClass} />
            </label>

            <label className="space-y-1.5 md:col-span-2">
              <span className="flex items-center gap-1.5 text-xs font-black text-zinc-300"><MapPin className="h-3.5 w-3.5 text-blue-300" />Destino</span>
              <input value={destination} onChange={(event) => setDestination(event.target.value)} placeholder="Opcional · si queda vacío se usa taxímetro" className={inputClass} />
            </label>

            <label className="space-y-1.5">
              <span className="flex items-center gap-1.5 text-xs font-black text-zinc-300"><UserRound className="h-3.5 w-3.5" />Cliente</span>
              <input value={clientName} onChange={(event) => setClientName(event.target.value)} placeholder="Nombre opcional" className={inputClass} />
            </label>

            <label className="space-y-1.5">
              <span className="flex items-center gap-1.5 text-xs font-black text-zinc-300"><Phone className="h-3.5 w-3.5" />Teléfono</span>
              <input value={clientPhone} onChange={(event) => setClientPhone(event.target.value)} placeholder="Teléfono opcional" className={inputClass} />
            </label>

            <label className="space-y-1.5">
              <span className="flex items-center gap-1.5 text-xs font-black text-zinc-300"><WalletCards className="h-3.5 w-3.5" />Pago</span>
              <select value={payment} onChange={(event) => setPayment(event.target.value as PaymentMethod)} className={inputClass}>
                <option value="efectivo">Efectivo</option>
                <option value="transferencia">Transferencia</option>
                <option value="posnet_tarjeta">Tarjeta</option>
                <option value="cuenta_corriente">Cuenta corriente</option>
              </select>
            </label>

            <label className="space-y-1.5 md:col-span-2">
              <span className="flex items-center gap-1.5 text-xs font-black text-zinc-300"><MessageSquareText className="h-3.5 w-3.5" />Nota</span>
              <textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={3} placeholder="Indicaciones importantes, si existen" className="w-full resize-none rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2.5 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-blue-500" />
            </label>
          </div>

          {error && <div className="mt-3 rounded-xl border border-rose-500/25 bg-rose-500/10 px-3 py-2.5 text-xs font-bold text-rose-200">{error}</div>}

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-zinc-800 pt-4">
            <p className="text-xs text-zinc-500">{scheduleEnabled ? 'Se guardará como reserva programada.' : 'La carrera entra a la cola y luego eliges el móvil.'}</p>
            <div className="flex gap-2">
              <button type="button" onClick={close} className="h-10 rounded-xl border border-zinc-700 bg-zinc-900 px-4 text-xs font-black text-zinc-300">Cerrar</button>
              <button type="submit" disabled={submitting} className="flex h-10 items-center gap-2 rounded-xl bg-amber-400 px-4 text-xs font-black text-zinc-950 disabled:opacity-50">
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" strokeWidth={3} />}
                {submitting ? 'Guardando…' : scheduleEnabled ? 'Crear reserva' : 'Crear carrera'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

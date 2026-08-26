import React, { useEffect, useMemo, useRef, useState } from 'react';
import { CalendarClock, Clock3, Eraser, Loader2, MapPin, MessageSquareText, Phone, Plus, UserRound, WalletCards, X, Zap } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import type { Client, DispatchMode, PaymentMethod } from '../../types';
import { runtimeConfig } from '../../config/runtime';
import { geocodeCommercialAddress } from '../../lib/geocoding';
import { estimateDrivingDistanceKm } from '../../lib/tripDistance';
import { rememberClientAddress } from '../../lib/clientMemoryRepository';

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
  fixedFareEnabled: boolean;
  fixedFareAmount: string;
  savedAt: number;
};

const QUICK_FARES = [2500, 3000, 3500, 4000];
const formatMoney = (value: number) => `$${new Intl.NumberFormat('es-CL').format(value)}`;
const normalizePhone = (value: string) => value.replace(/\D/g, '');
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
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [payment, setPayment] = useState<PaymentMethod>('efectivo');
  const [notes, setNotes] = useState('');
  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [scheduledLocal, setScheduledLocal] = useState(nextHourLocal());
  const [reservationDispatchMode, setReservationDispatchMode] = useState<DispatchMode>('manual');
  const [fixedFareEnabled, setFixedFareEnabled] = useState(false);
  const [fixedFareAmount, setFixedFareAmount] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const phoneDigits = normalizePhone(clientPhone);
  const clientMatches = useMemo(() => {
    const nameTerm = clientName.trim().toLocaleLowerCase('es-CL');
    if (phoneDigits.length < 4 && nameTerm.length < 2) return [];
    return clients
      .filter((client) => {
        const candidatePhone = normalizePhone(client.phone);
        const phoneMatch = phoneDigits.length >= 4 && candidatePhone.includes(phoneDigits);
        const nameMatch = nameTerm.length >= 2 && client.name.toLocaleLowerCase('es-CL').includes(nameTerm);
        return phoneMatch || nameMatch;
      })
      .sort((a, b) => {
        const aExact = phoneDigits.length >= 7 && normalizePhone(a.phone) === phoneDigits ? 0 : 1;
        const bExact = phoneDigits.length >= 7 && normalizePhone(b.phone) === phoneDigits ? 0 : 1;
        return aExact - bExact || b.totalTrips - a.totalTrips || a.name.localeCompare(b.name, 'es');
      })
      .slice(0, 5);
  }, [clients, clientName, phoneDigits]);

  const exactPhoneClient = useMemo(() => phoneDigits.length >= 7
    ? clients.find((client) => normalizePhone(client.phone) === phoneDigits)
    : undefined, [clients, phoneDigits]);
  const selectedClient = clients.find((client) => client.id === selectedClientId);
  const activeClient = selectedClient ?? exactPhoneClient;

  const setBlankForm = () => {
    submissionRequestRef.current = null;
    setOrigin('');
    setDestination('');
    setClientName('');
    setClientPhone('');
    setSelectedClientId(null);
    setPayment('efectivo');
    setNotes('');
    setScheduleEnabled(false);
    setScheduledLocal(nextHourLocal());
    setReservationDispatchMode('manual');
    setFixedFareEnabled(false);
    setFixedFareAmount('');
    setError('');
    setSubmitting(false);
  };

  useEffect(() => {
    if (!newTripModalOpen) return;
    submissionRequestRef.current = null;
    setSelectedClientId(null);
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
        setFixedFareEnabled(Boolean(draft.fixedFareEnabled));
        setFixedFareAmount(draft.fixedFareAmount ?? '');
      } else {
        setBlankForm();
      }
    } catch {
      setBlankForm();
    }
    window.setTimeout(() => originRef.current?.focus(), 50);
  }, [newTripModalOpen, currentCompany.id]);

  useEffect(() => {
    if (!newTripModalOpen || !exactPhoneClient) return;
    setSelectedClientId(exactPhoneClient.id);
    if (!clientName.trim()) setClientName(exactPhoneClient.name);
  }, [newTripModalOpen, exactPhoneClient?.id]);

  useEffect(() => {
    if (!newTripModalOpen) return;
    const timer = window.setTimeout(() => {
      const meaningful = Boolean(
        origin.trim()
        || destination.trim()
        || clientName.trim()
        || clientPhone.trim()
        || notes.trim()
        || scheduleEnabled
        || fixedFareEnabled
        || payment !== 'efectivo',
      );
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
          fixedFareEnabled,
          fixedFareAmount,
          savedAt: Date.now(),
        };
        window.localStorage.setItem(draftKey(currentCompany.id), JSON.stringify(draft));
      } catch {
        // El formulario sigue funcionando aunque el navegador no permita almacenamiento local.
      }
    }, 180);
    return () => window.clearTimeout(timer);
  }, [
    newTripModalOpen,
    currentCompany.id,
    origin,
    destination,
    clientName,
    clientPhone,
    payment,
    notes,
    scheduleEnabled,
    scheduledLocal,
    reservationDispatchMode,
    fixedFareEnabled,
    fixedFareAmount,
  ]);

  const selectFrequentClient = (client: Client) => {
    setSelectedClientId(client.id);
    setClientName(client.name);
    setClientPhone(client.phone);
    if (!origin.trim() && client.frequentAddresses[0]) setOrigin(client.frequentAddresses[0].address);
  };

  const close = () => {
    submissionRequestRef.current = null;
    setError('');
    setSubmitting(false);
    setNewTripModalOpen(false);
  };

  const clearDraft = () => {
    try {
      window.localStorage.removeItem(draftKey(currentCompany.id));
    } catch {
      // noop
    }
    setBlankForm();
    window.setTimeout(() => originRef.current?.focus(), 20);
  };

  const chooseQuickFare = (amount: number) => {
    setFixedFareEnabled(true);
    setFixedFareAmount(String(amount));
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (submitting) return;

    const cleanOrigin = origin.trim();
    const cleanDestination = destination.trim() || 'A convenir / Taxímetro';
    const cleanName = clientName.trim();
    const cleanPhone = clientPhone.trim();
    const parsedFixedFare = Number(fixedFareAmount.replace(/[^0-9]/g, ''));

    if (cleanOrigin.length < 3) {
      setError('Escribe la dirección de retiro.');
      originRef.current?.focus();
      return;
    }

    if (fixedFareEnabled && (!Number.isFinite(parsedFixedFare) || parsedFixedFare <= 0)) {
      setError('Ingresa una tarifa fija válida o selecciona Taxímetro / estimada.');
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
      const calculatedFare = Math.round(fareConfig.baseFare + Math.max(0.5, distanceKm) * fareConfig.pricePerKm);
      const estimatedFare = fixedFareEnabled ? parsedFixedFare : calculatedFare;

      const cleanPhoneDigits = normalizePhone(cleanPhone);
      const existingClient = clients.find((client) => client.id === selectedClientId)
        ?? clients.find((client) => cleanPhoneDigits.length >= 7 && normalizePhone(client.phone) === cleanPhoneDigits);

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
      } else if (clientId && existingClient) {
        try {
          await rememberClientAddress(currentCompany.id, clientId, {
            address: cleanOrigin,
            lat: originPoint.lat,
            lng: originPoint.lng,
          });
        } catch (addressError) {
          console.warn('[Central GO] No fue posible recordar una nueva dirección del cliente.', addressError);
        }
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
        isFixedFare: fixedFareEnabled,
        fixedFareAmount: fixedFareEnabled ? parsedFixedFare : undefined,
      }));

      try {
        window.localStorage.removeItem(draftKey(currentCompany.id));
      } catch {
        // noop
      }
      setBlankForm();
      setNewTripModalOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No fue posible crear la carrera.');
      setSubmitting(false);
    }
  };

  if (!newTripModalOpen) return null;

  const inputClass = 'h-10 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-blue-500';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden bg-black/75 p-2 backdrop-blur-sm sm:p-4">
      <div className="flex max-h-[90vh] w-[94vw] max-w-[920px] flex-col overflow-hidden rounded-2xl border border-zinc-700 bg-[#0d0d0f] shadow-[0_30px_90px_rgba(0,0,0,.55)]">
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-zinc-800 px-4 py-3 sm:px-5">
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-[.18em] text-zinc-500">Despacho</p>
            <h2 className="text-lg font-black text-white">Nueva carrera</h2>
            <p className="mt-0.5 truncate text-[10px] text-zinc-500">Los datos se guardan automáticamente en este equipo mientras escribes.</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button type="button" onClick={clearDraft} className="flex h-9 items-center gap-1.5 rounded-xl border border-zinc-800 bg-zinc-950 px-2.5 text-[10px] font-black text-zinc-400 hover:text-white" title="Borrar borrador guardado"><Eraser className="h-3.5 w-3.5" /><span className="hidden sm:inline">Borrar</span></button>
            <button type="button" onClick={close} className="grid h-9 w-9 place-items-center rounded-xl border border-zinc-800 bg-zinc-950 text-zinc-400 hover:text-white" aria-label="Cerrar"><X className="h-4 w-4" /></button>
          </div>
        </header>

        <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-3 sm:px-5">
            <section className="mb-3 grid grid-cols-2 gap-2 rounded-xl border border-zinc-800 bg-zinc-950/70 p-1">
              <button type="button" onClick={() => setScheduleEnabled(false)} className={`flex h-9 items-center justify-center gap-2 rounded-lg text-xs font-black transition ${!scheduleEnabled ? 'bg-amber-400 text-zinc-950' : 'text-zinc-400 hover:bg-zinc-900 hover:text-white'}`}><Zap className="h-4 w-4" />Ahora</button>
              <button type="button" onClick={() => setScheduleEnabled(true)} className={`flex h-9 items-center justify-center gap-2 rounded-lg text-xs font-black transition ${scheduleEnabled ? 'bg-blue-600 text-white' : 'text-zinc-400 hover:bg-zinc-900 hover:text-white'}`}><CalendarClock className="h-4 w-4" />Reserva</button>
            </section>

            {scheduleEnabled && <section className="mb-3 rounded-xl border border-blue-500/25 bg-blue-500/[0.06] p-3">
              <div className="grid items-end gap-3 md:grid-cols-[minmax(0,1fr)_280px]">
                <label className="space-y-1.5"><span className="flex items-center gap-1.5 text-xs font-black text-blue-200"><Clock3 className="h-3.5 w-3.5" />Fecha y hora de retiro</span><input type="datetime-local" value={scheduledLocal} onChange={(event) => setScheduledLocal(event.target.value)} className={`${inputClass} [color-scheme:dark]`} /></label>
                <div className="space-y-1.5"><span className="text-xs font-black text-blue-200">Al acercarse la hora</span><div className="grid grid-cols-2 gap-1.5">
                  <button type="button" onClick={() => setReservationDispatchMode('manual')} className={`h-10 rounded-xl border text-[10px] font-black ${reservationDispatchMode === 'manual' ? 'border-cyan-400/40 bg-cyan-400/10 text-cyan-200' : 'border-zinc-800 bg-zinc-950 text-zinc-500'}`}>Manual</button>
                  <button type="button" onClick={() => setReservationDispatchMode('automatic')} className={`h-10 rounded-xl border text-[10px] font-black ${reservationDispatchMode === 'automatic' ? 'border-emerald-400/40 bg-emerald-400/10 text-emerald-200' : 'border-zinc-800 bg-zinc-950 text-zinc-500'}`}>Automático</button>
                </div></div>
              </div>
              <p className="mt-2 text-[10px] leading-relaxed text-blue-200/70">La reserva queda fuera de la planilla principal hasta la ventana operativa y conserva las alarmas de aviso.</p>
            </section>}

            <div className="grid gap-x-3 gap-y-2.5 md:grid-cols-2">
              <label className="space-y-1 md:col-span-2"><span className="flex items-center gap-1.5 text-xs font-black text-zinc-300"><MapPin className="h-3.5 w-3.5 text-amber-300" />Retiro *</span><input ref={originRef} required value={origin} onChange={(event) => setOrigin(event.target.value)} placeholder="Dirección de retiro" className={inputClass} /></label>

              {activeClient?.frequentAddresses.length ? <div className="md:col-span-2 rounded-xl border border-emerald-400/20 bg-emerald-400/[0.05] p-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2"><div><p className="text-[9px] font-black uppercase tracking-[.14em] text-emerald-300">Direcciones guardadas</p><p className="text-[10px] text-zinc-500">Toca una dirección para completar el retiro.</p></div><span className="text-[9px] font-black text-emerald-200">{activeClient.frequentAddresses.length} guardada{activeClient.frequentAddresses.length === 1 ? '' : 's'}</span></div>
                <div className="mt-2 flex flex-wrap gap-1.5">{activeClient.frequentAddresses.map((address, index) => <button key={`${address.address}-${index}`} type="button" onClick={() => setOrigin(address.address)} className={`max-w-full rounded-lg border px-2.5 py-2 text-left text-[10px] font-bold ${origin.trim().toLocaleLowerCase('es-CL') === address.address.trim().toLocaleLowerCase('es-CL') ? 'border-emerald-300/50 bg-emerald-300/15 text-emerald-100' : 'border-zinc-800 bg-zinc-950 text-zinc-300 hover:border-emerald-400/30'}`}><span className="block text-[8px] font-black uppercase text-emerald-400">{address.label || `Dirección ${index + 1}`}</span><span className="block truncate">{address.address}</span></button>)}</div>
              </div> : null}

              <label className="space-y-1 md:col-span-2"><span className="flex items-center gap-1.5 text-xs font-black text-zinc-300"><MapPin className="h-3.5 w-3.5 text-blue-300" />Destino</span><input value={destination} onChange={(event) => setDestination(event.target.value)} placeholder="Opcional · si queda vacío se usa taxímetro" className={inputClass} /></label>

              <label className="space-y-1"><span className="flex items-center gap-1.5 text-xs font-black text-zinc-300"><UserRound className="h-3.5 w-3.5" />Cliente</span><input value={clientName} onChange={(event) => { setClientName(event.target.value); if (selectedClientId && event.target.value !== activeClient?.name) setSelectedClientId(null); }} placeholder="Nombre opcional" className={inputClass} /></label>
              <label className="space-y-1"><span className="flex items-center gap-1.5 text-xs font-black text-zinc-300"><Phone className="h-3.5 w-3.5" />Teléfono</span><input value={clientPhone} onChange={(event) => { setClientPhone(event.target.value); if (selectedClientId && normalizePhone(event.target.value) !== normalizePhone(activeClient?.phone ?? '')) setSelectedClientId(null); }} placeholder="Teléfono opcional" className={inputClass} /></label>

              {clientMatches.length > 0 && !activeClient ? <div className="md:col-span-2 overflow-hidden rounded-xl border border-blue-400/20 bg-blue-400/[0.05]">
                <div className="border-b border-blue-400/10 px-3 py-2"><p className="text-[9px] font-black uppercase tracking-[.14em] text-blue-300">Clientes frecuentes encontrados</p></div>
                <div className="divide-y divide-white/5">{clientMatches.map((client) => <button key={client.id} type="button" onClick={() => selectFrequentClient(client)} className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-blue-400/[0.06]"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-blue-400/10 text-[10px] font-black text-blue-200">{client.totalTrips}</span><span className="min-w-0 flex-1"><span className="block truncate text-xs font-black text-white">{client.name}</span><span className="block truncate text-[10px] text-zinc-500">{client.phone || 'Sin teléfono'} · {client.frequentAddresses[0]?.address || 'Sin dirección guardada'}</span></span><span className="text-[9px] font-black text-blue-300">Usar</span></button>)}</div>
              </div> : null}

              {activeClient ? <div className="md:col-span-2 rounded-xl border border-emerald-400/25 bg-emerald-400/[0.06] px-3 py-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2"><div className="min-w-0"><p className="text-[9px] font-black uppercase tracking-[.14em] text-emerald-300">Cliente frecuente reconocido</p><p className="mt-0.5 truncate text-xs font-black text-white">{activeClient.name} · {activeClient.phone || 'Sin teléfono'}</p></div><span className="rounded-full bg-emerald-400/10 px-2 py-1 text-[9px] font-black text-emerald-200">{activeClient.totalTrips} carrera{activeClient.totalTrips === 1 ? '' : 's'}</span></div>
                {activeClient.notes && <p className="mt-2 text-[10px] text-zinc-400">{activeClient.notes}</p>}
              </div> : null}

              <label className="space-y-1"><span className="flex items-center gap-1.5 text-xs font-black text-zinc-300"><WalletCards className="h-3.5 w-3.5" />Pago</span><select value={payment} onChange={(event) => setPayment(event.target.value as PaymentMethod)} className={inputClass}><option value="efectivo">Efectivo</option><option value="transferencia">Transferencia</option><option value="posnet_tarjeta">Tarjeta</option><option value="cuenta_corriente">Cuenta corriente</option></select></label>

              <div className="space-y-1 md:col-span-2"><span className="flex items-center gap-1.5 text-xs font-black text-zinc-300"><WalletCards className="h-3.5 w-3.5 text-emerald-300" />Tarifa</span><div className="grid gap-1.5 rounded-xl border border-zinc-800 bg-zinc-950/60 p-2 sm:grid-cols-[1.2fr_repeat(4,minmax(70px,.7fr))_1.2fr]">
                <button type="button" onClick={() => { setFixedFareEnabled(false); setFixedFareAmount(''); }} className={`h-10 rounded-lg border px-2 text-[10px] font-black ${!fixedFareEnabled ? 'border-blue-400/40 bg-blue-400/10 text-blue-200' : 'border-zinc-800 bg-zinc-950 text-zinc-500'}`}>Taxímetro / estimada</button>
                {QUICK_FARES.map((amount) => <button key={amount} type="button" onClick={() => chooseQuickFare(amount)} className={`h-10 rounded-lg border px-2 text-[10px] font-black ${fixedFareEnabled && Number(fixedFareAmount) === amount ? 'border-emerald-400/45 bg-emerald-400/10 text-emerald-200' : 'border-zinc-800 bg-zinc-950 text-zinc-400 hover:text-white'}`}>{formatMoney(amount)}</button>)}
                <input inputMode="numeric" value={fixedFareAmount} onFocus={() => setFixedFareEnabled(true)} onChange={(event) => { setFixedFareEnabled(true); setFixedFareAmount(event.target.value.replace(/[^0-9]/g, '')); }} placeholder="Otro monto" className="h-10 min-w-0 rounded-lg border border-zinc-800 bg-zinc-950 px-2 text-xs font-black text-white outline-none placeholder:text-zinc-600 focus:border-emerald-400" aria-label="Tarifa fija personalizada" />
              </div><p className="text-[9px] text-zinc-600">Si eliges un monto, la carrera se guarda como tarifa fija. Si no, mantiene la tarifa calculada/taxímetro.</p></div>

              <label className="space-y-1 md:col-span-2"><span className="flex items-center gap-1.5 text-xs font-black text-zinc-300"><MessageSquareText className="h-3.5 w-3.5" />Nota</span><textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={2} placeholder="Indicaciones importantes, si existen" className="min-h-[72px] w-full resize-none rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-blue-500" /></label>
            </div>

            {error && <div className="mt-3 rounded-xl border border-rose-500/25 bg-rose-500/10 px-3 py-2.5 text-xs font-bold text-rose-200">{error}</div>}
          </div>

          <footer className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-zinc-800 bg-[#0d0d0f] px-4 py-3 sm:px-5">
            <p className="min-w-0 flex-1 text-[11px] text-zinc-500">{fixedFareEnabled && Number(fixedFareAmount) > 0 ? `Tarifa fija ${formatMoney(Number(fixedFareAmount))}. ` : ''}{scheduleEnabled ? 'Se guardará como reserva programada.' : activeClient ? `Cliente frecuente: ${activeClient.name}.` : 'La carrera entra a la cola y luego eliges el móvil.'}</p>
            <div className="flex shrink-0 gap-2"><button type="button" onClick={close} className="h-10 rounded-xl border border-zinc-700 bg-zinc-900 px-4 text-xs font-black text-zinc-300">Cerrar</button><button type="submit" disabled={submitting} className="flex h-10 items-center gap-2 rounded-xl bg-amber-400 px-4 text-xs font-black text-zinc-950 disabled:opacity-50">{submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" strokeWidth={3} />}{submitting ? 'Guardando…' : scheduleEnabled ? 'Crear reserva' : 'Crear carrera'}</button></div>
          </footer>
        </form>
      </div>
    </div>
  );
};
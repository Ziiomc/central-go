import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Car,
  ChevronDown,
  ChevronUp,
  CircleDollarSign,
  MapPin,
  Navigation,
  Phone,
  Send,
  Sparkles,
  UserRound,
  X,
  Zap,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { PaymentMethod } from '../../types';
import { runtimeConfig } from '../../config/runtime';
import { geocodeCommercialAddress } from '../../lib/geocoding';

const ORIGIN_PRESETS = [
  ['Plaza de Armas', 'Plaza de Armas, Linares'],
  ['Hospital', 'Hospital Base de Linares, Max Jara 510'],
  ['Terminal', 'Terminal de Buses, Januario Espinoza, Linares'],
  ['Alameda', 'Alameda Valentín Letelier, Linares'],
  ['Líder Ancoa', 'Supermercado Líder Ancoa, Aníbal Pinto 650'],
] as const;

const DESTINATION_PRESETS = [
  ['A convenir', 'A convenir / Taxímetro'],
  ['Centro', 'Centro de Linares'],
  ['Hospital', 'Hospital Base de Linares'],
  ['Terminal', 'Terminal de Buses de Linares'],
  ['Alameda', 'Alameda de Linares'],
] as const;

export const NewTripModal: React.FC = () => {
  const {
    newTripModalOpen,
    setNewTripModalOpen,
    clients,
    drivers,
    createTrip,
    fareConfig,
    currentCompany,
  } = useApp();

  const originInputRef = useRef<HTMLInputElement>(null);
  const [originAddress, setOriginAddress] = useState('');
  const [destinationAddress, setDestinationAddress] = useState('A convenir / Taxímetro');
  const [selectedDriverId, setSelectedDriverId] = useState('');
  const [showMore, setShowMore] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState('');
  const [clientName, setClientName] = useState('Cliente Particular');
  const [clientPhone, setClientPhone] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('efectivo');
  const [vehicleType, setVehicleType] = useState<'standard' | 'pet' | 'wheelchair' | 'vip'>('standard');
  const [notes, setNotes] = useState('');
  const [estimatedKm, setEstimatedKm] = useState(3);
  const [isFixedFare, setIsFixedFare] = useState(false);
  const [fixedFareAmount, setFixedFareAmount] = useState(4500);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const availableDrivers = useMemo(
    () => drivers.filter((driver) => driver.status === 'available'),
    [drivers]
  );

  const calculatedFare = isFixedFare
    ? Math.max(0, fixedFareAmount)
    : Math.round(fareConfig.baseFare + Math.max(0, estimatedKm) * fareConfig.pricePerKm);

  useEffect(() => {
    if (!newTripModalOpen) return;
    setError('');
    window.setTimeout(() => originInputRef.current?.focus(), 50);

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setNewTripModalOpen(false);
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [newTripModalOpen, setNewTripModalOpen]);

  if (!newTripModalOpen) return null;

  const resetForm = () => {
    setOriginAddress('');
    setDestinationAddress('A convenir / Taxímetro');
    setSelectedDriverId('');
    setShowMore(false);
    setSelectedClientId('');
    setClientName('Cliente Particular');
    setClientPhone('');
    setPaymentMethod('efectivo');
    setVehicleType('standard');
    setNotes('');
    setEstimatedKm(3);
    setIsFixedFare(false);
    setFixedFareAmount(4500);
    setError('');
  };

  const closeModal = () => {
    setNewTripModalOpen(false);
    setError('');
  };

  const selectClient = (id: string) => {
    setSelectedClientId(id);
    const client = clients.find((item) => item.id === id);
    if (!client) {
      setClientName('Cliente Particular');
      setClientPhone('');
      return;
    }
    setClientName(client.name);
    setClientPhone(client.phone);
    if (client.frequentAddresses[0]) setOriginAddress(client.frequentAddresses[0].address);
    if (client.hasCurrentAccount) setPaymentMethod('cuenta_corriente');
  };

  const submitTrip = async (event: React.FormEvent) => {
    event.preventDefault();
    const cleanOrigin = originAddress.trim();
    const cleanDestination = destinationAddress.trim() || 'A convenir / Taxímetro';

    if (cleanOrigin.length < 3) {
      setError('Escribe la dirección donde se recoge al pasajero.');
      originInputRef.current?.focus();
      return;
    }

    const selectedDriver = availableDrivers.find((driver) => driver.id === selectedDriverId);
    setSubmitting(true);
    try {
      const originPoint = runtimeConfig.isCommercial
        ? await geocodeCommercialAddress(currentCompany.id, cleanOrigin)
        : { lat: -35.8454 + (Math.random() - 0.5) * 0.018, lng: -71.5979 + (Math.random() - 0.5) * 0.018 };

      const destinationUnknown = /^a convenir/i.test(cleanDestination);
      const destinationPoint = runtimeConfig.isCommercial
        ? (destinationUnknown ? originPoint : await geocodeCommercialAddress(currentCompany.id, cleanDestination))
        : { lat: -35.849 + (Math.random() - 0.5) * 0.018, lng: -71.603 + (Math.random() - 0.5) * 0.018 };

      await createTrip({
      clientId: selectedClientId || undefined,
      clientName: clientName.trim() || 'Cliente Particular',
      clientPhone: clientPhone.trim() || 'Sin teléfono',
      origin: {
        lat: originPoint.lat,
        lng: originPoint.lng,
        address: cleanOrigin,
      },
      destination: {
        lat: destinationPoint.lat,
        lng: destinationPoint.lng,
        address: cleanDestination,
      },
      driverId: selectedDriver?.id,
      driverUnitNumber: selectedDriver?.unitNumber,
      driverName: selectedDriver?.name,
      vehicleTypeRequested: vehicleType,
      paymentMethod,
      notes: notes.trim() || undefined,
      estimatedDistanceKm: Math.max(0.5, estimatedKm),
      estimatedDurationMins: Math.max(5, Math.round(estimatedKm * 3)),
      estimatedFare: calculatedFare,
      isFixedFare,
      fixedFareAmount: isFixedFare ? Math.max(1000, fixedFareAmount) : undefined,
      });

      setNewTripModalOpen(false);
      resetForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No fue posible crear la carrera.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/80 p-3 backdrop-blur-sm sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="new-trip-title"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) closeModal();
      }}
    >
      <div className="my-3 w-full max-w-3xl overflow-hidden rounded-3xl border border-zinc-700 bg-[#0d0d0f] shadow-2xl shadow-black/60">
        <header className="flex items-center justify-between border-b border-zinc-800 px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-400 text-zinc-950 shadow-lg shadow-amber-500/20">
              <Zap className="h-6 w-6" />
            </div>
            <div>
              <h2 id="new-trip-title" className="text-xl font-black text-white">Nueva carrera</h2>
              <p className="text-xs text-zinc-500">Origen, destino y móvil. Lo demás es opcional.</p>
            </div>
          </div>
          <button onClick={closeModal} aria-label="Cerrar" className="rounded-xl p-2 text-zinc-400 hover:bg-zinc-800 hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </header>

        <form onSubmit={submitTrip} className="space-y-5 p-4 sm:p-6">
          <section className="grid gap-4 md:grid-cols-2">
            <AddressField
              ref={originInputRef}
              label="1. ¿Dónde lo recogemos?"
              value={originAddress}
              onChange={(value) => { setOriginAddress(value); setError(''); }}
              placeholder="Ej.: Maipú 450, Linares"
              icon="origin"
              presets={ORIGIN_PRESETS}
            />
            <AddressField
              label="2. ¿A dónde va?"
              value={destinationAddress}
              onChange={setDestinationAddress}
              placeholder="Destino o “A convenir”"
              icon="destination"
              presets={DESTINATION_PRESETS}
            />
          </section>

          {error && (
            <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm font-semibold text-rose-200">
              {error}
            </div>
          )}

          <section>
            <div className="mb-2 flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-extrabold text-white">3. Asignar móvil</h3>
                <p className="text-xs text-zinc-500">Automático elige el móvil libre más cercano.</p>
              </div>
              <span className="rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-bold text-emerald-300">
                {availableDrivers.length} libres
              </span>
            </div>
            <div className="flex max-h-40 flex-wrap gap-2 overflow-y-auto rounded-2xl border border-zinc-800 bg-zinc-950/70 p-3">
              <button
                type="button"
                onClick={() => setSelectedDriverId('')}
                className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-black transition ${
                  selectedDriverId === ''
                    ? 'border-amber-200 bg-amber-400 text-zinc-950'
                    : 'border-zinc-700 bg-zinc-900 text-zinc-200 hover:border-amber-400/50'
                }`}
              >
                <Zap className="h-4 w-4" /> Automático
              </button>
              {availableDrivers.map((driver) => (
                <button
                  key={driver.id}
                  type="button"
                  onClick={() => setSelectedDriverId(driver.id)}
                  className={`rounded-xl border px-3 py-2.5 text-sm font-bold transition ${
                    selectedDriverId === driver.id
                      ? 'border-amber-200 bg-amber-400 text-zinc-950'
                      : 'border-zinc-700 bg-zinc-900 text-zinc-200 hover:border-amber-400/50'
                  }`}
                >
                  {driver.unitNumber} <span className="font-normal opacity-70">· {driver.name.split(' ')[0]}</span>
                </button>
              ))}
              {!availableDrivers.length && (
                <span className="px-2 py-2 text-sm text-amber-300">Sin móviles libres: la carrera quedará pendiente.</span>
              )}
            </div>
          </section>

          <button
            type="button"
            onClick={() => setShowMore((value) => !value)}
            className="flex w-full items-center justify-between rounded-2xl border border-zinc-800 bg-zinc-950/60 px-4 py-3 text-left hover:border-zinc-700"
          >
            <span>
              <span className="block text-sm font-bold text-white">Datos opcionales</span>
              <span className="block text-xs text-zinc-500">Pasajero, teléfono, pago, tarifa y observaciones</span>
            </span>
            {showMore ? <ChevronUp className="h-5 w-5 text-zinc-400" /> : <ChevronDown className="h-5 w-5 text-zinc-400" />}
          </button>

          {showMore && (
            <section className="grid gap-4 rounded-2xl border border-zinc-800 bg-zinc-950/40 p-4 md:grid-cols-2">
              <Field label="Cliente frecuente" icon={UserRound}>
                <select value={selectedClientId} onChange={(event) => selectClient(event.target.value)} className={inputClass}>
                  <option value="">Cliente ocasional</option>
                  {clients.map((client) => <option key={client.id} value={client.id}>{client.name} · {client.phone}</option>)}
                </select>
              </Field>
              <Field label="Nombre del pasajero" icon={UserRound}>
                <input value={clientName} onChange={(event) => setClientName(event.target.value)} className={inputClass} />
              </Field>
              <Field label="Teléfono" icon={Phone}>
                <input value={clientPhone} onChange={(event) => setClientPhone(event.target.value)} placeholder="+56 9..." className={inputClass} />
              </Field>
              <Field label="Forma de pago" icon={CircleDollarSign}>
                <select value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value as PaymentMethod)} className={inputClass}>
                  <option value="efectivo">Efectivo</option>
                  <option value="transferencia">Transferencia</option>
                  <option value="posnet_tarjeta">Tarjeta</option>
                  <option value="cuenta_corriente">Cuenta corriente</option>
                </select>
              </Field>
              <Field label="Tipo de vehículo" icon={Car}>
                <select value={vehicleType} onChange={(event) => setVehicleType(event.target.value as typeof vehicleType)} className={inputClass}>
                  <option value="standard">Estándar</option>
                  <option value="pet">Acepta mascotas</option>
                  <option value="wheelchair">Accesible / silla de ruedas</option>
                  <option value="vip">VIP</option>
                </select>
              </Field>
              <Field label="Distancia estimada" icon={Navigation}>
                <div className="relative">
                  <input type="number" min="0.5" step="0.5" value={estimatedKm} onChange={(event) => setEstimatedKm(Number(event.target.value))} className={`${inputClass} pr-12`} />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-500">km</span>
                </div>
              </Field>
              <div className="space-y-2 md:col-span-2">
                <label className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-zinc-400">
                  <CircleDollarSign className="h-4 w-4" /> Modalidad de cobro
                </label>
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => setIsFixedFare(false)} className={`rounded-xl border px-3 py-2 text-sm font-bold ${!isFixedFare ? 'border-blue-300 bg-blue-600 text-white' : 'border-zinc-700 bg-zinc-900 text-zinc-300'}`}>Taxímetro / estimado</button>
                  <button type="button" onClick={() => setIsFixedFare(true)} className={`rounded-xl border px-3 py-2 text-sm font-bold ${isFixedFare ? 'border-amber-200 bg-amber-400 text-zinc-950' : 'border-zinc-700 bg-zinc-900 text-zinc-300'}`}>Tarifa fija</button>
                  {isFixedFare && <input type="number" min="1000" step="500" value={fixedFareAmount} onChange={(event) => setFixedFareAmount(Number(event.target.value))} className="w-32 rounded-xl border border-amber-400/40 bg-zinc-950 px-3 py-2 text-sm font-bold text-amber-300 outline-none focus:border-amber-300" />}
                </div>
              </div>
              <div className="space-y-2 md:col-span-2">
                <label className="text-xs font-bold uppercase tracking-wider text-zinc-400">Observaciones para el conductor</label>
                <textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Ej.: esperar afuera, lleva mascota, tocar bocina..." rows={2} className={`${inputClass} resize-none`} />
              </div>
            </section>
          )}

          <footer className="flex flex-col-reverse gap-3 border-t border-zinc-800 pt-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm text-zinc-500">
              Tarifa estimada: <strong className="text-amber-300">${calculatedFare.toLocaleString('es-CL')}</strong>
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={closeModal} className="rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm font-bold text-zinc-300 hover:text-white">Cancelar</button>
              <button type="submit" disabled={submitting} className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-amber-200 bg-amber-400 px-6 py-3 text-sm font-black text-zinc-950 shadow-lg shadow-amber-500/20 hover:bg-amber-300 sm:flex-none">
                <Send className="h-4 w-4" /> DESPACHAR
              </button>
            </div>
          </footer>
        </form>
      </div>
    </div>
  );
};

const inputClass = 'w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-amber-400';

const AddressField = React.forwardRef<HTMLInputElement, {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  icon: 'origin' | 'destination';
  presets: readonly (readonly [string, string])[];
}>(({ label, value, onChange, placeholder, icon, presets }, ref) => (
  <div className={`rounded-2xl border p-4 ${icon === 'origin' ? 'border-emerald-500/25 bg-emerald-500/[0.035]' : 'border-rose-500/25 bg-rose-500/[0.035]'}`}>
    <label className="mb-2 flex items-center gap-2 text-sm font-extrabold text-white">
      {icon === 'origin' ? <MapPin className="h-4 w-4 text-emerald-400" /> : <Navigation className="h-4 w-4 text-rose-400" />}
      {label}
    </label>
    <input ref={ref} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className={`${inputClass} text-base`} />
    <div className="mt-3 flex flex-wrap gap-1.5">
      <span className="flex items-center gap-1 py-1 text-[10px] font-bold uppercase tracking-wider text-zinc-600"><Sparkles className="h-3 w-3" /> Atajos</span>
      {presets.map(([name, address]) => (
        <button key={name} type="button" onClick={() => onChange(address)} className="rounded-lg border border-zinc-800 bg-zinc-900 px-2 py-1 text-[11px] font-semibold text-zinc-300 hover:border-zinc-600 hover:text-white">{name}</button>
      ))}
    </div>
  </div>
));
AddressField.displayName = 'AddressField';

function Field({ label, icon: Icon, children }: { label: string; icon: React.ComponentType<{ className?: string }>; children: React.ReactNode }) {
  return (
    <label className="space-y-2">
      <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-zinc-400"><Icon className="h-4 w-4" /> {label}</span>
      {children}
    </label>
  );
}

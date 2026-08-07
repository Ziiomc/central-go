import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Car,
  CheckCircle2,
  Clock3,
  MapPin,
  Navigation,
  Phone,
  Plus,
  Radio,
  Search,
  Users,
  Zap,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { DRIVER_STATUS_LABELS, TRIP_STATUS_LABELS } from '../../lib/labels';
import { LiveMap } from '../map/LiveMap';

const activeStatusOrder = ['pending', 'assigned', 'en_route', 'arrived', 'in_progress'];

function minutesSince(date: string) {
  return Math.max(0, Math.round((Date.now() - new Date(date).getTime()) / 60000));
}

export const OperatorConsole: React.FC = () => {
  const {
    trips,
    drivers,
    setNewTripModalOpen,
    setSelectedTripForDetail,
    autoAssignClosestDriver,
    updateTripStatus,
    currentCompany,
  } = useApp();
  const [search, setSearch] = useState('');

  const availableDrivers = useMemo(
    () => drivers.filter((driver) => driver.status === 'available'),
    [drivers]
  );
  const busyDrivers = useMemo(
    () => drivers.filter((driver) => ['en_route', 'in_trip'].includes(driver.status)),
    [drivers]
  );
  const activeTrips = useMemo(
    () =>
      trips
        .filter((trip) => activeStatusOrder.includes(trip.status))
        .filter((trip) => {
          const term = search.trim().toLowerCase();
          if (!term) return true;
          return [
            trip.code,
            trip.clientName,
            trip.clientPhone,
            trip.origin.address,
            trip.destination.address,
            trip.driverUnitNumber ?? '',
          ].some((value) => value.toLowerCase().includes(term));
        })
        .sort((a, b) => {
          const statusDiff = activeStatusOrder.indexOf(a.status) - activeStatusOrder.indexOf(b.status);
          return statusDiff || new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        }),
    [trips, search]
  );

  const pendingCount = trips.filter((trip) => trip.status === 'pending').length;
  const completedToday = trips.filter((trip) => trip.status === 'completed').length;

  return (
    <div className="space-y-5 pb-8">
      <section className="rounded-2xl border border-amber-400/30 bg-gradient-to-br from-amber-400/12 via-[#111113] to-[#0b0b0d] p-4 shadow-2xl shadow-black/30 md:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <div className="mb-1 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-amber-300">
              <Radio className="h-4 w-4" /> Central operativa
            </div>
            <h1 className="text-2xl font-black tracking-tight text-white md:text-3xl">
              Despacho simple y rápido
            </h1>
            <p className="mt-1 max-w-2xl text-sm text-zinc-400">
              {currentCompany.name}. Las carreras pendientes aparecen primero y puedes asignarlas con un solo clic.
            </p>
          </div>
          <button
            onClick={() => setNewTripModalOpen(true)}
            className="flex min-h-14 w-full items-center justify-center gap-3 rounded-2xl border border-amber-200 bg-amber-400 px-6 py-3 text-base font-black text-zinc-950 shadow-xl shadow-amber-500/20 transition hover:bg-amber-300 active:scale-[0.99] lg:w-auto"
          >
            <Plus className="h-6 w-6" strokeWidth={3} />
            NUEVA CARRERA
            <span className="rounded-md bg-black/10 px-2 py-1 text-[10px] font-bold">F2</span>
          </button>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatusCard label="Móviles libres" value={availableDrivers.length} detail={`de ${drivers.length} conectados`} icon={Car} tone="emerald" />
        <StatusCard label="En servicio" value={busyDrivers.length} detail="en camino o carrera" icon={Navigation} tone="blue" />
        <StatusCard label="Por asignar" value={pendingCount} detail={pendingCount ? 'requieren atención' : 'todo al día'} icon={AlertTriangle} tone={pendingCount ? 'amber' : 'zinc'} />
        <StatusCard label="Finalizadas" value={completedToday} detail="en esta demostración" icon={CheckCircle2} tone="zinc" />
      </section>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,.65fr)]">
        <div className="overflow-hidden rounded-2xl border border-zinc-800 bg-[#0d0d0f] shadow-2xl shadow-black/20">
          <div className="flex flex-col gap-3 border-b border-zinc-800 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-base font-extrabold text-white">Cola de despacho</h2>
              <p className="text-xs text-zinc-500">Pendientes primero · toca una carrera para ver el detalle</p>
            </div>
            <div className="relative sm:w-72">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar cliente, dirección o móvil"
                className="w-full rounded-xl border border-zinc-800 bg-zinc-950 py-2.5 pl-9 pr-3 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-amber-400"
              />
            </div>
          </div>

          <div className="divide-y divide-zinc-800/80">
            {activeTrips.length === 0 ? (
              <div className="flex min-h-56 flex-col items-center justify-center gap-3 p-8 text-center">
                <CheckCircle2 className="h-10 w-10 text-emerald-400" />
                <div>
                  <p className="font-bold text-white">No hay carreras activas</p>
                  <p className="text-sm text-zinc-500">La central está al día.</p>
                </div>
                <button onClick={() => setNewTripModalOpen(true)} className="rounded-xl bg-amber-400 px-4 py-2 text-sm font-black text-zinc-950">
                  Crear carrera
                </button>
              </div>
            ) : (
              activeTrips.map((trip) => {
                const isPending = trip.status === 'pending';
                return (
                  <article
                    key={trip.id}
                    className={`p-4 transition hover:bg-zinc-900/70 ${isPending ? 'bg-amber-400/[0.045]' : ''}`}
                  >
                    <div className="flex flex-col gap-3 md:flex-row md:items-center">
                      <button
                        onClick={() => setSelectedTripForDetail(trip)}
                        className="min-w-0 flex-1 text-left"
                      >
                        <div className="mb-2 flex flex-wrap items-center gap-2">
                          <span className="font-mono text-xs font-bold text-blue-300">{trip.code}</span>
                          <TripStatusBadge status={trip.status} />
                          <span className="flex items-center gap-1 text-[11px] text-zinc-500">
                            <Clock3 className="h-3 w-3" /> hace {minutesSince(trip.createdAt)} min
                          </span>
                        </div>
                        <div className="font-bold text-white">{trip.clientName}</div>
                        <div className="mt-1 grid gap-1 text-sm sm:grid-cols-2">
                          <span className="flex min-w-0 items-center gap-1.5 text-zinc-300">
                            <MapPin className="h-4 w-4 shrink-0 text-emerald-400" />
                            <span className="truncate">{trip.origin.address}</span>
                          </span>
                          <span className="flex min-w-0 items-center gap-1.5 text-zinc-500">
                            <Navigation className="h-4 w-4 shrink-0 text-rose-400" />
                            <span className="truncate">{trip.destination.address}</span>
                          </span>
                        </div>
                      </button>

                      <div className="flex flex-wrap items-center gap-2 md:justify-end">
                        {trip.driverUnitNumber ? (
                          <span className="rounded-xl border border-blue-500/25 bg-blue-500/10 px-3 py-2 text-xs font-bold text-blue-200">
                            {trip.driverUnitNumber}
                          </span>
                        ) : (
                          <button
                            onClick={() => autoAssignClosestDriver(trip.id)}
                            disabled={!availableDrivers.length}
                            className="flex items-center gap-2 rounded-xl bg-amber-400 px-4 py-2.5 text-xs font-black text-zinc-950 transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            <Zap className="h-4 w-4" /> Asignar cercano
                          </button>
                        )}

                        {trip.status === 'arrived' && (
                          <button
                            onClick={() => updateTripStatus(trip.id, 'in_progress')}
                            className="rounded-xl bg-emerald-600 px-3 py-2.5 text-xs font-bold text-white hover:bg-emerald-500"
                          >
                            Iniciar carrera
                          </button>
                        )}
                        <a
                          href={`tel:${trip.clientPhone}`}
                          aria-label={`Llamar a ${trip.clientName}`}
                          className="rounded-xl border border-zinc-700 bg-zinc-900 p-2.5 text-zinc-300 hover:border-zinc-600 hover:text-white"
                        >
                          <Phone className="h-4 w-4" />
                        </a>
                        <button
                          onClick={() => setSelectedTripForDetail(trip)}
                          aria-label={`Ver detalle de ${trip.code}`}
                          className="rounded-xl border border-zinc-700 bg-zinc-900 p-2.5 text-zinc-300 hover:border-zinc-600 hover:text-white"
                        >
                          <ArrowRight className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })
            )}
          </div>
        </div>

        <aside className="rounded-2xl border border-zinc-800 bg-[#0d0d0f] p-4 shadow-2xl shadow-black/20">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h2 className="text-base font-extrabold text-white">Móviles libres</h2>
              <p className="text-xs text-zinc-500">Disponibles para el próximo despacho</p>
            </div>
            <span className="rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-bold text-emerald-300">
              {availableDrivers.length}
            </span>
          </div>
          <div className="space-y-2">
            {availableDrivers.slice(0, 7).map((driver) => (
              <div key={driver.id} className="flex items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-950/70 p-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-sm font-black text-emerald-300">
                  {driver.unitNumber.replace(/\D/g, '').slice(-2)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-bold text-white">{driver.unitNumber} · {driver.name}</div>
                  <div className="truncate text-xs text-zinc-500">{driver.currentLocation.address}</div>
                </div>
                <span className="text-[10px] font-bold uppercase text-emerald-400">{DRIVER_STATUS_LABELS[driver.status]}</span>
              </div>
            ))}
            {!availableDrivers.length && (
              <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 text-sm text-amber-200">
                No hay móviles libres en este momento.
              </div>
            )}
          </div>
          <button
            onClick={() => setNewTripModalOpen(true)}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-3 text-sm font-bold text-white hover:border-amber-400/50"
          >
            <Users className="h-4 w-4" /> Abrir despacho
          </button>
        </aside>
      </section>

      <section className="overflow-hidden rounded-2xl border border-zinc-800 bg-[#0d0d0f] shadow-2xl shadow-black/20">
        <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
          <div>
            <h2 className="font-extrabold text-white">Mapa de la flota</h2>
            <p className="text-xs text-zinc-500">Ubicación simulada para la demostración</p>
          </div>
          <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-400">
            <span className="h-2 w-2 rounded-full bg-emerald-400" /> En línea
          </span>
        </div>
        <LiveMap height="h-[420px]" />
      </section>
    </div>
  );
};

const toneClasses = {
  emerald: 'text-emerald-300 bg-emerald-500/10 border-emerald-500/20',
  blue: 'text-blue-300 bg-blue-500/10 border-blue-500/20',
  amber: 'text-amber-300 bg-amber-500/10 border-amber-500/20',
  zinc: 'text-zinc-300 bg-zinc-500/10 border-zinc-700',
};

function StatusCard({ label, value, detail, icon: Icon, tone }: {
  label: string;
  value: number;
  detail: string;
  icon: React.ComponentType<{ className?: string }>;
  tone: keyof typeof toneClasses;
}) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-[#0d0d0f] p-4 shadow-xl shadow-black/10">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs font-bold uppercase tracking-wider text-zinc-500">{label}</div>
          <div className="mt-1 text-3xl font-black text-white">{value}</div>
          <div className="text-[11px] text-zinc-500">{detail}</div>
        </div>
        <div className={`rounded-xl border p-2.5 ${toneClasses[tone]}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

function TripStatusBadge({ status }: { status: keyof typeof TRIP_STATUS_LABELS }) {
  const tone = status === 'pending'
    ? 'border-amber-500/30 bg-amber-500/15 text-amber-300'
    : status === 'in_progress'
      ? 'border-blue-500/30 bg-blue-500/15 text-blue-300'
      : status === 'arrived'
        ? 'border-emerald-500/30 bg-emerald-500/15 text-emerald-300'
        : 'border-zinc-700 bg-zinc-800 text-zinc-300';
  return <span className={`rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase ${tone}`}>{TRIP_STATUS_LABELS[status]}</span>;
}

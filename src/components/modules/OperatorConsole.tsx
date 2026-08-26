import React, { useMemo, useState } from 'react';
import { Car, Eye, MapPin, Navigation, Plus, Search, UserRound, Wand2, XCircle } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { DRIVER_STATUS_LABELS, TRIP_STATUS_LABELS } from '../../lib/labels';
import { Driver, Trip, TripStatus } from '../../types';
import { LiveMap } from '../map/LiveMap';

const ACTIVE_STATUSES: TripStatus[] = ['pending', 'assigned', 'en_route', 'arrived', 'in_progress'];

const statusTone: Record<TripStatus, string> = {
  pending: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
  assigned: 'border-blue-500/30 bg-blue-500/10 text-blue-300',
  en_route: 'border-sky-500/30 bg-sky-500/10 text-sky-300',
  arrived: 'border-violet-500/30 bg-violet-500/10 text-violet-300',
  in_progress: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
  completed: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
  cancelled: 'border-rose-500/30 bg-rose-500/10 text-rose-300',
};

const formatTime = (value: string) => new Date(value).toLocaleTimeString('es-CL', {
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

const nextTripAction = (status: TripStatus): { status: TripStatus; label: string } | null => {
  if (status === 'assigned') return { status: 'en_route', label: 'En camino' };
  if (status === 'en_route') return { status: 'arrived', label: 'Llegó' };
  if (status === 'arrived') return { status: 'in_progress', label: 'Iniciar viaje' };
  return null;
};

export const OperatorConsole: React.FC = () => {
  const {
    trips,
    drivers,
    setNewTripModalOpen,
    setSelectedTripForDetail,
    assignTrip,
    autoAssignClosestDriver,
    unassignTrip,
    updateTripStatus,
    cancelTrip,
  } = useApp();

  const [search, setSearch] = useState('');
  const [selectedTripId, setSelectedTripId] = useState<string | null>(null);
  const [focusDriverId, setFocusDriverId] = useState<string | null>(null);
  const [driverChoice, setDriverChoice] = useState<Record<string, string>>({});
  const [busyTripId, setBusyTripId] = useState<string | null>(null);

  const availableDrivers = useMemo(
    () => drivers
      .filter((driver) => driver.status === 'available')
      .sort((a, b) => a.unitNumber.localeCompare(b.unitNumber, 'es', { numeric: true })),
    [drivers],
  );

  const activeTrips = useMemo(() => {
    const term = search.trim().toLowerCase();
    return trips
      .filter((trip) => ACTIVE_STATUSES.includes(trip.status))
      .filter((trip) => !term || [
        trip.code,
        trip.clientName,
        trip.clientPhone,
        trip.origin.address,
        trip.destination.address,
        trip.driverUnitNumber ?? '',
      ].some((value) => String(value).toLowerCase().includes(term)))
      .sort((a, b) => {
        const statusDifference = ACTIVE_STATUSES.indexOf(a.status) - ACTIVE_STATUSES.indexOf(b.status);
        return statusDifference || new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      });
  }, [trips, search]);

  const selectedTrip = activeTrips.find((trip) => trip.id === selectedTripId) ?? null;
  const pendingCount = activeTrips.filter((trip) => trip.status === 'pending').length;
  const activeCount = activeTrips.filter((trip) => trip.status !== 'pending').length;

  const runTripAction = async (tripId: string, action: () => Promise<unknown> | unknown) => {
    if (busyTripId) return;
    setBusyTripId(tripId);
    try {
      await Promise.resolve(action());
    } catch (error) {
      window.alert(error instanceof Error ? error.message : 'No fue posible completar la operación.');
    } finally {
      setBusyTripId(null);
    }
  };

  const handleAssign = (trip: Trip) => {
    const driverId = driverChoice[trip.id];
    if (!driverId) return;
    const driver = drivers.find((item) => item.id === driverId);
    void runTripAction(trip.id, async () => {
      await Promise.resolve(assignTrip(trip.id, driverId));
      setSelectedTripId(trip.id);
      setFocusDriverId(driverId);
      setDriverChoice((current) => ({ ...current, [trip.id]: '' }));
    });
    if (driver) setFocusDriverId(driver.id);
  };

  const handleAutoAssign = (trip: Trip) => {
    void runTripAction(trip.id, async () => {
      const driver = await Promise.resolve(autoAssignClosestDriver(trip.id));
      if (driver) {
        setSelectedTripId(trip.id);
        setFocusDriverId(driver.id);
      }
    });
  };

  const handleCancel = (trip: Trip) => {
    if (!window.confirm(`¿Cancelar la carrera ${trip.code}?`)) return;
    void runTripAction(trip.id, () => cancelTrip(trip.id, 'Cancelada por la central'));
  };

  const selectTrip = (trip: Trip) => {
    setSelectedTripId(trip.id);
    setFocusDriverId(trip.driverId ?? null);
  };

  return (
    <div className="space-y-3 pb-6">
      <section className="rounded-2xl border border-zinc-800 bg-[#0d0d0f] p-3 shadow-xl shadow-black/20">
        <div className="flex flex-wrap items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-black uppercase tracking-[.18em] text-zinc-500">Central GO</p>
            <h1 className="text-xl font-black text-white">Despacho</h1>
          </div>
          <div className="flex items-center gap-2 text-xs font-black">
            <span className="rounded-lg border border-amber-500/25 bg-amber-500/10 px-2.5 py-1.5 text-amber-300">{pendingCount} pendientes</span>
            <span className="rounded-lg border border-blue-500/25 bg-blue-500/10 px-2.5 py-1.5 text-blue-300">{activeCount} activas</span>
            <span className="rounded-lg border border-emerald-500/25 bg-emerald-500/10 px-2.5 py-1.5 text-emerald-300">{availableDrivers.length} libres</span>
          </div>
          <div className="relative min-w-[220px] flex-[0_1_360px]">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar carrera o cliente"
              className="h-10 w-full rounded-xl border border-zinc-800 bg-zinc-950 pl-9 pr-3 text-sm text-white outline-none transition focus:border-blue-500"
            />
          </div>
          <button
            type="button"
            onClick={() => setNewTripModalOpen(true)}
            className="flex h-10 items-center gap-2 rounded-xl bg-amber-400 px-4 text-sm font-black text-zinc-950"
          >
            <Plus className="h-4 w-4" strokeWidth={3} />
            Nueva carrera
          </button>
        </div>
      </section>

      <section className="grid items-start gap-3 lg:grid-cols-[240px_minmax(0,1fr)] xl:grid-cols-[230px_minmax(430px,1.45fr)_minmax(340px,1fr)] 2xl:grid-cols-[250px_minmax(520px,1.6fr)_minmax(390px,1fr)]">
        <aside className="overflow-hidden rounded-2xl border border-zinc-800 bg-[#0d0d0f] shadow-xl shadow-black/20 lg:sticky lg:top-2">
          <div className="border-b border-zinc-800 px-3 py-3">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <h2 className="text-sm font-black text-white">Móviles disponibles</h2>
                <p className="mt-0.5 truncate text-[10px] text-zinc-500">Listos para recibir carrera</p>
              </div>
              <span className="rounded-lg bg-emerald-500/10 px-2 py-1 text-xs font-black text-emerald-300">{availableDrivers.length}</span>
            </div>
          </div>
          <div className="max-h-[650px] divide-y divide-zinc-800/80 overflow-y-auto">
            {availableDrivers.length === 0 ? (
              <p className="px-4 py-10 text-center text-xs text-zinc-500">No hay móviles libres.</p>
            ) : availableDrivers.map((driver: Driver) => {
              const focused = focusDriverId === driver.id;
              return (
                <button
                  key={driver.id}
                  type="button"
                  onClick={() => setFocusDriverId(focused ? null : driver.id)}
                  className={`flex w-full items-center gap-2.5 px-3 py-2.5 text-left transition ${focused ? 'bg-emerald-500/[0.10]' : 'hover:bg-zinc-900/70'}`}
                >
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-emerald-500/10 text-sm font-black text-emerald-300">{driver.unitNumber}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-black text-white">{driver.name}</span>
                    <span className="mt-0.5 block truncate text-[9px] text-zinc-500">{driver.currentLocation.address || DRIVER_STATUS_LABELS[driver.status]}</span>
                  </span>
                  <span className="rounded-md border border-zinc-800 bg-zinc-950 px-1.5 py-1 text-[8px] font-black uppercase text-zinc-500">{driver.operationMode === 'traditional' ? 'Radio' : 'App'}</span>
                </button>
              );
            })}
          </div>
        </aside>

        <div className="min-w-0 overflow-hidden rounded-2xl border border-zinc-800 bg-[#0d0d0f] shadow-xl shadow-black/20">
          <div className="border-b border-zinc-800 px-4 py-3">
            <h2 className="text-sm font-black text-white">Carreras en curso</h2>
            <p className="mt-0.5 text-xs text-zinc-500">Centro operativo: pendientes, asignadas y viajes activos.</p>
          </div>

          {activeTrips.length === 0 ? (
            <div className="flex min-h-[420px] flex-col items-center justify-center px-6 text-center">
              <Navigation className="h-8 w-8 text-emerald-400" />
              <p className="mt-3 text-sm font-black text-white">No hay carreras activas</p>
              <p className="mt-1 text-xs text-zinc-500">La central está al día.</p>
            </div>
          ) : (
            <div className="max-h-[650px] divide-y divide-zinc-800/80 overflow-y-auto">
              {activeTrips.map((trip) => {
                const next = nextTripAction(trip.status);
                const isBusy = busyTripId === trip.id;
                const isSelected = selectedTripId === trip.id;
                return (
                  <article
                    key={trip.id}
                    onClick={() => selectTrip(trip)}
                    className={`p-3 transition ${isSelected ? 'bg-blue-500/[0.07]' : 'hover:bg-zinc-900/60'}`}
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <strong className="text-sm text-white">{trip.code}</strong>
                        <span className={`rounded-md border px-2 py-0.5 text-[10px] font-black ${statusTone[trip.status]}`}>{TRIP_STATUS_LABELS[trip.status]}</span>
                        <span className="text-[10px] font-bold text-zinc-600">{formatTime(trip.createdAt)}</span>
                      </div>
                      <p className="mt-2 flex min-w-0 items-start gap-1.5 text-xs text-zinc-300">
                        <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-300" />
                        <span className="min-w-0"><strong>{trip.origin.address}</strong><span className="mx-1.5 text-zinc-600">→</span>{trip.destination.address}</span>
                      </p>
                      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
                        <p className="flex items-center gap-1.5 text-xs text-zinc-500"><UserRound className="h-3.5 w-3.5" />{trip.clientName} · {trip.clientPhone}</p>
                        {trip.driverUnitNumber && <p className="flex items-center gap-1.5 text-xs font-black text-blue-300"><Car className="h-3.5 w-3.5" />Móvil {trip.driverUnitNumber}{trip.driverName ? ` · ${trip.driverName}` : ''}</p>}
                      </div>
                    </div>

                    <div className="mt-3 flex max-w-full flex-wrap items-center gap-1.5" onClick={(event) => event.stopPropagation()}>
                      {trip.status === 'pending' && (
                        <>
                          <select
                            value={driverChoice[trip.id] ?? ''}
                            onChange={(event) => setDriverChoice((current) => ({ ...current, [trip.id]: event.target.value }))}
                            className="h-9 min-w-[150px] max-w-full flex-1 rounded-lg border border-zinc-700 bg-zinc-950 px-2 text-xs font-bold text-zinc-200 outline-none focus:border-blue-500"
                            aria-label={`Móvil para ${trip.code}`}
                          >
                            <option value="">Elegir móvil</option>
                            {availableDrivers.map((driver) => <option key={driver.id} value={driver.id}>Móvil {driver.unitNumber} · {driver.name}</option>)}
                          </select>
                          <button
                            type="button"
                            disabled={!driverChoice[trip.id] || isBusy}
                            onClick={() => handleAssign(trip)}
                            className="h-9 rounded-lg bg-blue-600 px-3 text-xs font-black text-white disabled:opacity-40"
                          >
                            Asignar
                          </button>
                          <button
                            type="button"
                            disabled={!availableDrivers.length || isBusy}
                            onClick={() => handleAutoAssign(trip)}
                            className="flex h-9 items-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-900 px-2.5 text-xs font-black text-zinc-300 disabled:opacity-40"
                            title="Asignar automáticamente al móvil más cercano"
                          >
                            <Wand2 className="h-3.5 w-3.5" />Auto
                          </button>
                        </>
                      )}

                      {next && (
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => void runTripAction(trip.id, () => updateTripStatus(trip.id, next.status))}
                          className="h-9 rounded-lg bg-emerald-600 px-3 text-xs font-black text-white disabled:opacity-40"
                        >
                          {next.label}
                        </button>
                      )}

                      {trip.status === 'assigned' && (
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => void runTripAction(trip.id, () => unassignTrip(trip.id))}
                          className="h-9 rounded-lg border border-zinc-700 bg-zinc-900 px-2.5 text-xs font-black text-zinc-300 disabled:opacity-40"
                        >
                          Liberar
                        </button>
                      )}

                      {trip.status === 'in_progress' && (
                        <button
                          type="button"
                          onClick={() => setSelectedTripForDetail(trip)}
                          className="h-9 rounded-lg bg-emerald-600 px-3 text-xs font-black text-white"
                        >
                          Finalizar
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => setSelectedTripForDetail(trip)}
                        className="grid h-9 w-9 place-items-center rounded-lg border border-zinc-700 bg-zinc-900 text-zinc-400 hover:text-white"
                        title="Ver detalle"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => handleCancel(trip)}
                        className="grid h-9 w-9 place-items-center rounded-lg border border-rose-500/20 bg-rose-500/10 text-rose-300 disabled:opacity-40"
                        title="Cancelar carrera"
                      >
                        <XCircle className="h-4 w-4" />
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>

        <aside className="overflow-hidden rounded-2xl border border-zinc-800 bg-[#0d0d0f] shadow-xl shadow-black/20 lg:col-span-2 xl:col-span-1 xl:sticky xl:top-2">
          <div className="flex items-center justify-between gap-3 border-b border-zinc-800 px-4 py-3">
            <div className="min-w-0">
              <h2 className="text-sm font-black text-white">Mapa operativo</h2>
              <p className="mt-0.5 text-xs text-zinc-500">Referencia visual de móviles y trayectos.</p>
            </div>
            {selectedTrip && <span className="max-w-[55%] truncate text-[10px] font-black text-blue-300">{selectedTrip.code}</span>}
          </div>
          <LiveMap
            height="h-[610px]"
            selectedTrip={selectedTrip}
            focusDriverId={focusDriverId}
            onSelectDriver={(driver) => setFocusDriverId(driver?.id ?? null)}
          />
        </aside>
      </section>
    </div>
  );
};
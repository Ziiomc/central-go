import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Car, Eye, GripVertical, MapPin, Navigation, Plus, Search, UserRound, Wand2, XCircle } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { DRIVER_STATUS_LABELS, TRIP_STATUS_LABELS } from '../../lib/labels';
import { loadDispatchQueue, subscribeDispatchQueue } from '../../lib/dispatchPriorityRepository';
import { Driver, Trip, TripStatus } from '../../types';
import { LiveMap } from '../map/LiveMap';

const ACTIVE_STATUSES: TripStatus[] = ['pending', 'assigned', 'en_route', 'arrived', 'in_progress'];
const PANEL_KEY = 'centralgo:operator-panel-widths:v1';
const DRIVER_MIME = 'application/x-centralgo-driver';

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

const readPanelWidths = () => {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(PANEL_KEY) || '{}') as { left?: number; map?: number };
    return {
      left: Math.min(420, Math.max(190, Number(parsed.left) || 240)),
      map: Math.min(600, Math.max(280, Number(parsed.map) || 365)),
    };
  } catch {
    return { left: 240, map: 365 };
  }
};

export const OperatorConsole: React.FC = () => {
  const {
    trips,
    drivers,
    currentCompany,
    setNewTripModalOpen,
    setSelectedTripForDetail,
    assignTrip,
    autoAssignClosestDriver,
    unassignTrip,
    updateTripStatus,
    cancelTrip,
  } = useApp();

  const gridRef = useRef<HTMLElement>(null);
  const [search, setSearch] = useState('');
  const [selectedTripId, setSelectedTripId] = useState<string | null>(null);
  const [focusDriverId, setFocusDriverId] = useState<string | null>(null);
  const [driverChoice, setDriverChoice] = useState<Record<string, string>>({});
  const [busyTripId, setBusyTripId] = useState<string | null>(null);
  const [dragDriverId, setDragDriverId] = useState<string | null>(null);
  const [dragOverTripId, setDragOverTripId] = useState<string | null>(null);
  const [queueOrder, setQueueOrder] = useState<Record<string, number>>({});
  const [now, setNow] = useState(Date.now());
  const initialWidths = useMemo(readPanelWidths, []);
  const [leftWidth, setLeftWidth] = useState(initialWidths.left);
  const [mapWidth, setMapWidth] = useState(initialWidths.map);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    try { window.localStorage.setItem(PANEL_KEY, JSON.stringify({ left: leftWidth, map: mapWidth })); } catch { /* noop */ }
  }, [leftWidth, mapWidth]);

  useEffect(() => {
    if (currentCompany.id === 'network') {
      setQueueOrder({});
      return;
    }
    let active = true;
    const refresh = async () => {
      try {
        const queue = await loadDispatchQueue(currentCompany.id);
        if (!active) return;
        setQueueOrder(Object.fromEntries(queue.map((item) => [item.driverId, item.queueOrder])));
      } catch {
        if (active) setQueueOrder({});
      }
    };
    void refresh();
    const unsubscribe = subscribeDispatchQueue(currentCompany.id, () => { void refresh(); });
    return () => {
      active = false;
      unsubscribe();
    };
  }, [currentCompany.id]);

  const availableDrivers = useMemo(
    () => drivers
      .filter((driver) => driver.status === 'available')
      .sort((a, b) => {
        const aPriority = queueOrder[a.id] ?? Number.MAX_SAFE_INTEGER;
        const bPriority = queueOrder[b.id] ?? Number.MAX_SAFE_INTEGER;
        return aPriority - bPriority || a.unitNumber.localeCompare(b.unitNumber, 'es', { numeric: true });
      }),
    [drivers, queueOrder],
  );

  const activeTrips = useMemo(() => {
    const term = search.trim().toLowerCase();
    const reservationWindow = now + 20 * 60 * 1000;
    return trips
      .filter((trip) => ACTIVE_STATUSES.includes(trip.status))
      .filter((trip) => !trip.scheduledFor || new Date(trip.scheduledFor).getTime() <= reservationWindow)
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
        if (statusDifference) return statusDifference;
        const aTime = a.scheduledFor ? new Date(a.scheduledFor).getTime() : new Date(a.createdAt).getTime();
        const bTime = b.scheduledFor ? new Date(b.scheduledFor).getTime() : new Date(b.createdAt).getTime();
        return aTime - bTime;
      });
  }, [trips, search, now]);

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

  const assignDriverToTrip = (trip: Trip, driverId: string) => {
    if (!driverId || trip.status !== 'pending') return;
    const driver = drivers.find((item) => item.id === driverId);
    if (!driver || driver.status !== 'available') return;
    void runTripAction(trip.id, async () => {
      await Promise.resolve(assignTrip(trip.id, driverId));
      setSelectedTripId(trip.id);
      setFocusDriverId(driverId);
      setDriverChoice((current) => ({ ...current, [trip.id]: '' }));
      setDragOverTripId(null);
    });
  };

  const handleAssign = (trip: Trip) => {
    const driverId = driverChoice[trip.id];
    if (driverId) assignDriverToTrip(trip, driverId);
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

  const startResize = (side: 'left' | 'map', event: React.PointerEvent<HTMLDivElement>) => {
    if (window.innerWidth < 1280) return;
    event.preventDefault();
    const startX = event.clientX;
    const startLeft = leftWidth;
    const startMap = mapWidth;
    const containerWidth = gridRef.current?.getBoundingClientRect().width ?? window.innerWidth;
    const minimumCenter = 390;

    const onMove = (moveEvent: PointerEvent) => {
      const delta = moveEvent.clientX - startX;
      if (side === 'left') {
        const maxLeft = Math.min(420, containerWidth - startMap - minimumCenter - 20);
        setLeftWidth(Math.max(190, Math.min(maxLeft, startLeft + delta));
      } else {
        const maxMap = Math.min(600, containerWidth - startLeft - minimumCenter - 20);
        setMapWidth(Math.max(280, Math.min(maxMap, startMap - delta)));
      }
    };
    const stop = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', stop);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', stop, { once: true });
  };

  const gridStyle = {
    '--cg-left-panel': `${leftWidth}px`,
    '--cg-map-panel': `${mapWidth}px`,
  } as React.CSSProperties;

  return (
    <div className="space-y-3 pb-4">
      <style>{`
        .cg-panel-resizer{display:none}
        @media (min-width:1280px){
          .cg-operator-grid{grid-template-columns:var(--cg-left-panel) 10px minmax(390px,1fr) 10px var(--cg-map-panel)!important;gap:0!important}
          .cg-panel-resizer{display:flex}
          .cg-map-panel{grid-column:auto!important}
        }
      `}</style>

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
          <div className="relative min-w-[220px] flex-[0_1_340px]">
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

      <section ref={gridRef} style={gridStyle} className="cg-operator-grid grid items-start gap-3 lg:grid-cols-[240px_minmax(0,1fr)]">
        <aside className="overflow-hidden rounded-2xl border border-zinc-800 bg-[#0d0d0f] shadow-xl shadow-black/20 lg:sticky lg:top-2">
          <div className="border-b border-zinc-800 px-3 py-3">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <h2 className="text-sm font-black text-white">Móviles disponibles</h2>
                <p className="mt-0.5 truncate text-[10px] text-zinc-500">Orden de fila persistente · arrastra o usa Asignar</p>
              </div>
              <span className="rounded-lg bg-emerald-500/10 px-2 py-1 text-xs font-black text-emerald-300">{availableDrivers.length}</span>
            </div>
          </div>
          <div className="max-h-[540px] divide-y divide-zinc-800/80 overflow-y-auto">
            {availableDrivers.length === 0 ? (
              <p className="px-4 py-10 text-center text-xs text-zinc-500">No hay móviles libres.</p>
            ) : availableDrivers.map((driver: Driver) => {
              const focused = focusDriverId === driver.id;
              const dragging = dragDriverId === driver.id;
              return (
                <button
                  key={driver.id}
                  type="button"
                  draggable
                  onDragStart={(event) => {
                    event.dataTransfer.effectAllowed = 'move';
                    event.dataTransfer.setData(DRIVER_MIME, driver.id);
                    event.dataTransfer.setData('text/plain', driver.id);
                    setDragDriverId(driver.id);
                  }}
                  onDragEnd={() => { setDragDriverId(null); setDragOverTripId(null); }}
                  onClick={() => setFocusDriverId(focused ? null : driver.id)}
                  className={`flex w-full cursor-grab items-center gap-2.5 px-3 py-2.5 text-left transition active:cursor-grabbing ${dragging ? 'opacity-45' : ''} ${focused ? 'bg-emerald-500/[0.10]' : 'hover:bg-zinc-900/70'}`}
                  title="Puedes arrastrar este móvil sobre una carrera pendiente"
                >
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-emerald-500/10 text-sm font-black text-emerald-300">{driver.unitNumber}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-black text-white">{driver.name}</span>
                    <span className="mt-0.5 block truncate text-[9px] text-zinc-500">{driver.currentLocation.address || DRIVER_STATUS_LABELS[driver.status]}</span>
                  </span>
                  {queueOrder[driver.id] != null && <span className="rounded-md border border-amber-500/20 bg-amber-500/10 px-1.5 py-1 text-[8px] font-black text-amber-300" title="Posición persistida en la fila">P{queueOrder[driver.id]}</span>}
                  <GripVertical className="h-4 w-4 shrink-0 text-zinc-700" />
                  <span className="rounded-md border border-zinc-800 bg-zinc-950 px-1.5 py-1 text-[8px] font-black uppercase text-zinc-500">{driver.operationMode === 'traditional' ? 'Radio' : 'App'}</span>
                </button>
              );
            })}
          </div>
        </aside>

        <div
          className="cg-panel-resizer h-[540px] cursor-col-resize items-center justify-center text-zinc-700 hover:bg-blue-500/10 hover:text-blue-400"
          onPointerDown={(event) => startResize('left', event)}
          title="Arrastra para cambiar el ancho de móviles"
        >
          <GripVertical className="h-5 w-5" />
        </div>

        <div className="min-w-0 overflow-hidden rounded-2xl border border-zinc-800 bg-[#0d0d0f] shadow-xl shadow-black/20">
          <div className="border-b border-zinc-800 px-4 py-3">
            <h2 className="text-sm font-black text-white">Carreras en curso</h2>
            <p className="mt-0.5 text-xs text-zinc-500">Pendientes, asignadas y activas. Las reservas aparecen aquí 20 min antes.</p>
          </div>

          {activeTrips.length === 0 ? (
            <div className="flex min-h-[360px] flex-col items-center justify-center px-6 text-center">
              <Navigation className="h-8 w-8 text-emerald-400" />
              <p className="mt-3 text-sm font-black text-white">No hay carreras activas</p>
              <p className="mt-1 text-xs text-zinc-500">La central está al día.</p>
            </div>
          ) : (
            <div className="max-h-[540px] divide-y divide-zinc-800/80 overflow-y-auto">
              {activeTrips.map((trip) => {
                const next = nextTripAction(trip.status);
                const isBusy = busyTripId === trip.id;
                const isSelected = selectedTripId === trip.id;
                const dropReady = trip.status === 'pending' && dragOverTripId === trip.id;
                return (
                  <article
                    key={trip.id}
                    data-dispatch-trip-id={trip.id}
                    onClick={() => selectTrip(trip)}
                    onDragEnter={(event) => {
                      if (trip.status !== 'pending') return;
                      event.preventDefault();
                      setDragOverTripId(trip.id);
                    }}
                    onDragOver={(event) => {
                      if (trip.status !== 'pending') return;
                      event.preventDefault();
                      event.dataTransfer.dropEffect = 'move';
                      if (dragOverTripId !== trip.id) setDragOverTripId(trip.id);
                    }}
                    onDragLeave={(event) => {
                      if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragOverTripId((current) => current === trip.id ? null : current);
                    }}
                    onDrop={(event) => {
                      if (trip.status !== 'pending') return;
                      event.preventDefault();
                      const driverId = event.dataTransfer.getData(DRIVER_MIME) || event.dataTransfer.getData('text/plain') || dragDriverId;
                      setDragDriverId(null);
                      setDragOverTripId(null);
                      if (driverId) assignDriverToTrip(trip, driverId);
                    }}
                    className={`p-3 transition ${dropReady ? 'bg-emerald-500/[0.12] ring-2 ring-inset ring-emerald-400/55' : isSelected ? 'bg-blue-500/[0.07]' : 'hover:bg-zinc-900/60'}`}
                  >
                    {dropReady && <div className="mb-2 rounded-lg border border-emerald-400/25 bg-emerald-400/10 px-2 py-1.5 text-center text-[10px] font-black text-emerald-200">Suelta aquí para asignar el móvil</div>}
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <strong className="text-sm text-white">{trip.code}</strong>
                        <span className={`rounded-md border px-2 py-0.5 text-[10px] font-black ${statusTone[trip.status]}`}>{TRIP_STATUS_LABELS[trip.status]}</span>
                        {trip.scheduledFor && <span className="rounded-md border border-sky-500/25 bg-sky-500/10 px-2 py-0.5 text-[9px] font-black text-sky-300">RESERVA · {formatTime(trip.scheduledFor)}</span>}
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
                          <button type="button" disabled={!driverChoice[trip.id] || isBusy} onClick={() => handleAssign(trip)} className="h-9 rounded-lg bg-blue-600 px-3 text-xs font-black text-white disabled:opacity-40">Asignar</button>
                          <button type="button" disabled={!availableDrivers.length || isBusy} onClick={() => handleAutoAssign(trip)} className="flex h-9 items-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-900 px-2.5 text-xs font-black text-zinc-300 disabled:opacity-40" title="Asignar automáticamente al móvil más cercano"><Wand2 className="h-3.5 w-3.5" />Auto</button>
                        </>
                      )}

                      {next && <button type="button" disabled={isBusy} onClick={() => void runTripAction(trip.id, () => updateTripStatus(trip.id, next.status))} className="h-9 rounded-lg bg-emerald-600 px-3 text-xs font-black text-white disabled:opacity-40">{next.label}</button>}

                      {trip.status === 'assigned' && <button type="button" disabled={isBusy} onClick={() => void runTripAction(trip.id, () => unassignTrip(trip.id))} className="h-9 rounded-lg border border-zinc-700 bg-zinc-900 px-2.5 text-xs font-black text-zinc-300 disabled:opacity-40">Liberar</button>}

                      {trip.status === 'in_progress' && <button type="button" onClick={() => setSelectedTripForDetail(trip)} className="h-9 rounded-lg bg-emerald-600 px-3 text-xs font-black text-white">Finalizar</button>}

                      <button type="button" onClick={() => setSelectedTripForDetail(trip)} className="grid h-9 w-9 place-items-center rounded-lg border border-zinc-700 bg-zinc-900 text-zinc-400 hover:text-white" title="Ver detalle"><Eye className="h-4 w-4" /></button>
                      <button type="button" disabled={isBusy} onClick={() => handleCancel(trip)} className="grid h-9 w-9 place-items-center rounded-lg border border-rose-500/20 bg-rose-500/10 text-rose-300 disabled:opacity-40" title="Cancelar carrera"><XCircle className="h-4 w-4" /></button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>

        <div
          className="cg-panel-resizer h-[540px] cursor-col-resize items-center justify-center text-zinc-700 hover:bg-blue-500/10 hover:text-blue-400"
          onPointerDown={(event) => startResize('map', event)}
          title="Arrastra para cambiar el ancho del mapa"
        >
          <GripVertical className="h-5 w-5" />
        </div>

        <aside className="cg-map-panel overflow-hidden rounded-2xl border border-zinc-800 bg-[#0d0d0f] shadow-xl shadow-black/20 lg:col-span-2 xl:col-span-1 xl:sticky xl:top-2">
          <div className="flex items-center justify-between gap-3 border-b border-zinc-800 px-3 py-3">
            <div className="min-w-0">
              <h2 className="text-sm font-black text-white">Mapa</h2>
              <p className="mt-0.5 truncate text-[10px] text-zinc-500">Referencia visual de móviles y carrera seleccionada</p>
            </div>
            {selectedTrip && <span className="max-w-[45%] truncate text-[10px] font-black text-blue-300">{selectedTrip.code}</span>}
          </div>
          <LiveMap
            height="h-[410px]"
            selectedTrip={selectedTrip}
            focusDriverId={focusDriverId}
            onSelectDriver={(driver) => setFocusDriverId(driver?.id ?? null)}
          />
        </aside>
      </section>
    </div>
  );
};
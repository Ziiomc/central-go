import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Car, ChevronUp, Eye, GripVertical, List, Loader2, Map as MapIcon, MapPin, Navigation, Pencil, PhoneCall, Plus, Search, UserPlus, UserRound, Wand2, XCircle } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { DRIVER_STATUS_LABELS, TRIP_STATUS_LABELS } from '../../lib/labels';
import { isQueueConnected, loadDispatchQueue, setTraditionalDriverAvailability, subscribeDispatchQueue, type DispatchQueueItem } from '../../lib/dispatchPriorityRepository';
import type { Driver, Trip, TripStatus } from '../../types';
import { LiveMap } from '../map/LiveMap';

const ACTIVE_STATUSES: TripStatus[] = ['pending', 'assigned', 'en_route', 'arrived', 'in_progress'];
const DRIVER_BUSY_STATUSES: TripStatus[] = ['assigned', 'en_route', 'arrived', 'in_progress'];
const PANEL_KEY = 'centralgo:operator-panel-widths:v2';
const MAP_PANEL_VIEW_KEY = 'centralgo:operator-map-panel-view:v1';
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

const normalizeDriverSearch = (value: string) => value
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .trim();

const resolveDriverSearch = (value: string, drivers: Driver[]) => {
  const term = normalizeDriverSearch(value);
  if (!term) return '';

  const exact = drivers.find((driver) => [
    driver.unitNumber,
    `Móvil ${driver.unitNumber}`,
    `Movil ${driver.unitNumber}`,
  ].some((candidate) => normalizeDriverSearch(candidate) === term));
  if (exact) return exact.id;
  return '';
};

const tripWaitMinutes = (createdAt: string, now: number) => Math.max(0, Math.floor((now - new Date(createdAt).getTime()) / 60000));

const tripEntryTone = (trip: Trip, now: number) => {
  if (trip.status !== 'pending') return 'border-zinc-700 bg-zinc-900 text-zinc-300';
  const minutes = tripWaitMinutes(trip.createdAt, now);
  if (minutes >= 10) return 'border-rose-400/40 bg-rose-500/15 text-rose-200';
  if (minutes >= 5) return 'border-amber-400/40 bg-amber-500/15 text-amber-200';
  return 'border-emerald-400/35 bg-emerald-500/[0.12] text-emerald-200';
};

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
      left: Math.min(300, Math.max(190, Number(parsed.left) || 210)),
      map: Math.min(620, Math.max(380, Number(parsed.map) || 440)),
    };
  } catch {
    return { left: 210, map: 440 };
  }
};

const readMapPanelView = (): 'map' | 'list' => {
  try {
    return window.localStorage.getItem(MAP_PANEL_VIEW_KEY) === 'list' ? 'list' : 'map';
  } catch {
    return 'map';
  }
};

export const OperatorConsole: React.FC = () => {
  const {
    trips,
    drivers,
    vehicles,
    currentCompany,
    setActiveModule,
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
  const [driverQuery, setDriverQuery] = useState<Record<string, string>>({});
  const busyTripIdsRef = useRef<Set<string>>(new Set());
  const [busyTripIds, setBusyTripIds] = useState<Set<string>>(() => new Set());
  const [dragDriverId, setDragDriverId] = useState<string | null>(null);
  const [dragOverTripId, setDragOverTripId] = useState<string | null>(null);
  const [queueItems, setQueueItems] = useState<DispatchQueueItem[]>([]);
  const [manualMenuOpen, setManualMenuOpen] = useState(false);
  const [manualBusyId, setManualBusyId] = useState<string | null>(null);
  const [manualError, setManualError] = useState('');
  const [manualSearch, setManualSearch] = useState('');
  const [mapPanelView, setMapPanelView] = useState<'map' | 'list'>(readMapPanelView);
  const [mapListSearch, setMapListSearch] = useState('');
  const [now, setNow] = useState(Date.now());
  const initialWidths = useMemo(readPanelWidths, []);
  const [leftWidth, setLeftWidth] = useState(initialWidths.left);
  const [mapWidth, setMapWidth] = useState(initialWidths.map);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(PANEL_KEY, JSON.stringify({ left: leftWidth, map: mapWidth }));
    } catch {
      // Panel resizing remains available for the current session.
    }
  }, [leftWidth, mapWidth]);

  useEffect(() => {
    try {
      window.localStorage.setItem(MAP_PANEL_VIEW_KEY, mapPanelView);
    } catch {
      // View preference remains available for the current session.
    }
  }, [mapPanelView]);

  useEffect(() => {
    if (currentCompany.id === 'network') {
      setQueueItems([]);
      return;
    }

    let active = true;
    const refresh = async () => {
      try {
        const queue = await loadDispatchQueue(currentCompany.id);
        if (!active) return;
        setQueueItems(queue);
      } catch {
        if (active) setQueueItems([]);
      }
    };

    void refresh();
    const unsubscribe = subscribeDispatchQueue(currentCompany.id, () => { void refresh(); });
    return () => {
      active = false;
      unsubscribe();
    };
  }, [currentCompany.id]);

  const queueOrder = useMemo(
    () => Object.fromEntries(queueItems.map((item) => [item.driverId, item.queueOrder])),
    [queueItems],
  );

  const vehicleById = useMemo(
    () => new Map(vehicles.map((vehicle) => [vehicle.id, vehicle])),
    [vehicles],
  );

  const activeTripDriverIds = useMemo(() => new Set(
    trips
      .filter((trip) => Boolean(trip.driverId) && DRIVER_BUSY_STATUSES.includes(trip.status))
      .map((trip) => trip.driverId as string),
  ), [trips]);

  const availableDrivers = useMemo(() => queueItems
    .filter((item) => item.status === 'available' && isQueueConnected(item) && !activeTripDriverIds.has(item.driverId))
    .sort((a, b) => a.queueOrder - b.queueOrder || a.unitNumber.localeCompare(b.unitNumber, 'es', { numeric: true }))
    .map((item) => drivers.find((driver) => driver.id === item.driverId))
    .filter((driver): driver is Driver => Boolean(driver)), [activeTripDriverIds, drivers, queueItems]);

  const manualDriversManageable = useMemo(() => queueItems
    .filter((item) => !activeTripDriverIds.has(item.driverId))
    .filter((item) => item.operationMode === 'traditional' || !isQueueConnected(item))
    .filter((item) => !['en_route', 'in_trip', 'sos'].includes(item.status))
    .sort((a, b) => a.unitNumber.localeCompare(b.unitNumber, 'es', { numeric: true })), [activeTripDriverIds, queueItems]);

  const filteredManualDriversManageable = useMemo(() => {
    const term = normalizeDriverSearch(manualSearch);
    if (!term) return manualDriversManageable;

    return manualDriversManageable.filter((item) => {
      const driver = drivers.find((candidate) => candidate.id === item.driverId);
      const vehicle = driver?.vehicleId ? vehicleById.get(driver.vehicleId) : undefined;
      const searchable = [item.unitNumber, item.name, driver?.phone ?? '', vehicle?.licensePlate ?? ''].join(' ');
      return normalizeDriverSearch(searchable).includes(term);
    });
  }, [drivers, manualDriversManageable, manualSearch, vehicleById]);

  const mapListDrivers = useMemo(() => {
    const term = normalizeDriverSearch(mapListSearch);
    return queueItems
      .map((item) => ({ item, driver: drivers.find((candidate) => candidate.id === item.driverId) }))
      .filter((entry): entry is { item: DispatchQueueItem; driver: Driver } => Boolean(entry.driver))
      .filter(({ item, driver }) => {
        if (!term) return true;
        const vehicle = driver.vehicleId ? vehicleById.get(driver.vehicleId) : undefined;
        const searchable = [item.unitNumber, item.name, driver.phone ?? '', vehicle?.licensePlate ?? ''].join(' ');
        return normalizeDriverSearch(searchable).includes(term);
      })
      .sort((a, b) => {
        const aBusy = activeTripDriverIds.has(a.item.driverId) ? 1 : 0;
        const bBusy = activeTripDriverIds.has(b.item.driverId) ? 1 : 0;
        const aConnected = isQueueConnected(a.item) ? 0 : 1;
        const bConnected = isQueueConnected(b.item) ? 0 : 1;
        return aBusy - bBusy || aConnected - bConnected || a.item.queueOrder - b.item.queueOrder || a.item.unitNumber.localeCompare(b.item.unitNumber, 'es', { numeric: true });
      });
  }, [activeTripDriverIds, drivers, mapListSearch, queueItems, vehicleById]);

  const noAppDriverCount = useMemo(() => queueItems.filter((item) => !item.userId).length, [queueItems]);
  const outsideQueueCount = useMemo(() => queueItems.filter((item) => !isQueueConnected(item) && !activeTripDriverIds.has(item.driverId)).length, [activeTripDriverIds, queueItems]);

  const addManualDriverToQueue = async (item: DispatchQueueItem) => {
    if (manualBusyId) return;
    setManualBusyId(item.driverId);
    setManualError('');
    try {
      await setTraditionalDriverAvailability(item.driverId, true);
      setQueueItems(await loadDispatchQueue(currentCompany.id));
    } catch (error) {
      setManualError(error instanceof Error ? error.message : 'No fue posible agregar el conductor a la fila.');
    } finally {
      setManualBusyId(null);
    }
  };

  const removeManualDriverFromQueue = async (item: DispatchQueueItem) => {
    if (manualBusyId) return;
    if (!window.confirm(`¿Sacar el móvil ${item.unitNumber} de la fila?\n\nNo se elimina el vehículo ni su historial. Podrás volver a incorporarlo manualmente cuando corresponda.`)) return;
    setManualBusyId(item.driverId);
    setManualError('');
    try {
      await setTraditionalDriverAvailability(item.driverId, false);
      setQueueItems(await loadDispatchQueue(currentCompany.id));
    } catch (error) {
      setManualError(error instanceof Error ? error.message : 'No fue posible sacar el móvil de la fila.');
    } finally {
      setManualBusyId(null);
    }
  };

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
    if (busyTripIdsRef.current.has(tripId)) return;
    busyTripIdsRef.current.add(tripId);
    setBusyTripIds(new Set(busyTripIdsRef.current));
    try {
      await Promise.resolve(action());
    } catch (error) {
      window.alert(error instanceof Error ? error.message : 'No fue posible completar la operación.');
    } finally {
      busyTripIdsRef.current.delete(tripId);
      setBusyTripIds(new Set(busyTripIdsRef.current));
    }
  };

  const assignDriverToTrip = (trip: Trip, driverId: string) => {
    if (!driverId || trip.status !== 'pending') return;
    const driver = availableDrivers.find((item) => item.id === driverId);
    if (!driver) return;
    void runTripAction(trip.id, async () => {
      await Promise.resolve(assignTrip(trip.id, driverId));
      setSelectedTripId(trip.id);
      setFocusDriverId(driverId);
      setDriverChoice((current) => ({ ...current, [trip.id]: '' }));
      setDriverQuery((current) => ({ ...current, [trip.id]: '' }));
      setDragOverTripId(null);
    });
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

  const editTrip = (trip: Trip) => {
    setSelectedTripForDetail(trip);
    window.setTimeout(() => window.dispatchEvent(new CustomEvent('centralgo:edit-trip', { detail: { tripId: trip.id } })), 0);
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
        const maxLeft = Math.min(300, containerWidth - startMap - minimumCenter - 20);
        setLeftWidth(Math.max(190, Math.min(maxLeft, startLeft + delta)));
      } else {
        const maxMap = Math.min(620, containerWidth - startLeft - minimumCenter - 20);
        setMapWidth(Math.max(380, Math.min(maxMap, startMap - delta)));
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
          .cg-operator-grid{grid-template-columns:var(--cg-left-panel) 10px minmax(390px,440px) 10px minmax(var(--cg-map-panel),1fr)!important;gap:0!important}
          .cg-panel-resizer{display:flex}
          .cg-map-panel{grid-column:auto!important}
        }
      `}</style>

      <section className="rounded-2xl border border-zinc-800 bg-[#0d0d0f] p-3 shadow-xl shadow-black/20">
        <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-center">
          <div className="min-w-0 lg:flex-1">
            <p className="text-[10px] font-black uppercase tracking-[.18em] text-zinc-500">Central GO</p>
            <h1 className="text-xl font-black text-white">Despacho</h1>
          </div>
          <div className="-mx-1 flex max-w-full items-center gap-2 overflow-x-auto px-1 pb-1 text-xs font-black sm:mx-0 sm:overflow-visible sm:px-0 sm:pb-0">
            <span className="rounded-lg border border-amber-500/25 bg-amber-500/10 px-2.5 py-1.5 text-amber-300">{pendingCount} pendientes</span>
            <span className="rounded-lg border border-blue-500/25 bg-blue-500/10 px-2.5 py-1.5 text-blue-300">{activeCount} activas</span>
            <span className="rounded-lg border border-emerald-500/25 bg-emerald-500/10 px-2.5 py-1.5 text-emerald-300">{availableDrivers.length} libres</span>
          </div>
          <div className="relative w-full lg:min-w-[220px] lg:flex-[0_1_340px]">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar carrera o cliente"
              className="h-10 w-full rounded-xl border border-zinc-800 bg-zinc-950 pl-9 pr-3 text-sm text-white outline-none transition focus:border-blue-500"
            />
          </div>
          <button type="button" onClick={() => setNewTripModalOpen(true)} className="flex h-11 w-full touch-manipulation items-center justify-center gap-2 rounded-xl bg-amber-400 px-4 text-sm font-black text-zinc-950 lg:h-10 lg:w-auto">
            <Plus className="h-4 w-4" strokeWidth={3} />
            Nueva carrera
          </button>
        </div>
      </section>

      <section ref={gridRef} style={gridStyle} className="cg-operator-grid grid items-start gap-3 lg:grid-cols-[240px_minmax(0,1fr)]">
        <aside className="overflow-visible rounded-2xl border border-zinc-800 bg-[#0d0d0f] shadow-xl shadow-black/20 lg:sticky lg:top-2">
          <div className="relative rounded-t-2xl border-b border-zinc-800 bg-[#0d0d0f] px-3 py-3">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <h2 className="text-sm font-black text-white">Móviles disponibles</h2>
                <p className="mt-0.5 truncate text-[10px] text-zinc-500">Orden de fila · arrastra para asignar</p>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => { setManualMenuOpen((open) => !open); setManualSearch(''); setManualError(''); }}
                  className={`grid h-8 w-8 place-items-center rounded-lg border transition ${manualMenuOpen ? 'border-amber-400/35 bg-amber-400/10 text-amber-200' : 'border-zinc-800 bg-zinc-950 text-zinc-400 hover:border-amber-400/25 hover:text-amber-200'}`}
                  title="Gestionar móviles por radio"
                  aria-label="Gestionar móviles por radio"
                  aria-expanded={manualMenuOpen}
                >
                  <UserPlus className="h-3.5 w-3.5" />
                </button>
                <span className="rounded-lg bg-emerald-500/10 px-2 py-1 text-xs font-black text-emerald-300">{availableDrivers.length}</span>
              </div>
            </div>

            {manualMenuOpen && (
              <div className="absolute left-0 top-[58px] z-[80] flex max-h-[calc(100dvh-5rem)] w-[min(330px,calc(100vw-2rem))] flex-col overflow-hidden rounded-xl border border-amber-400/20 bg-[#111216] shadow-2xl shadow-black/60">
                <div className="flex items-start justify-between gap-2 border-b border-white/[0.06] px-3 py-2.5">
                  <div className="min-w-0">
                    <p className="text-[10px] font-black text-white">Fila / operación por radio</p>
                    <p className="mt-0.5 text-[8px] leading-snug text-zinc-500">Busca un móvil y agrégalo por radio sin borrar su cuenta, vehículo ni historial.</p>
                  </div>
                  <button type="button" onClick={() => setManualMenuOpen(false)} className="grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-white/[0.06] text-zinc-500" aria-label="Cerrar lista de conductores manuales">
                    <ChevronUp className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div className="border-b border-white/[0.06] p-2.5">
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-500" />
                    <input
                      value={manualSearch}
                      onChange={(event) => setManualSearch(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key !== 'Enter' || manualBusyId || filteredManualDriversManageable.length !== 1) return;
                        const item = filteredManualDriversManageable[0];
                        const alreadyInQueue = item.operationMode === 'traditional' && item.serviceEnabled && item.status === 'available';
                        if (!alreadyInQueue) {
                          event.preventDefault();
                          void addManualDriverToQueue(item);
                        }
                      }}
                      placeholder="Buscar móvil, nombre, teléfono o patente"
                      autoComplete="off"
                      autoFocus
                      className="h-9 w-full rounded-lg border border-zinc-700 bg-zinc-950 pl-8 pr-8 text-[10px] font-bold text-white outline-none transition placeholder:text-zinc-600 focus:border-amber-400/60 focus:ring-2 focus:ring-amber-400/10"
                      aria-label="Buscar móvil para operación por radio"
                    />
                    {manualSearch && (
                      <button
                        type="button"
                        onClick={() => setManualSearch('')}
                        className="absolute right-1.5 top-1/2 grid h-6 w-6 -translate-y-1/2 place-items-center rounded-md text-zinc-500 transition hover:bg-white/[0.06] hover:text-white"
                        title="Limpiar búsqueda"
                        aria-label="Limpiar búsqueda de móviles"
                      >
                        <XCircle className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                  <p className="mt-1.5 text-[7px] font-bold text-zinc-600">Escribe, por ejemplo: 6, Juan, 927... o una patente.</p>
                </div>
                {manualError && <p className="mx-2 mt-2 rounded-lg border border-rose-400/20 bg-rose-400/[0.07] px-2 py-1.5 text-[8px] font-bold text-rose-200">{manualError}</p>}
                <div className="min-h-0 flex-1 divide-y divide-white/[0.055] overflow-y-auto">
                  {filteredManualDriversManageable.map((item) => {
                    const driver = drivers.find((candidate) => candidate.id === item.driverId);
                    const phone = driver?.phone?.trim() || '';
                    const vehicle = driver?.vehicleId ? vehicleById.get(driver.vehicleId) : undefined;
                    const isManualInQueue = item.operationMode === 'traditional' && item.serviceEnabled && item.status === 'available';
                    const sourceLabel = item.operationMode === 'traditional'
                      ? (item.userId ? 'Radio temporal' : 'Sin app')
                      : 'App fuera de línea · disponible para radio';
                    return (
                      <div key={item.driverId} className="flex items-center gap-2 px-2.5 py-2.5">
                        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-amber-400/20 bg-amber-400/10 text-[9px] font-black text-amber-200">{item.unitNumber}</span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[9px] font-black text-white">{item.name}</span>
                          <span className="mt-0.5 block truncate text-[7px] text-zinc-500">{[phone || 'Sin teléfono', vehicle?.licensePlate ? `Patente ${vehicle.licensePlate}` : '', sourceLabel].filter(Boolean).join(' · ')}</span>
                        </span>
                        {phone && (
                          <a href={`tel:${phone}`} className="grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-cyan-400/20 bg-cyan-400/[0.07] text-cyan-200" title={`Llamar a ${item.name}`} aria-label={`Llamar a ${item.name}`}>
                            <PhoneCall className="h-3 w-3" />
                          </a>
                        )}
                        {isManualInQueue ? (
                          <button
                            type="button"
                            disabled={Boolean(manualBusyId)}
                            onClick={() => void removeManualDriverFromQueue(item)}
                            className="inline-flex h-7 shrink-0 items-center gap-1 rounded-lg border border-rose-400/25 bg-rose-400/10 px-2 text-[7px] font-black text-rose-200 disabled:opacity-40"
                          >
                            {manualBusyId === item.driverId ? <Loader2 className="h-3 w-3 animate-spin" /> : <XCircle className="h-3 w-3" />}
                            Sacar
                          </button>
                        ) : (
                          <button
                            type="button"
                            disabled={Boolean(manualBusyId)}
                            onClick={() => void addManualDriverToQueue(item)}
                            className="inline-flex h-7 shrink-0 items-center gap-1 rounded-lg bg-emerald-400 px-2 text-[7px] font-black text-emerald-950 disabled:opacity-40"
                          >
                            {manualBusyId === item.driverId ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
                            Por radio
                          </button>
                        )}
                      </div>
                    );
                  })}
                  {!manualDriversManageable.length ? (
                    <p className="px-4 py-6 text-center text-[9px] text-zinc-500">No hay móviles fuera de fila para gestionar.</p>
                  ) : !filteredManualDriversManageable.length ? (
                    <p className="px-4 py-6 text-center text-[9px] text-zinc-500">No encontramos un móvil con esa búsqueda.</p>
                  ) : null}
                </div>
                <div className="flex items-center justify-between border-t border-white/[0.06] px-3 py-2 text-[7px] font-bold text-zinc-500">
                  <span>{manualSearch ? `${filteredManualDriversManageable.length} de ${manualDriversManageable.length} resultados` : `${manualDriversManageable.length} disponibles para gestionar`}</span>
                  <span>{outsideQueueCount} fuera de fila</span>
                </div>
              </div>
            )}
          </div>
          <div className="max-h-[500px] divide-y divide-zinc-800/80 overflow-y-auto overflow-x-hidden rounded-b-2xl">
            {availableDrivers.length === 0 ? (
              <p className="px-4 py-10 text-center text-xs text-zinc-500">No hay móviles conectados/libres. Usa + para incorporar uno por radio.</p>
            ) : availableDrivers.map((driver: Driver, index) => {
              const focused = focusDriverId === driver.id;
              const dragging = dragDriverId === driver.id;
              const vehicle = driver.vehicleId ? vehicleById.get(driver.vehicleId) : undefined;
              const secondary = [vehicle?.licensePlate ? `Patente ${vehicle.licensePlate}` : '', driver.currentLocation.address || DRIVER_STATUS_LABELS[driver.status]].filter(Boolean).join(' · ');
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
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-emerald-400/25 bg-emerald-500/10 text-base font-black text-emerald-300" title={`Posición ${index + 1} en la fila`}>{index + 1}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-black text-white">Móvil {driver.unitNumber}</span>
                    <span className="mt-0.5 block truncate text-[9px] text-zinc-500">{secondary}</span>
                  </span>
                  <GripVertical className="h-4 w-4 shrink-0 text-zinc-700" />
                </button>
              );
            })}
          </div>
          {focusDriverId && (
            <div className="border-t border-zinc-800 bg-zinc-950/25 p-2">
              <button
                type="button"
                onClick={() => {
                  try { window.sessionStorage.setItem('centralgo:focus-driver', focusDriverId); } catch { /* sesión sin storage */ }
                  setActiveModule('drivers');
                }}
                className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-cyan-400/20 bg-cyan-400/[0.07] px-2 py-2 text-[9px] font-black text-cyan-200 transition hover:border-cyan-300/40 hover:bg-cyan-400/[0.12]"
                title="Abrir la ficha del conductor seleccionado para cambiar chofer o vehículo"
              >
                <UserRound className="h-3.5 w-3.5" />
                Gestionar chofer / vehículo
              </button>
            </div>
          )}
          <div className="flex items-center justify-between gap-2 rounded-b-2xl border-t border-zinc-800 bg-zinc-950/40 px-3 py-2 text-[8px] font-bold text-zinc-500">
            <span>En fila {availableDrivers.length} · Registrados {queueItems.length}</span>
            <span>Sin app {noAppDriverCount}</span>
          </div>
        </aside>

        <div className="cg-panel-resizer h-[540px] cursor-col-resize items-center justify-center text-zinc-700 hover:bg-blue-500/10 hover:text-blue-400" onPointerDown={(event) => startResize('left', event)} title="Arrastra para cambiar el ancho de móviles">
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
                const isBusy = busyTripIds.has(trip.id);
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
                      <div className="flex items-center justify-between gap-2">
                        <span className={`rounded-md border px-2 py-0.5 text-[10px] font-black ${statusTone[trip.status]}`}>{TRIP_STATUS_LABELS[trip.status]}</span>
                        {trip.scheduledFor && <span className="rounded-md border border-sky-500/25 bg-sky-500/10 px-2 py-0.5 text-[9px] font-black text-sky-300">RESERVA · {formatTime(trip.scheduledFor)}</span>}
                        <span className={`ml-auto rounded-lg border px-2 py-1 text-[10px] font-black tabular-nums ${tripEntryTone(trip, now)}`} title={`Ingresó a las ${formatTime(trip.createdAt)}`}>
                          {formatTime(trip.createdAt)}{trip.status === 'pending' ? ` · ${tripWaitMinutes(trip.createdAt, now)} min` : ''}
                        </span>
                      </div>
                      <p className="mt-2.5 flex min-w-0 items-start gap-1.5 text-sm text-white" title={trip.origin.address}>
                        <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
                        <strong className="min-w-0 truncate">{trip.origin.address}</strong>
                      </p>
                      <p className="mt-1.5 flex min-w-0 items-center gap-1.5 text-[11px] font-bold text-zinc-200" title={[trip.clientName, trip.clientPhone].filter(Boolean).join(' · ')}>
                        <UserRound className="h-3.5 w-3.5 shrink-0 text-cyan-300" />
                        <span className="min-w-0 truncate">{trip.clientName}{trip.clientPhone && trip.clientPhone !== 'Sin teléfono' ? ` · ${trip.clientPhone}` : ''}</span>
                      </p>
                      <p className="mt-1 flex min-w-0 items-start gap-1.5 pl-0.5 text-[11px] text-zinc-500" title={trip.destination.address}>
                        <Navigation className="mt-0.5 h-3.5 w-3.5 shrink-0 text-sky-400" />
                        <span className="min-w-0 truncate">{trip.destination.address}</span>
                      </p>
                      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
                        {trip.driverUnitNumber && <p className="flex items-center gap-1.5 text-xs font-black text-blue-300"><Car className="h-3.5 w-3.5" />Móvil {trip.driverUnitNumber}</p>}
                      </div>
                    </div>

                    <div className="mt-3 flex max-w-full flex-wrap items-center gap-2 sm:gap-1.5" onClick={(event) => event.stopPropagation()}>
                      {trip.status === 'pending' && (
                        <>
                          <div className="relative w-[116px] max-w-full shrink-0">
                            <input
                              value={driverQuery[trip.id] ?? ''}
                              onChange={(event) => {
                                const value = event.target.value;
                                const driverId = resolveDriverSearch(value, availableDrivers);
                                setDriverQuery((current) => ({ ...current, [trip.id]: value }));
                                setDriverChoice((current) => ({ ...current, [trip.id]: driverId }));
                              }}
                              onKeyDown={(event) => {
                                if (event.key !== 'Enter' || isBusy) return;
                                const driverId = resolveDriverSearch(event.currentTarget.value, availableDrivers);
                                if (!driverId) return;
                                event.preventDefault();
                                assignDriverToTrip(trip, driverId);
                              }}
                              placeholder="N° móvil"
                              inputMode="numeric"
                              autoComplete="off"
                              className="h-11 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 text-center text-sm font-black text-zinc-100 outline-none transition placeholder:text-zinc-600 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 sm:h-9"
                              aria-label={`Número de móvil para asignar la carrera de ${trip.origin.address}`}
                            />
                          </div>
                          <button type="button" disabled={!driverChoice[trip.id] || isBusy} onClick={() => { const id = driverChoice[trip.id]; if (id) assignDriverToTrip(trip, id); }} className="h-11 touch-manipulation rounded-lg bg-blue-600 px-3 text-xs font-black text-white disabled:opacity-40 sm:h-9">Asignar</button>
                          <button type="button" disabled={!availableDrivers.length || isBusy} onClick={() => handleAutoAssign(trip)} className="flex h-11 touch-manipulation items-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-900 px-2.5 text-xs font-black text-zinc-300 disabled:opacity-40 sm:h-9" title="Asignar automáticamente al móvil más cercano"><Wand2 className="h-3.5 w-3.5" />Auto</button>
                        </>
                      )}

                      {next && <button type="button" disabled={isBusy} onClick={() => void runTripAction(trip.id, () => updateTripStatus(trip.id, next.status))} className="h-11 touch-manipulation rounded-lg bg-emerald-600 px-3 text-xs font-black text-white disabled:opacity-40 sm:h-9">{next.label}</button>}
                      {trip.status === 'assigned' && <button type="button" disabled={isBusy} onClick={() => void runTripAction(trip.id, () => unassignTrip(trip.id))} className="h-11 touch-manipulation rounded-lg border border-zinc-700 bg-zinc-900 px-2.5 text-xs font-black text-zinc-300 disabled:opacity-40 sm:h-9">Liberar</button>}
                      {trip.status === 'in_progress' && <button type="button" onClick={() => setSelectedTripForDetail(trip)} className="h-11 touch-manipulation rounded-lg bg-emerald-600 px-3 text-xs font-black text-white sm:h-9">Finalizar</button>}
                      <button type="button" onClick={() => editTrip(trip)} className="flex h-11 touch-manipulation items-center gap-1.5 rounded-lg border border-cyan-500/25 bg-cyan-500/10 px-2.5 text-xs font-black text-cyan-200 sm:h-9" title="Editar datos de la carrera" aria-label={`Editar ${trip.code}`}><Pencil className="h-3.5 w-3.5" /><span className="hidden sm:inline">Editar</span></button>
                      <button type="button" onClick={() => setSelectedTripForDetail(trip)} className="grid h-11 w-11 touch-manipulation place-items-center rounded-lg border border-zinc-700 bg-zinc-900 text-zinc-400 hover:text-white sm:h-9 sm:w-9" title="Ver detalle" aria-label={`Ver detalle de ${trip.code}`}><Eye className="h-4 w-4" /></button>
                      <button type="button" disabled={isBusy} onClick={() => handleCancel(trip)} className="grid h-11 w-11 touch-manipulation place-items-center rounded-lg border border-rose-500/20 bg-rose-500/10 text-rose-300 disabled:opacity-40 sm:h-9 sm:w-9" title="Cancelar carrera" aria-label={`Cancelar ${trip.code}`}><XCircle className="h-4 w-4" /></button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>

        <div className="cg-panel-resizer h-[540px] cursor-col-resize items-center justify-center text-zinc-700 hover:bg-blue-500/10 hover:text-blue-400" onPointerDown={(event) => startResize('map', event)} title="Arrastra para cambiar el ancho del mapa">
          <GripVertical className="h-5 w-5" />
        </div>

        <aside className="cg-map-panel overflow-hidden rounded-2xl border border-zinc-800 bg-[#0d0d0f] shadow-xl shadow-black/20 lg:col-span-2 xl:col-span-1 xl:sticky xl:top-2">
          <div className="flex items-center justify-between gap-2 border-b border-zinc-800 px-3 py-3">
            <div className="min-w-0 flex-1">
              <h2 className="text-sm font-black text-white">{mapPanelView === 'map' ? 'Mapa' : 'Lista de móviles'}</h2>
              <p className="mt-0.5 truncate text-[10px] text-zinc-500">{mapPanelView === 'map' ? 'Referencia visual de móviles y carrera seleccionada' : 'Estado operativo de los móviles registrados'}</p>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              {selectedTrip && <span className="hidden max-w-[100px] truncate text-[9px] font-black text-blue-300 sm:block">{selectedTrip.code}</span>}
              <div className="flex rounded-lg border border-zinc-800 bg-zinc-950 p-0.5">
                <button
                  type="button"
                  onClick={() => setMapPanelView('map')}
                  className={`flex h-7 items-center gap-1 rounded-md px-2 text-[8px] font-black transition ${mapPanelView === 'map' ? 'bg-blue-500/20 text-blue-200' : 'text-zinc-500 hover:text-white'}`}
                  title="Ver mapa"
                  aria-pressed={mapPanelView === 'map'}
                >
                  <MapIcon className="h-3 w-3" />
                  Mapa
                </button>
                <button
                  type="button"
                  onClick={() => setMapPanelView('list')}
                  className={`flex h-7 items-center gap-1 rounded-md px-2 text-[8px] font-black transition ${mapPanelView === 'list' ? 'bg-emerald-500/20 text-emerald-200' : 'text-zinc-500 hover:text-white'}`}
                  title="Ver lista"
                  aria-pressed={mapPanelView === 'list'}
                >
                  <List className="h-3 w-3" />
                  Lista
                </button>
              </div>
            </div>
          </div>

          {mapPanelView === 'map' ? (
            <LiveMap height="h-[410px]" selectedTrip={selectedTrip} focusDriverId={focusDriverId} onSelectDriver={(driver) => setFocusDriverId(driver?.id ?? null)} />
          ) : (
            <div className="flex h-[410px] flex-col">
              <div className="border-b border-zinc-800 p-2.5">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-500" />
                  <input
                    value={mapListSearch}
                    onChange={(event) => setMapListSearch(event.target.value)}
                    placeholder="Buscar móvil, nombre, teléfono o patente"
                    autoComplete="off"
                    className="h-9 w-full rounded-lg border border-zinc-700 bg-zinc-950 pl-8 pr-3 text-[10px] font-bold text-white outline-none transition placeholder:text-zinc-600 focus:border-emerald-400/60 focus:ring-2 focus:ring-emerald-400/10"
                    aria-label="Buscar en lista de móviles"
                  />
                </div>
              </div>
              <div className="min-h-0 flex-1 divide-y divide-zinc-800/80 overflow-y-auto">
                {mapListDrivers.map(({ item, driver }) => {
                  const vehicle = driver.vehicleId ? vehicleById.get(driver.vehicleId) : undefined;
                  const isBusyDriver = activeTripDriverIds.has(item.driverId);
                  const connected = isQueueConnected(item);
                  const isAvailable = !isBusyDriver && connected && item.status === 'available';
                  const statusLabel = isBusyDriver ? 'En carrera' : isAvailable ? 'Disponible' : connected ? 'Conectado' : 'Fuera de fila';
                  const statusClass = isBusyDriver
                    ? 'border-amber-400/20 bg-amber-400/10 text-amber-200'
                    : isAvailable
                      ? 'border-emerald-400/20 bg-emerald-400/10 text-emerald-200'
                      : connected
                        ? 'border-sky-400/20 bg-sky-400/10 text-sky-200'
                        : 'border-zinc-700 bg-zinc-900 text-zinc-500';
                  const focused = focusDriverId === driver.id;
                  return (
                    <button
                      key={driver.id}
                      type="button"
                      onClick={() => setFocusDriverId(focused ? null : driver.id)}
                      className={`flex w-full items-center gap-2.5 px-3 py-2.5 text-left transition ${focused ? 'bg-blue-500/[0.10]' : 'hover:bg-zinc-900/70'}`}
                    >
                      <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl border text-[11px] font-black ${isAvailable ? 'border-emerald-400/25 bg-emerald-400/10 text-emerald-200' : isBusyDriver ? 'border-amber-400/25 bg-amber-400/10 text-amber-200' : 'border-zinc-700 bg-zinc-900 text-zinc-400'}`}>{item.unitNumber}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[10px] font-black text-white">{driver.name}</span>
                        <span className="mt-0.5 block truncate text-[8px] text-zinc-500">{[vehicle?.licensePlate ? `Patente ${vehicle.licensePlate}` : '', driver.phone || '', item.operationMode === 'traditional' ? 'Radio' : 'App'].filter(Boolean).join(' · ')}</span>
                      </span>
                      <span className={`shrink-0 rounded-md border px-1.5 py-1 text-[7px] font-black ${statusClass}`}>{statusLabel}</span>
                    </button>
                  );
                })}
                {!mapListDrivers.length && (
                  <div className="flex h-full min-h-40 items-center justify-center px-5 text-center text-[10px] font-bold text-zinc-500">No encontramos móviles con esa búsqueda.</div>
                )}
              </div>
              <div className="flex items-center justify-between border-t border-zinc-800 bg-zinc-950/40 px-3 py-2 text-[8px] font-bold text-zinc-500">
                <span>{mapListDrivers.length} visibles · {queueItems.length} registrados</span>
                <span>{availableDrivers.length} disponibles</span>
              </div>
            </div>
          )}
        </aside>
      </section>
    </div>
  );
};


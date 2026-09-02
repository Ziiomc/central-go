import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDown, ArrowLeft, CalendarClock, Car, Check, ChevronUp, Eye, GripVertical, LayoutPanelTop, Loader2, MapPin, Navigation, Pencil, PhoneCall, Pin, Plus, Power, RotateCcw, Search, Trash2, UserPlus, UserRound, Wand2, XCircle, Zap } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { DRIVER_STATUS_LABELS, TRIP_STATUS_LABELS } from '../../lib/labels';
import { isQueueConnected, loadDispatchQueue, moveDispatchPriority, setTraditionalDriverAvailability, subscribeDispatchQueue, type DispatchQueueItem } from '../../lib/dispatchPriorityRepository';
import { readOperatorDispatchMode, saveOperatorDispatchMode } from '../../lib/operatorDispatchPreference';
import { RESERVATION_DISPATCH_WINDOW_MS, synchronizedNow, synchronizeServerClock, tripDelayMinutes, tripMinutesUntil, tripReferenceTimeMs, tripUrgency } from '../../lib/tripTiming';
import type { DispatchMode, Driver, Trip, TripStatus } from '../../types';
import { LiveMap } from '../map/LiveMap';

const ACTIVE_STATUSES: TripStatus[] = ['pending', 'assigned', 'en_route', 'arrived', 'in_progress'];
const DRIVER_BUSY_STATUSES: TripStatus[] = ['assigned', 'en_route', 'arrived', 'in_progress'];
type PanelId = 'map' | 'trips' | 'mobiles';
const PANEL_LAYOUT_KEY = 'centralgo:operator-panel-layout:v6';
const DEFAULT_PANEL_ORDER: PanelId[] = ['map', 'trips', 'mobiles'];
const DEFAULT_PANEL_RATIOS: Record<PanelId, number> = { map: 0.44, trips: 0.35, mobiles: 0.21 };
const MINIMUM_PANEL_WIDTH: Record<PanelId, number> = { map: 320, trips: 300, mobiles: 190 };
const DRIVER_MIME = 'application/x-centralgo-driver';
const PRIORITY_HOLD_KEY = 'centralgo:operator-priority-holds:v2';

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

const tripEntryTone = (trip: Trip, now: number) => {
  if (trip.status !== 'pending') return 'border-zinc-700 bg-zinc-900 text-zinc-300';
  const urgency = tripUrgency(trip, now);
  if (urgency === 'critical') return 'border-rose-400/40 bg-rose-500/15 text-rose-200';
  if (urgency === 'warning') return 'border-amber-400/40 bg-amber-500/15 text-amber-200';
  if (urgency === 'scheduled') return 'border-sky-400/35 bg-sky-500/[0.12] text-sky-200';
  return 'border-emerald-400/35 bg-emerald-500/[0.12] text-emerald-200';
};

const tripTimingLabel = (trip: Trip, now: number) => {
  if (trip.scheduledFor && tripReferenceTimeMs(trip) > now) return `faltan ${tripMinutesUntil(trip, now)} min`;
  const delay = tripDelayMinutes(trip, now);
  return trip.scheduledFor ? `${delay} min atraso` : `${delay} min`;
};

const nextTripAction = (status: TripStatus): { status: TripStatus; label: string } | null => {
  if (status === 'assigned') return { status: 'en_route', label: 'En camino' };
  if (status === 'en_route') return { status: 'arrived', label: 'Llegó' };
  if (status === 'arrived') return { status: 'in_progress', label: 'Iniciar viaje' };
  return null;
};

const readPanelLayout = () => {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(PANEL_LAYOUT_KEY) || '{}') as { order?: PanelId[]; ratios?: Partial<Record<PanelId, number>> };
    const order = Array.isArray(parsed.order) && parsed.order.length === 3 && new Set(parsed.order).size === 3 && DEFAULT_PANEL_ORDER.every((panel) => parsed.order?.includes(panel))
      ? parsed.order
      : DEFAULT_PANEL_ORDER;
    const candidate = { ...DEFAULT_PANEL_RATIOS, ...(parsed.ratios ?? {}) };
    const values = DEFAULT_PANEL_ORDER.map((panel) => Number(candidate[panel]));
    const total = values.reduce((sum, value) => sum + value, 0);
    const valid = values.every((value) => Number.isFinite(value) && value >= 0.12 && value <= 0.7) && total >= 0.98 && total <= 1.02;
    const ratios = valid
      ? Object.fromEntries(DEFAULT_PANEL_ORDER.map((panel) => [panel, Number(candidate[panel]) / total])) as Record<PanelId, number>
      : { ...DEFAULT_PANEL_RATIOS };
    return { order: [...order], ratios };
  } catch {
    return { order: [...DEFAULT_PANEL_ORDER], ratios: { ...DEFAULT_PANEL_RATIOS } };
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
  const [priorityHolds, setPriorityHolds] = useState<Record<string, number>>({});
  const [reservationsOpen, setReservationsOpen] = useState(false);
  const [layoutMenuOpen, setLayoutMenuOpen] = useState(false);
  const initialLayout = useMemo(readPanelLayout, []);
  const [panelOrder, setPanelOrder] = useState<PanelId[]>(initialLayout.order);
  const [panelRatios, setPanelRatios] = useState<Record<PanelId, number>>(initialLayout.ratios);
  const [dragPanelId, setDragPanelId] = useState<PanelId | null>(null);
  const [dispatchMode, setDispatchMode] = useState<DispatchMode>(() => readOperatorDispatchMode(currentCompany.id));
  const [dispatchModeBusy, setDispatchModeBusy] = useState(false);
  const [dispatchModeMessage, setDispatchModeMessage] = useState('');
  const [now, setNow] = useState(synchronizedNow());

  useEffect(() => {
    let active = true;
    const tick = () => setNow(synchronizedNow());
    const sync = () => { void synchronizeServerClock().then(() => { if (active) tick(); }).catch(() => { if (active) tick(); }); };
    sync();
    const timer = window.setInterval(tick, 15000);
    const syncTimer = window.setInterval(sync, 5 * 60 * 1000);
    const resync = () => { if (navigator.onLine) void synchronizeServerClock(true).then(() => { if (active) tick(); }).catch(() => {}); };
    window.addEventListener('focus', resync);
    window.addEventListener('online', resync);
    return () => { active = false; window.clearInterval(timer); window.clearInterval(syncTimer); window.removeEventListener('focus', resync); window.removeEventListener('online', resync); };
  }, []);

  useEffect(() => {
    try { window.localStorage.setItem(PANEL_LAYOUT_KEY, JSON.stringify({ order: panelOrder, ratios: panelRatios })); } catch { /* layout remains for this session */ }
  }, [panelOrder, panelRatios]);

  useEffect(() => {
    setDispatchMode(readOperatorDispatchMode(currentCompany.id));
    const sync = (event: Event) => {
      const detail = (event as CustomEvent<{ companyId?: string; mode?: DispatchMode }>).detail;
      if (detail?.companyId === currentCompany.id && (detail.mode === 'automatic' || detail.mode === 'manual')) setDispatchMode(detail.mode);
    };
    window.addEventListener('centralgo:dispatch-mode', sync);
    return () => window.removeEventListener('centralgo:dispatch-mode', sync);
  }, [currentCompany.id]);

  useEffect(() => {
    const ensureVisiblePanels = () => {
      if (window.innerWidth < 1280) return;
      const usableWidth = Math.max(1, (gridRef.current?.getBoundingClientRect().width ?? 0) - 20);
      if (usableWidth <= 1) return;
      const total = DEFAULT_PANEL_ORDER.reduce((sum, panel) => sum + panelRatios[panel], 0);
      const invalid = !Number.isFinite(total) || Math.abs(total - 1) > 0.02 || DEFAULT_PANEL_ORDER.some((panel) => panelRatios[panel] * usableWidth + 1 < MINIMUM_PANEL_WIDTH[panel]);
      const alreadyDefault = panelOrder.every((panel, index) => panel === DEFAULT_PANEL_ORDER[index]) && DEFAULT_PANEL_ORDER.every((panel) => Math.abs(panelRatios[panel] - DEFAULT_PANEL_RATIOS[panel]) < 0.001);
      if (invalid && !alreadyDefault) {
        setPanelOrder([...DEFAULT_PANEL_ORDER]);
        setPanelRatios({ ...DEFAULT_PANEL_RATIOS });
        window.setTimeout(() => window.dispatchEvent(new Event('resize')), 0);
      }
    };
    const frame = window.requestAnimationFrame(ensureVisiblePanels);
    window.addEventListener('resize', ensureVisiblePanels);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener('resize', ensureVisiblePanels);
    };
  }, [panelOrder, panelRatios]);

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

  useEffect(() => {
    try {
      const saved = JSON.parse(window.localStorage.getItem(`${PRIORITY_HOLD_KEY}:${currentCompany.id}`) || '{}') as Record<string, number>;
      setPriorityHolds(saved);
    } catch {
      setPriorityHolds({});
    }
  }, [currentCompany.id]);

  const queueItemByDriverId = useMemo(
    () => new Map(queueItems.map((item) => [item.driverId, item])),
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

  const queueDrivers = useMemo(() => queueItems
    .filter((item) => activeTripDriverIds.has(item.driverId) || item.serviceEnabled || item.status === 'offline')
    .sort((a, b) => {
      const disconnected = (item: DispatchQueueItem) => item.status === 'offline'
        || (item.operationMode === 'app' && item.status === 'available' && !isQueueConnected(item));
      const rank = (item: DispatchQueueItem) => disconnected(item) ? 2 : activeTripDriverIds.has(item.driverId) ? 1 : 0;
      const rankDifference = rank(a) - rank(b);
      if (rankDifference) return rankDifference;
      return a.queueOrder - b.queueOrder || a.unitNumber.localeCompare(b.unitNumber, 'es', { numeric: true });
    })
    .map((item) => drivers.find((driver) => driver.id === item.driverId))
    .filter((driver): driver is Driver => Boolean(driver)), [activeTripDriverIds, drivers, queueItems]);

  const manualDriversManageable = useMemo(() => queueItems
    .filter((item) => !activeTripDriverIds.has(item.driverId))
    .filter((item) => item.operationMode === 'traditional' || !isQueueConnected(item))
    .filter((item) => !['en_route', 'in_trip', 'sos'].includes(item.status))
    .sort((a, b) => a.unitNumber.localeCompare(b.unitNumber, 'es', { numeric: true })), [activeTripDriverIds, queueItems]);

  const quickManualMatch = useMemo(() => {
    const unit = manualSearch.trim().toLowerCase();
    if (!unit) return null;
    return manualDriversManageable.find((item) => item.unitNumber.trim().toLowerCase() === unit) ?? null;
  }, [manualDriversManageable, manualSearch]);

  const noAppDriverCount = useMemo(() => queueItems.filter((item) => !item.userId).length, [queueItems]);

  const restorePriorityHold = async (driverId: string, preferredIndex: number) => {
    let currentQueue = await loadDispatchQueue(currentCompany.id);
    for (let attempt = 0; attempt < Math.max(1, currentQueue.length * 2); attempt += 1) {
      const visible = currentQueue
        .filter((item) => item.status === 'available' && isQueueConnected(item) && !activeTripDriverIds.has(item.driverId))
        .sort((a, b) => a.queueOrder - b.queueOrder || a.unitNumber.localeCompare(b.unitNumber, 'es', { numeric: true }));
      const currentIndex = visible.findIndex((item) => item.driverId === driverId);
      if (currentIndex < 0 || currentIndex <= preferredIndex) return;
      await moveDispatchPriority(driverId, 'up');
      currentQueue = await loadDispatchQueue(currentCompany.id);
    }
  };

  const refreshQueueAfterControl = async () => setQueueItems(await loadDispatchQueue(currentCompany.id));

  const moveDriverInQueue = async (driver: Driver, direction: 'up' | 'down') => {
    if (manualBusyId) return;
    const visibleBefore = availableDrivers.map((item) => item.id);
    const startIndex = visibleBefore.indexOf(driver.id);
    if (startIndex < 0 || (direction === 'up' ? startIndex === 0 : startIndex === visibleBefore.length - 1)) return;
    setManualBusyId(driver.id);
    setManualError('');
    try {
      let latest = queueItems;
      // The database queue also contains temporarily busy/paused mobiles. Move
      // through those hidden entries until the visible waiting order changes.
      for (let attempt = 0; attempt < Math.max(1, queueItems.length); attempt += 1) {
        await moveDispatchPriority(driver.id, direction);
        latest = await loadDispatchQueue(currentCompany.id);
        const visibleAfter = latest
          .filter((item) => item.status === 'available' && isQueueConnected(item) && !activeTripDriverIds.has(item.driverId))
          .sort((a, b) => a.queueOrder - b.queueOrder || a.unitNumber.localeCompare(b.unitNumber, 'es', { numeric: true }));
        if (visibleAfter.findIndex((item) => item.driverId === driver.id) !== startIndex) break;
      }
      setQueueItems(latest);
    } catch (error) {
      setManualError(error instanceof Error ? error.message : 'No fue posible cambiar el orden de la fila.');
    } finally {
      setManualBusyId(null);
    }
  };

  const addManualDriverToQueue = async (item: DispatchQueueItem) => {
    if (manualBusyId) return;
    setManualBusyId(item.driverId);
    setManualError('');
    try {
      await setTraditionalDriverAvailability(item.driverId, true);
      if (priorityHolds[item.driverId] != null) await restorePriorityHold(item.driverId, priorityHolds[item.driverId]);
      await refreshQueueAfterControl();
    } catch (error) {
      setManualError(error instanceof Error ? error.message : 'No fue posible agregar el conductor a la fila.');
    } finally {
      setManualBusyId(null);
    }
  };

  const submitQuickManualDriver = (event: React.FormEvent) => {
    event.preventDefault();
    setManualError('');
    if (!manualSearch.trim()) {
      setManualError('Escribe el número del móvil.');
      return;
    }
    if (!quickManualMatch) {
      setManualError(`No encontramos el móvil ${manualSearch.trim()} fuera de la fila.`);
      return;
    }
    void addManualDriverToQueue(quickManualMatch).then(() => setManualSearch(''));
  };

  const toggleQueueIncorporation = async (driver: Driver) => {
    const queueItem = queueItemByDriverId.get(driver.id);
    if (!queueItem || manualBusyId) return;
    setManualBusyId(driver.id);
    setManualError('');
    try {
      const isManualInQueue = queueItem.operationMode === 'traditional'
        && queueItem.serviceEnabled
        && queueItem.status === 'available';
      await setTraditionalDriverAvailability(driver.id, !isManualInQueue);
      if (!isManualInQueue && priorityHolds[driver.id] != null) await restorePriorityHold(driver.id, priorityHolds[driver.id]);
      await refreshQueueAfterControl();
    } catch (error) {
      setManualError(error instanceof Error ? error.message : 'No fue posible actualizar la incorporación del móvil.');
    } finally {
      setManualBusyId(null);
    }
  };

  const togglePriorityHold = (driver: Driver) => {
    setPriorityHolds((current) => {
      const next = { ...current };
      if (next[driver.id] != null) delete next[driver.id];
      else {
        const visibleIndex = availableDrivers.findIndex((item) => item.id === driver.id);
        if (visibleIndex < 0) return current;
        next[driver.id] = visibleIndex;
      }
      try { window.localStorage.setItem(`${PRIORITY_HOLD_KEY}:${currentCompany.id}`, JSON.stringify(next)); } catch { /* preference remains for this session */ }
      return next;
    });
  };

  const activeTrips = useMemo(() => {
    const term = search.trim().toLowerCase();
    const reservationWindow = now + RESERVATION_DISPATCH_WINDOW_MS;
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
        const aTime = tripReferenceTimeMs(a);
        const bTime = tripReferenceTimeMs(b);
        return aTime - bTime;
      });
  }, [trips, search, now]);

  const scheduledReservations = useMemo(() => trips
    .filter((trip) => Boolean(trip.scheduledFor) && !['completed', 'cancelled'].includes(trip.status))
    .sort((a, b) => new Date(a.scheduledFor as string).getTime() - new Date(b.scheduledFor as string).getTime()), [trips]);

  const selectedTrip = activeTrips.find((trip) => trip.id === selectedTripId) ?? null;
  const pendingCount = activeTrips.filter((trip) => trip.status === 'pending').length;
  const activeCount = activeTrips.filter((trip) => trip.status !== 'pending').length;

  const chooseDispatchMode = async (mode: DispatchMode) => {
    if (dispatchModeBusy) return;
    setDispatchMode(mode);
    saveOperatorDispatchMode(currentCompany.id, mode);
    setDispatchModeMessage(mode === 'manual' ? 'Despacho manual activo.' : 'Activando despacho inteligente…');
    if (mode === 'manual') return;
    const candidates = activeTrips.filter((trip) => trip.status === 'pending' && !trip.driverId);
    if (!candidates.length) {
      setDispatchModeMessage('Despacho inteligente activo para las próximas carreras.');
      return;
    }
    setDispatchModeBusy(true);
    const results = await Promise.allSettled(candidates.map((trip) => Promise.resolve(autoAssignClosestDriver(trip.id))));
    const failed = results.filter((result) => result.status === 'rejected').length;
    setDispatchModeMessage(failed
      ? `Inteligente activo · ${candidates.length - failed} enviadas · ${failed} pendientes de reintento.`
      : `Inteligente activo · ${candidates.length} carrera${candidates.length === 1 ? '' : 's'} enviada${candidates.length === 1 ? '' : 's'} automáticamente.`);
    setDispatchModeBusy(false);
  };

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

  const movePanel = (source: PanelId, target: PanelId) => {
    if (source === target) return;
    setPanelOrder((current) => {
      const next = [...current];
      const sourceIndex = next.indexOf(source);
      const targetIndex = next.indexOf(target);
      next.splice(sourceIndex, 1);
      next.splice(targetIndex, 0, source);
      return next;
    });
  };

  const resetPanelLayout = () => {
    setPanelOrder([...DEFAULT_PANEL_ORDER]);
    setPanelRatios({ ...DEFAULT_PANEL_RATIOS });
    setLayoutMenuOpen(false);
    window.setTimeout(() => window.dispatchEvent(new Event('resize')), 0);
  };

  const startResize = (boundary: 0 | 1, event: React.PointerEvent<HTMLDivElement>) => {
    if (window.innerWidth < 1280) return;
    event.preventDefault();
    const startX = event.clientX;
    const startRatios = { ...panelRatios };
    const leftPanel = panelOrder[boundary];
    const rightPanel = panelOrder[boundary + 1];
    const usableWidth = Math.max(1, (gridRef.current?.getBoundingClientRect().width ?? window.innerWidth) - 20);
    const minimumLeftRatio = MINIMUM_PANEL_WIDTH[leftPanel] / usableWidth;
    const minimumRightRatio = MINIMUM_PANEL_WIDTH[rightPanel] / usableWidth;
    const pairTotal = startRatios[leftPanel] + startRatios[rightPanel];
    if (!Number.isFinite(pairTotal) || pairTotal < minimumLeftRatio + minimumRightRatio) {
      resetPanelLayout();
      return;
    }

    const onMove = (moveEvent: PointerEvent) => {
      const deltaRatio = (moveEvent.clientX - startX) / usableWidth;
      const nextLeft = Math.max(minimumLeftRatio, Math.min(pairTotal - minimumRightRatio, startRatios[leftPanel] + deltaRatio));
      setPanelRatios((current) => ({ ...current, [leftPanel]: nextLeft, [rightPanel]: pairTotal - nextLeft }));
    };

    const stop = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', stop);
      window.removeEventListener('pointercancel', stop);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      window.dispatchEvent(new Event('resize'));
    };

    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', stop, { once: true });
    window.addEventListener('pointercancel', stop, { once: true });
  };

  const gridStyle = {
    '--cg-slot-a': `${panelRatios[panelOrder[0]]}fr`,
    '--cg-slot-b': `${panelRatios[panelOrder[1]]}fr`,
    '--cg-slot-c': `${panelRatios[panelOrder[2]]}fr`,
  } as React.CSSProperties;

  const panelColumn = (panel: PanelId) => panelOrder.indexOf(panel) * 2 + 1;

  const safeBack = () => {
    if (reservationsOpen) { setReservationsOpen(false); return; }
    if (layoutMenuOpen) { setLayoutMenuOpen(false); return; }
    if (manualMenuOpen) { setManualMenuOpen(false); return; }
    const detail = { handled: false };
    window.dispatchEvent(new CustomEvent('centralgo:hardware-back', { detail }));
  };

  return (
    <div className="space-y-3 pb-4">
      <style>{`
        .cg-panel-resizer{display:none}
        @media (min-width:1280px){
          .cg-operator-grid{grid-template-columns:minmax(0,var(--cg-slot-a)) 10px minmax(0,var(--cg-slot-b)) 10px minmax(0,var(--cg-slot-c))!important;gap:0!important}
          .cg-panel-resizer{display:flex}
          .cg-layout-panel{grid-column:var(--cg-panel-column)!important;grid-row:1!important;min-width:0}
          .cg-panel-resizer{grid-row:1!important;align-self:stretch}
        }
      `}</style>

      <section className={`relative rounded-2xl border border-zinc-800 bg-[#0d0d0f] p-3 shadow-xl shadow-black/20 ${layoutMenuOpen || reservationsOpen ? 'z-[2100]' : 'z-10'}`}>
        <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-center">
          <div className="flex min-w-0 items-center gap-2 lg:shrink-0">
            <button type="button" onClick={safeBack} className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-zinc-700 bg-zinc-950 text-zinc-300 transition hover:border-blue-400/40 hover:text-white" title="Atrás sin cerrar la sesión" aria-label="Atrás sin cerrar la sesión"><ArrowLeft className="h-4 w-4" /></button>
            <div><p className="text-[10px] font-black uppercase tracking-[.18em] text-zinc-500">Central GO</p><h1 className="text-xl font-black text-white">Despacho</h1></div>
          </div>
          <div className="-mx-1 flex max-w-full items-center gap-2 overflow-x-auto px-1 pb-1 text-xs font-black sm:mx-0 sm:overflow-visible sm:px-0 sm:pb-0">
            <span className="rounded-lg border border-amber-500/25 bg-amber-500/10 px-2.5 py-1.5 text-amber-300">{pendingCount} pendientes</span>
            <span className="rounded-lg border border-blue-500/25 bg-blue-500/10 px-2.5 py-1.5 text-blue-300">{activeCount} activas</span>
            <span className="rounded-lg border border-emerald-500/25 bg-emerald-500/10 px-2.5 py-1.5 text-emerald-300">{availableDrivers.length} libres</span>
            <div className="relative shrink-0">
              <button type="button" onClick={() => { setReservationsOpen((open) => !open); setLayoutMenuOpen(false); }} className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 transition ${reservationsOpen ? 'border-cyan-300/45 bg-cyan-500/20 text-cyan-100' : 'border-cyan-500/25 bg-cyan-500/10 text-cyan-300'}`} aria-expanded={reservationsOpen}><CalendarClock className="h-3.5 w-3.5" />{scheduledReservations.length} reservas</button>
              {reservationsOpen && <div className="fixed inset-x-3 top-20 z-[90] max-h-[70vh] overflow-hidden rounded-xl border border-cyan-400/25 bg-[#11151a] shadow-2xl shadow-black/60 sm:absolute sm:inset-x-auto sm:left-0 sm:top-[calc(100%+8px)] sm:w-[360px]">
                <div className="flex items-center justify-between border-b border-white/[0.07] px-3 py-2.5"><div><p className="text-[10px] font-black text-white">Reservas próximas</p><p className="text-[8px] font-medium text-zinc-500">Ordenadas por fecha y hora</p></div><button type="button" onClick={() => setReservationsOpen(false)} className="grid h-7 w-7 place-items-center rounded-lg text-zinc-500" aria-label="Cerrar reservas"><XCircle className="h-4 w-4" /></button></div>
                <div className="max-h-[52vh] divide-y divide-white/[0.06] overflow-y-auto">{scheduledReservations.map((trip) => <button key={trip.id} type="button" onClick={() => { setSelectedTripForDetail(trip); setReservationsOpen(false); }} className="flex w-full items-start gap-2 px-3 py-2.5 text-left transition hover:bg-cyan-400/[0.06]"><span className="rounded-lg bg-cyan-400/10 px-2 py-1 text-[9px] font-black text-cyan-200">{new Date(trip.scheduledFor as string).toLocaleString('es-CL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false })}</span><span className="min-w-0 flex-1"><strong className="block truncate text-[10px] text-white">{trip.origin.address}</strong><span className="mt-0.5 block truncate text-[8px] text-zinc-500">{trip.clientName} · {trip.driverUnitNumber ? `Móvil ${trip.driverUnitNumber}` : 'Sin móvil reservado'}</span></span></button>)}</div>
                {!scheduledReservations.length && <p className="px-4 py-8 text-center text-[10px] text-zinc-500">No hay reservas pendientes.</p>}
                <button type="button" onClick={() => { setActiveModule('reservations'); setReservationsOpen(false); }} className="w-full border-t border-white/[0.07] px-3 py-2.5 text-[9px] font-black text-cyan-300">Abrir módulo de reservas</button>
              </div>}
            </div>
          </div>
          <div className="shrink-0">
            <div role="radiogroup" aria-label="Modo de despacho" className="flex h-10 items-center rounded-xl border border-zinc-700 bg-zinc-950 p-1">
              <button type="button" role="radio" disabled={dispatchModeBusy} aria-checked={dispatchMode === 'automatic'} onClick={() => void chooseDispatchMode('automatic')} className={`flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[9px] font-black transition disabled:opacity-50 ${dispatchMode === 'automatic' ? 'bg-emerald-500 text-emerald-950' : 'text-zinc-500 hover:text-white'}`} title="Activa y envía las carreras pendientes automáticamente según ubicación, disponibilidad y prioridad">{dispatchModeBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5" />}Inteligente</button>
              <button type="button" role="radio" disabled={dispatchModeBusy} aria-checked={dispatchMode === 'manual'} onClick={() => void chooseDispatchMode('manual')} className={`flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[9px] font-black transition disabled:opacity-50 ${dispatchMode === 'manual' ? 'bg-cyan-500 text-cyan-950' : 'text-zinc-500 hover:text-white'}`} title="La operadora elige el móvil para cada carrera"><UserRound className="h-3.5 w-3.5" />Manual</button>
            </div>
            {dispatchModeMessage ? <p aria-live="polite" className="mt-1 max-w-56 text-[8px] font-bold text-emerald-300">{dispatchModeMessage}</p> : null}
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
          <div className="relative">
            <button type="button" onClick={() => { setLayoutMenuOpen((open) => !open); setReservationsOpen(false); }} className={`flex h-10 items-center justify-center gap-1.5 rounded-xl border px-3 text-[10px] font-black transition ${layoutMenuOpen ? 'border-blue-300/45 bg-blue-500/20 text-blue-100' : 'border-zinc-700 bg-zinc-950 text-zinc-400 hover:text-white'}`} aria-expanded={layoutMenuOpen}><LayoutPanelTop className="h-4 w-4" />Organizar</button>
            {layoutMenuOpen && <div className="absolute right-0 top-[calc(100%+8px)] z-[85] w-64 rounded-xl border border-blue-400/20 bg-[#11151a] p-3 shadow-2xl shadow-black/60"><p className="text-[10px] font-black text-white">Distribución de paneles</p><p className="mt-1 text-[8px] leading-relaxed text-zinc-500">Los cuadros se reparan automáticamente si dejan de caber en la pantalla.</p><div className="mt-2 space-y-1.5">{[
              { label: 'Mapa · Carreras · Móviles', order: ['map', 'trips', 'mobiles'] as PanelId[] },
              { label: 'Móviles · Carreras · Mapa', order: ['mobiles', 'trips', 'map'] as PanelId[] },
              { label: 'Carreras · Mapa · Móviles', order: ['trips', 'map', 'mobiles'] as PanelId[] },
            ].map((preset) => <button key={preset.label} type="button" onClick={() => { setPanelOrder(preset.order); setPanelRatios({ ...DEFAULT_PANEL_RATIOS }); setLayoutMenuOpen(false); window.setTimeout(() => window.dispatchEvent(new Event('resize')), 0); }} className="flex w-full items-center justify-between rounded-lg border border-white/[0.06] bg-white/[0.025] px-2.5 py-2 text-left text-[9px] font-bold text-zinc-300 hover:border-blue-400/25">{preset.label}{panelOrder.join(',') === preset.order.join(',') ? <Check className="h-3.5 w-3.5 text-emerald-300" /> : null}</button>)}</div><button type="button" onClick={resetPanelLayout} className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg border border-emerald-500/25 bg-emerald-500/10 px-2 py-2 text-[8px] font-black text-emerald-200"><RotateCcw className="h-3.5 w-3.5" />Ajustar automáticamente</button></div>}
          </div>
        </div>
      </section>

      <section ref={gridRef} style={gridStyle} className="cg-operator-grid grid items-start gap-3 lg:grid-cols-[240px_minmax(0,1fr)]">
        <aside
          style={{ '--cg-panel-column': panelColumn('mobiles') } as React.CSSProperties}
          onDragOver={(event) => { if (dragPanelId) event.preventDefault(); }}
          onDrop={(event) => { event.preventDefault(); if (dragPanelId) movePanel(dragPanelId, 'mobiles'); setDragPanelId(null); }}
          className={`cg-layout-panel overflow-visible rounded-2xl border border-zinc-800 bg-[var(--cg-surface-solid)] shadow-xl shadow-black/20 lg:sticky lg:top-2 ${manualMenuOpen ? 'z-[2200]' : ''}`}
        >
          <div
            draggable
            onDragStart={(event) => { event.dataTransfer.effectAllowed = 'move'; setDragPanelId('mobiles'); }}
            onDragEnd={() => setDragPanelId(null)}
            className={`relative rounded-t-2xl border-b border-zinc-800 bg-[var(--cg-surface-solid)] px-3 py-3 ${manualMenuOpen ? 'z-[2250]' : ''}`}
            title="Arrastra para mover el cuadro de móviles"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <h2 className="text-sm font-black text-white">Móviles en fila</h2>
                <p className="mt-0.5 truncate text-[10px] text-zinc-500">Pausa mantiene lugar · desconectados al final</p>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => { setManualMenuOpen((open) => !open); setLayoutMenuOpen(false); setReservationsOpen(false); setManualSearch(''); setManualError(''); }}
                  className={`grid h-8 w-8 place-items-center rounded-lg border transition ${manualMenuOpen ? 'border-amber-400/35 bg-amber-400/10 text-amber-200' : 'border-zinc-800 bg-zinc-950 text-zinc-400 hover:border-amber-400/25 hover:text-amber-200'}`}
                  title="Gestionar móviles por radio"
                  aria-label="Gestionar móviles por radio"
                  aria-expanded={manualMenuOpen}
                >
                  <UserPlus className="h-3.5 w-3.5" />
                </button>
                <span className="rounded-lg bg-emerald-500/10 px-2 py-1 text-xs font-black text-emerald-300">{queueDrivers.length}</span>
              </div>
            </div>

            {manualMenuOpen && (
              <div className="fixed inset-x-3 top-24 z-[2300] rounded-xl border border-amber-400/25 bg-[#11151a] p-3 shadow-2xl shadow-black/60 sm:absolute sm:inset-x-auto sm:left-0 sm:top-[58px] sm:w-[280px]">
                <div className="flex items-start justify-between gap-2"><div><p className="text-[10px] font-black text-white">Incorporar móvil</p><p className="mt-0.5 text-[8px] text-zinc-500">Escribe el número y presiona Agregar.</p></div><button type="button" onClick={() => setManualMenuOpen(false)} className="grid h-7 w-7 place-items-center rounded-lg text-zinc-500" aria-label="Cerrar incorporación"><ChevronUp className="h-3.5 w-3.5" /></button></div>
                <form onSubmit={submitQuickManualDriver} className="mt-3 flex items-center gap-2">
                  <input value={manualSearch} onChange={(event) => { setManualSearch(event.target.value.replace(/[^0-9A-Za-z-]/g, '')); setManualError(''); }} inputMode="numeric" autoComplete="off" autoFocus placeholder="N° móvil" className="h-10 min-w-0 flex-1 rounded-xl border border-zinc-700 bg-zinc-950 px-3 text-center text-sm font-black text-white outline-none focus:border-amber-400/60" aria-label="Número de móvil a incorporar" />
                  <button type="submit" disabled={Boolean(manualBusyId)} className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-emerald-400 px-3 text-[9px] font-black text-emerald-950 disabled:opacity-40">{manualBusyId ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}Agregar</button>
                </form>
                {quickManualMatch && <p className="mt-2 flex items-center gap-1.5 rounded-lg border border-emerald-400/15 bg-emerald-400/[0.06] px-2 py-1.5 text-[8px] font-bold text-emerald-200"><Check className="h-3 w-3" />Móvil {quickManualMatch.unitNumber} · {quickManualMatch.name}</p>}
                {manualError && <p className="mt-2 rounded-lg border border-rose-400/20 bg-rose-400/[0.07] px-2 py-1.5 text-[8px] font-bold text-rose-200">{manualError}</p>}
              </div>
            )}
          </div>
          <div className="max-h-[500px] divide-y divide-zinc-800/80 overflow-y-auto overflow-x-hidden rounded-b-2xl">
            {queueDrivers.length === 0 ? (
              <p className="px-4 py-10 text-center text-xs text-zinc-500">No hay móviles conectados. Usa + para incorporar uno por radio.</p>
            ) : queueDrivers.map((driver: Driver, index) => {
              const focused = focusDriverId === driver.id;
              const inTrip = activeTripDriverIds.has(driver.id);
              const queueItem = queueItemByDriverId.get(driver.id);
              const paused = !inTrip && queueItem?.status === 'paused';
              const disconnected = !inTrip && Boolean(queueItem) && (queueItem?.status === 'offline'
                || (queueItem?.operationMode === 'app' && queueItem?.status === 'available' && !isQueueConnected(queueItem)));
              const rowLocked = inTrip || paused || disconnected;
              const powerLocked = inTrip || paused;
              const waitingIndex = availableDrivers.findIndex((item) => item.id === driver.id);
              const dragging = dragDriverId === driver.id;
              const vehicle = driver.vehicleId ? vehicleById.get(driver.vehicleId) : undefined;
              return (
                <div
                  key={driver.id}
                  role="button"
                  tabIndex={0}
                  draggable={!rowLocked}
                  onDragStart={(event) => {
                    if (rowLocked) { event.preventDefault(); return; }
                    event.dataTransfer.effectAllowed = 'move';
                    event.dataTransfer.setData(DRIVER_MIME, driver.id);
                    event.dataTransfer.setData('text/plain', driver.id);
                    setDragDriverId(driver.id);
                  }}
                  onDragEnd={() => { setDragDriverId(null); setDragOverTripId(null); }}
                  onClick={() => setFocusDriverId(focused ? null : driver.id)}
                  onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setFocusDriverId(focused ? null : driver.id); } }}
                  className={`group relative flex w-full items-center gap-2 px-3 py-2 text-left transition ${disconnected ? 'cursor-default border-l-2 border-rose-400/70 bg-rose-500/[0.16]' : paused ? 'cursor-default border-l-2 border-amber-300/70 bg-amber-500/[0.16]' : inTrip ? 'cursor-default border-l-2 border-amber-300/60 bg-amber-500/[0.14]' : 'cursor-grab active:cursor-grabbing'} ${dragging ? 'opacity-45' : ''} ${focused ? (disconnected ? 'bg-rose-500/[0.22]' : (paused || inTrip) ? 'bg-amber-500/[0.22]' : 'bg-emerald-500/[0.10]') : (disconnected ? 'hover:bg-rose-500/[0.20]' : (paused || inTrip) ? 'hover:bg-amber-500/[0.20]' : 'hover:bg-zinc-900/70')}`}
                  title={disconnected ? `${driver.name} · DESCONECTADO · permanece visible en rojo al final de la fila.` : paused ? `${driver.name} · PAUSA · conserva su posición en la fila.` : inTrip ? `${driver.name} · EN CARRERA · permanece visible al final de la fila.` : `${driver.name} · ${driver.currentLocation.address || DRIVER_STATUS_LABELS[driver.status]}. Puedes arrastrar este móvil sobre una carrera pendiente.`}
                >
                  <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-md border text-[10px] font-black ${disconnected ? 'border-rose-300/55 bg-rose-400/20 text-rose-100' : (paused || inTrip) ? 'border-amber-300/45 bg-amber-400/15 text-amber-200' : 'border-emerald-400/25 bg-emerald-500/10 text-emerald-300'}`} title={disconnected ? 'Desconectado · al final de la fila' : paused ? `Pausa · conserva la posición ${index + 1}` : inTrip ? 'En carrera · al final de la fila' : `Posición ${waitingIndex + 1} en la fila`}>{index + 1}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-lg font-black leading-none text-white">{driver.unitNumber}</span>
                  </span>
                  <span className="flex shrink-0 items-center gap-1" onClick={(event) => event.stopPropagation()}>
                    <button type="button" disabled={Boolean(manualBusyId) || rowLocked || waitingIndex < 0 || waitingIndex === availableDrivers.length - 1} onClick={() => void moveDriverInQueue(driver, 'down')} className="grid h-8 w-8 place-items-center rounded-lg border border-zinc-700 bg-zinc-900 text-zinc-300 transition hover:border-blue-400/40 hover:text-blue-200 disabled:opacity-25" title="Bajar un lugar en la fila" aria-label={`Bajar el móvil ${driver.unitNumber} en la fila`}><ArrowDown className="h-3.5 w-3.5" /></button>
                    <button
                      type="button"
                      disabled={Boolean(manualBusyId) || powerLocked}
                      onClick={() => void toggleQueueIncorporation(driver)}
                      className="grid h-8 w-8 place-items-center rounded-lg border border-emerald-400/35 bg-emerald-500/15 text-emerald-200 transition hover:bg-emerald-500 hover:text-emerald-950 disabled:opacity-40"
                      title={disconnected ? 'Conectar este móvil manualmente' : 'Desconectar este móvil manualmente'}
                      aria-label={`${disconnected ? 'Conectar' : 'Desconectar'} el móvil ${driver.unitNumber} manualmente`}
                    >
                      {manualBusyId === driver.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Power className="h-3.5 w-3.5" />}
                    </button>
                    <button
                      type="button"
                      disabled={rowLocked}
                      aria-pressed={priorityHolds[driver.id] != null}
                      onClick={() => togglePriorityHold(driver)}
                      className={`grid h-8 w-8 place-items-center rounded-lg border transition disabled:opacity-30 ${priorityHolds[driver.id] != null ? 'border-amber-300/50 bg-amber-400 text-zinc-950' : 'border-zinc-700 bg-zinc-900 text-zinc-400 hover:border-amber-400/40 hover:text-amber-200'}`}
                      title={priorityHolds[driver.id] != null ? 'Prioridad fija: al reincorporar vuelve a este lugar de la fila' : 'Mantener esta posición de prioridad al reincorporar'}
                      aria-label={`Mantener la posición de prioridad del móvil ${driver.unitNumber}`}
                    >
                      <Pin className="h-3.5 w-3.5" />
                    </button>
                  </span>
                  <GripVertical className={`h-4 w-4 shrink-0 ${disconnected ? 'text-rose-400/35' : (paused || inTrip) ? 'text-amber-400/30' : 'text-zinc-700'}`} />
                  <span role="tooltip" className={`pointer-events-none absolute right-[calc(100%+8px)] top-1/2 z-50 hidden w-56 -translate-y-1/2 rounded-xl border bg-zinc-950 p-3 text-left shadow-2xl shadow-black/60 group-hover:block group-focus-visible:block ${disconnected ? 'border-rose-400/35' : (paused || inTrip) ? 'border-amber-400/30' : 'border-emerald-400/25'}`}>
                    <span className="flex items-center justify-between gap-2"><strong className="truncate text-xs text-white">{driver.name}</strong><b className={`rounded px-1.5 py-0.5 text-[8px] ${disconnected ? 'bg-rose-500/15 text-rose-200' : (paused || inTrip) ? 'bg-amber-500/15 text-amber-200' : 'bg-emerald-500/15 text-emerald-300'}`}>Móvil {driver.unitNumber}</b></span>
                    <span className="mt-1 block truncate text-[9px] text-zinc-400">{driver.phone || 'Sin teléfono registrado'}</span>
                    <span className="mt-1 block truncate text-[9px] text-zinc-500">{vehicle?.licensePlate ? `Patente ${vehicle.licensePlate} · ` : ''}{driver.currentLocation.address || 'Ubicación sin dirección'}</span>
                    <span className={`mt-2 block border-t border-zinc-800 pt-2 text-[9px] font-black ${disconnected ? 'text-rose-300' : (paused || inTrip) ? 'text-amber-300' : 'text-emerald-300'}`}>● {disconnected ? 'DESCONECTADO' : paused ? 'PAUSA' : inTrip ? 'EN CARRERA' : DRIVER_STATUS_LABELS[driver.status]}</span>
                  </span>
                </div>
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
            <span>En fila {queueDrivers.length} · Libres {availableDrivers.length}</span>
            <span>Sin app {noAppDriverCount}</span>
          </div>
        </aside>

        <div style={{ gridColumn: 2 }} className="cg-panel-resizer min-h-[540px] touch-none cursor-col-resize items-center justify-center rounded-lg bg-blue-500/[0.025] text-zinc-600 transition hover:bg-blue-500/15 hover:text-blue-300" onPointerDown={(event) => startResize(0, event)} title="Arrastra para redimensionar los cuadros">
          <GripVertical className="h-5 w-5" />
        </div>

        <div
          style={{ '--cg-panel-column': panelColumn('trips') } as React.CSSProperties}
          onDragOver={(event) => { if (dragPanelId) event.preventDefault(); }}
          onDrop={(event) => { event.preventDefault(); if (dragPanelId) movePanel(dragPanelId, 'trips'); setDragPanelId(null); }}
          className="cg-layout-panel min-w-0 overflow-hidden rounded-2xl border border-zinc-800 bg-[#0d0d0f] shadow-xl shadow-black/20"
        >
          <div draggable onDragStart={(event) => { event.dataTransfer.effectAllowed = 'move'; setDragPanelId('trips'); }} onDragEnd={() => setDragPanelId(null)} className="cursor-move border-b border-zinc-800 px-3 py-2.5" title="Arrastra para mover el cuadro de carreras">
            <h2 className="text-sm font-black text-white">Carreras en curso</h2>
            <p className="mt-0.5 truncate text-[10px] text-zinc-500" title="Pendientes, asignadas y activas. Las reservas aparecen aquí 20 minutos antes.">Pendientes, asignadas y activas · reservas 20 min antes</p>
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
                    className={`px-2.5 py-2 transition ${dropReady ? 'bg-emerald-500/[0.12] ring-2 ring-inset ring-emerald-400/55' : isSelected ? 'bg-blue-500/[0.07]' : 'hover:bg-zinc-900/60'}`}
                  >
                    {dropReady && <div className="mb-1.5 rounded-lg border border-emerald-400/25 bg-emerald-400/10 px-2 py-1 text-center text-[9px] font-black text-emerald-200">Suelta aquí para asignar el móvil</div>}
                    <div className="min-w-0">
                      <div className="flex items-center justify-between gap-1.5">
                        <span className={`rounded-md border px-1.5 py-0.5 text-[9px] font-black ${statusTone[trip.status]}`}>{TRIP_STATUS_LABELS[trip.status]}</span>
                        {trip.scheduledFor && <span className="rounded-md border border-sky-500/25 bg-sky-500/10 px-1.5 py-0.5 text-[8px] font-black text-sky-300">RESERVA · {formatTime(trip.scheduledFor)}</span>}
                        <span className={`ml-auto rounded-md border px-1.5 py-0.5 text-[9px] font-black tabular-nums ${tripEntryTone(trip, now)}`} title={trip.scheduledFor ? `Reserva para las ${formatTime(trip.scheduledFor)}` : `Ingresó a las ${formatTime(trip.createdAt)}`}>
                          {formatTime(trip.scheduledFor ?? trip.createdAt)}{trip.status === 'pending' ? ` · ${tripTimingLabel(trip, now)}` : ''}
                        </span>
                      </div>
                      <p className="mt-1.5 flex min-w-0 items-start gap-1 text-xs text-white" title={trip.origin.address}>
                        <MapPin className="mt-px h-3.5 w-3.5 shrink-0 text-amber-300" />
                        <strong className="min-w-0 truncate">{trip.origin.address}</strong>
                      </p>
                      <p className="mt-1 flex min-w-0 items-center gap-1 text-[10px] font-bold text-zinc-200" title={[trip.clientName, trip.clientPhone, trip.paymentMethod === 'transferencia' ? 'Transferencia' : ''].filter(Boolean).join(' · ')}>
                        <UserRound className="h-3 w-3 shrink-0 text-cyan-300" />
                        <span className="min-w-0 truncate">{trip.clientName}{trip.clientPhone && trip.clientPhone !== 'Sin teléfono' ? ` · ${trip.clientPhone}` : ''}</span>
                        {trip.paymentMethod === 'transferencia' && <span className="shrink-0 rounded-md border border-cyan-400/30 bg-cyan-400/10 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wide text-cyan-200">Transferencia</span>}
                      </p>
                      <p className="mt-0.5 flex min-w-0 items-start gap-1 text-[10px] text-zinc-500" title={trip.destination.address}>
                        <Navigation className="mt-px h-3 w-3 shrink-0 text-sky-400" />
                        <span className="min-w-0 truncate">{trip.destination.address}</span>
                      </p>
                      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                        {trip.driverUnitNumber && <p className="flex items-center gap-1 text-[10px] font-black text-blue-300"><Car className="h-3 w-3" />{trip.driverUnitNumber}</p>}
                      </div>
                    </div>

                    <div className="mt-2 flex max-w-full flex-wrap items-center gap-1.5 sm:gap-1" onClick={(event) => event.stopPropagation()}>
                      {trip.status === 'pending' && (
                        <>
                          <div className="relative w-[96px] max-w-full shrink-0">
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
                              className="h-11 w-full rounded-lg border border-zinc-600 bg-zinc-950 px-2 text-center text-xs font-black text-zinc-100 outline-none transition placeholder:text-zinc-600 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 sm:h-9"
                              aria-label={`Número de móvil para asignar la carrera de ${trip.origin.address}`}
                            />
                          </div>
                          <button type="button" data-operator-action disabled={!driverChoice[trip.id] || isBusy} onClick={() => { const id = driverChoice[trip.id]; if (id) assignDriverToTrip(trip, id); }} className="grid h-11 w-11 touch-manipulation place-items-center rounded-lg border border-blue-300/60 bg-blue-600 text-white shadow-lg shadow-blue-950/40 transition hover:bg-blue-500 disabled:opacity-40 sm:h-9 sm:w-9" title="Asignar" aria-label={`Asignar móvil escrito a ${trip.code}`}><Zap className="h-3.5 w-3.5" /></button>
                          <button type="button" data-operator-action disabled={!availableDrivers.length || isBusy} onClick={() => handleAutoAssign(trip)} className="grid h-11 w-11 touch-manipulation place-items-center rounded-lg border border-violet-300/50 bg-violet-600 text-white shadow-lg shadow-violet-950/35 transition hover:bg-violet-500 disabled:opacity-40 sm:h-9 sm:w-9" title="Autoasignar al móvil más cercano" aria-label={`Autoasignar ${trip.code}`}><Wand2 className="h-3.5 w-3.5" /></button>
                        </>
                      )}

                      {next && <button type="button" data-operator-action disabled={isBusy} onClick={() => void runTripAction(trip.id, () => updateTripStatus(trip.id, next.status))} className="h-11 touch-manipulation rounded-lg border border-emerald-400/30 bg-emerald-600 px-2.5 text-[11px] font-black text-white disabled:opacity-40 sm:h-8">{next.label}</button>}
                      {trip.status === 'assigned' && <button type="button" data-operator-action disabled={isBusy} onClick={() => void runTripAction(trip.id, () => unassignTrip(trip.id))} className="h-11 touch-manipulation rounded-lg border border-zinc-600 bg-zinc-800 px-2 text-[11px] font-black text-zinc-200 disabled:opacity-40 sm:h-8">Liberar</button>}
                      {trip.status === 'in_progress' && <button type="button" data-operator-action onClick={() => setSelectedTripForDetail(trip)} className="h-11 touch-manipulation rounded-lg border border-emerald-400/30 bg-emerald-600 px-2.5 text-[11px] font-black text-white sm:h-8">Finalizar</button>}
                      {trip.clientPhone && trip.clientPhone !== 'Sin teléfono' && <a data-operator-action href={`tel:${trip.clientPhone}`} onClick={(event) => event.stopPropagation()} className="grid h-11 w-11 touch-manipulation place-items-center rounded-lg border border-emerald-300/50 bg-emerald-600 text-white shadow-lg shadow-emerald-950/30 transition hover:bg-emerald-500 sm:h-9 sm:w-9" title="Llamar al cliente" aria-label={`Llamar a ${trip.clientName}`}><PhoneCall className="h-3.5 w-3.5" /></a>}
                      <button type="button" data-operator-action onClick={() => editTrip(trip)} className="grid h-11 w-11 touch-manipulation place-items-center rounded-lg border border-cyan-300/50 bg-cyan-600 text-white shadow-lg shadow-cyan-950/30 transition hover:bg-cyan-500 sm:h-9 sm:w-9" title="Editar carrera" aria-label={`Editar ${trip.code}`}><Pencil className="h-3.5 w-3.5" /></button>
                      <button type="button" data-operator-action onClick={() => setSelectedTripForDetail(trip)} className="grid h-11 w-11 touch-manipulation place-items-center rounded-lg border border-zinc-500 bg-zinc-700 text-white shadow-lg shadow-black/25 transition hover:bg-zinc-600 sm:h-9 sm:w-9" title="Ver detalle" aria-label={`Ver detalle de ${trip.code}`}><Eye className="h-3.5 w-3.5" /></button>
                      <button type="button" data-operator-action disabled={isBusy} onClick={() => handleCancel(trip)} className="grid h-11 w-11 touch-manipulation place-items-center rounded-lg border border-rose-300/55 bg-rose-600 text-white shadow-lg shadow-rose-950/30 transition hover:bg-rose-500 disabled:opacity-40 sm:h-9 sm:w-9" title="Cancelar carrera" aria-label={`Cancelar ${trip.code}`}><Trash2 className="h-3.5 w-3.5" /></button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>

        <div style={{ gridColumn: 4 }} className="cg-panel-resizer min-h-[540px] touch-none cursor-col-resize items-center justify-center rounded-lg bg-blue-500/[0.025] text-zinc-600 transition hover:bg-blue-500/15 hover:text-blue-300" onPointerDown={(event) => startResize(1, event)} title="Arrastra para redimensionar los cuadros">
          <GripVertical className="h-5 w-5" />
        </div>

        <aside
          style={{ '--cg-panel-column': panelColumn('map') } as React.CSSProperties}
          onDragOver={(event) => { if (dragPanelId) event.preventDefault(); }}
          onDrop={(event) => { event.preventDefault(); if (dragPanelId) movePanel(dragPanelId, 'map'); setDragPanelId(null); }}
          className="cg-layout-panel cg-map-panel overflow-hidden rounded-2xl border border-zinc-800 bg-[#0d0d0f] shadow-xl shadow-black/20 lg:col-span-2 xl:col-span-1 xl:sticky xl:top-2"
        >
          <div draggable onDragStart={(event) => { event.dataTransfer.effectAllowed = 'move'; setDragPanelId('map'); }} onDragEnd={() => setDragPanelId(null)} className="flex cursor-move items-center justify-between gap-2 border-b border-zinc-800 px-3 py-3" title="Arrastra para mover el mapa">
            <div className="min-w-0 flex-1">
              <h2 className="text-sm font-black text-white">Mapa</h2>
              <p className="mt-0.5 truncate text-[10px] text-zinc-500">Referencia visual de móviles y carrera seleccionada</p>
            </div>
            {selectedTrip && <span className="hidden max-w-[120px] truncate text-[9px] font-black text-blue-300 sm:block">{selectedTrip.code}</span>}
          </div>
          <LiveMap height="h-[410px]" selectedTrip={selectedTrip} focusDriverId={focusDriverId} onSelectDriver={(driver) => setFocusDriverId(driver?.id ?? null)} />
        </aside>
      </section>
    </div>
  );
};


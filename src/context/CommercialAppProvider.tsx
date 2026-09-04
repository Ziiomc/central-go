import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AppContext, type AppContextType } from './AppContext';
import { useAuth } from './AuthContext';
import type {
  AppNotification,
  AuditLog,
  Client,
  Company,
  Driver,
  DriverStatus,
  FareConfig,
  Operator,
  PaymentMethod,
  Trip,
  TripStatus,
  User,
  Vehicle,
} from '../types';
import { DEFAULT_FARE_CONFIG, ZONES } from '../data/mockData';
import { soundManager } from '../lib/audio';
import { playSOSSiren, speakVHFDispatch } from '../lib/audioService';
import { autoDispatchTripAtomic } from '../lib/smartDispatch';
import {
  assignCompanyUserByEmail,
  assignTripAtomic,
  cancelTripAtomic,
  completeTripAtomic,
  insertClient,
  insertDriver,
  insertNotification,
  insertTrip,
  insertVehicle,
  loadCommercialSnapshot,
  loadDriverVisibleTrips,
  loadTripById,
  mapDriverRow,
  markAllNotificationsRead,
  markNotificationRead,
  reportDriverLocation,
  rejectDriverTripAtomic,
  resolveDriverSos,
  resolveOwnDriverSos,
  saveFareConfig,
  setDriverManualStatus,
  setDriverStatusAsOperator,
  setTripStatusAtomic,
  settleDriverAtomic,
  subscribeCompanyRealtime,
  triggerDriverSos,
  unassignTripAtomic,
  updateVehicleRecord,
  writeAudit,
} from '../lib/commercialRepository';

const NETWORK_COMPANY: Company = {
  id: 'network',
  name: 'Central GO Network',
  code: 'GLOBAL',
  phone: '',
  address: '',
  totalVehicles: 0,
  totalDrivers: 0,
  active: true,
};

const upsertById = <T extends { id: string }>(items: T[], item: T) => {
  const index = items.findIndex((existing) => existing.id === item.id);
  if (index < 0) return [item, ...items];
  const next = [...items];
  next[index] = item;
  return next;
};

const upsertTrip = (items: Trip[], trip: Trip) => {
  const index = items.findIndex((existing) => existing.id === trip.id
    || Boolean(trip.operatorRequestId && existing.operatorRequestId === trip.operatorRequestId));
  if (index < 0) return [trip, ...items];
  const next = [...items];
  next[index] = trip;
  return next;
};

type OptimisticTripRequest = {
  tempId: string;
  state: 'pending' | 'resolved' | 'rejected';
  promise: Promise<string>;
  resolve: (tripId: string) => void;
  reject: (error: Error) => void;
};

const snapshotKey=(companyId:string)=>`centralgo:operational-snapshot:v1:${companyId}`;
const SNAPSHOT_TTL_MS=12*60*60*1000;
type CachedSnapshot={savedAt:number;companyId:string;vehicles:Vehicle[];drivers:Driver[];clients:Client[];trips:Trip[];notifications:AppNotification[];auditLogs:AuditLog[];fareConfig:FareConfig};
const readCachedSnapshot=(companyId:string):CachedSnapshot|undefined=>{try{const key=snapshotKey(companyId);const raw=localStorage.getItem(key);if(!raw)return;const value=JSON.parse(raw) as CachedSnapshot;if(value.companyId!==companyId||Date.now()-value.savedAt>SNAPSHOT_TTL_MS){localStorage.removeItem(key);return;}return value;}catch{return undefined;}};

export const CommercialAppProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const { authUser, profile, memberships, companies: authorizedCompanies, effectiveRole } = useAuth();
  const [currentCompany, setCurrentCompany] = useState<Company>(authorizedCompanies[0] ?? NETWORK_COMPANY);
  const initialCache=useMemo(()=>readCachedSnapshot(authorizedCompanies[0]?.id??'network'),[]);
  const [vehicles, setVehicles] = useState<Vehicle[]>(()=>initialCache?.vehicles??[]);
  const [drivers, setDrivers] = useState<Driver[]>(()=>initialCache?.drivers??[]);
  const [clients, setClients] = useState<Client[]>(()=>initialCache?.clients??[]);
  const [trips, setTrips] = useState<Trip[]>(()=>initialCache?.trips??[]);
  const [notifications, setNotifications] = useState<AppNotification[]>(()=>initialCache?.notifications??[]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>(()=>initialCache?.auditLogs??[]);
  const [fareConfig, setFareConfig] = useState<FareConfig>(()=>initialCache?.fareConfig??DEFAULT_FARE_CONFIG);
  const [soundMuted, setSoundMuted] = useState(() => soundManager.isMuted());
  const [activeModule, setActiveModule] = useState('dashboard');
  const [selectedTripForDetail, setSelectedTripForDetail] = useState<Trip | null>(null);
  const [newTripModalOpen, setNewTripModalOpen] = useState(false);
  const [activeSOSDriver, setActiveSOSDriver] = useState<Driver | null>(null);
  const [vhfModalDriver, setVHFModalDriver] = useState<Driver | null>(null);
  const [isMobileDevice, setIsMobileDevice] = useState(false);
  const [loadingData, setLoadingData] = useState(false);
  const [operationError, setOperationError] = useState<string | null>(null);
  const optimisticTripRequestsRef = useRef<Map<string, OptimisticTripRequest>>(new Map());

  const currentRole = effectiveRole ?? 'operator';

  const resolveOptimisticTripRequest = (requestId: string | undefined, tripId: string) => {
    if (!requestId) return;
    const entry = optimisticTripRequestsRef.current.get(requestId);
    if (!entry || entry.state !== 'pending') return;
    entry.state = 'resolved';
    entry.resolve(tripId);
    window.setTimeout(() => {
      if (optimisticTripRequestsRef.current.get(requestId) === entry) optimisticTripRequestsRef.current.delete(requestId);
    }, 30000);
  };

  const rejectOptimisticTripRequest = (requestId: string | undefined, error: unknown) => {
    if (!requestId) return;
    const entry = optimisticTripRequestsRef.current.get(requestId);
    if (!entry || entry.state !== 'pending') return;
    entry.state = 'rejected';
    entry.reject(error instanceof Error ? error : new Error('No fue posible confirmar la carrera.'));
    window.setTimeout(() => {
      if (optimisticTripRequestsRef.current.get(requestId) === entry) optimisticTripRequestsRef.current.delete(requestId);
    }, 30000);
  };

  const resolveOperationalTripId = async (tripId: string) => {
    if (!tripId.startsWith('optimistic-')) return tripId;
    const requestId = tripId.slice('optimistic-'.length);
    const entry = optimisticTripRequestsRef.current.get(requestId);
    if (!entry) throw new Error('La carrera todavía se está sincronizando. Intenta nuevamente en un instante.');
    return entry.promise;
  };

  useEffect(() => {
    if (!authorizedCompanies.length) {
      setCurrentCompany(NETWORK_COMPANY);
      return;
    }
    const refreshed=authorizedCompanies.find((company) => company.id === currentCompany.id);
    if (!refreshed) setCurrentCompany(authorizedCompanies[0]);
    else if (refreshed !== currentCompany) setCurrentCompany(refreshed);
  }, [authorizedCompanies, currentCompany.id]);

  useEffect(() => {
    const handleResize = () => setIsMobileDevice(window.innerWidth < 768);
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const currentUser = useMemo<User>(() => ({
    id: authUser?.id ?? '',
    companyId: currentCompany.id,
    name: profile?.name ?? authUser?.email?.split('@')[0] ?? 'Usuario Central GO',
    email: authUser?.email ?? '',
    phone: profile?.phone ?? '',
    role: currentRole,
    avatarUrl: profile?.avatarUrl ?? undefined,
    active: profile?.active ?? true,
    createdAt: authUser?.created_at ?? new Date().toISOString(),
  }), [authUser, currentCompany.id, currentRole, profile]);

  const operators = useMemo<Operator[]>(() => {
    if (!authUser || !['operator', 'company_admin'].includes(currentRole)) return [];
    return [{
      id: `op-${authUser.id}`,
      userId: authUser.id,
      companyId: currentCompany.id,
      name: currentUser.name,
      shift: 'Mañana',
      dispatchesToday: trips.filter((trip) => trip.operatorId === authUser.id).length,
      avgDispatchTimeSeconds: 0,
      status: 'active',
    }];
  }, [authUser, currentCompany.id, currentRole, currentUser.name, trips]);

  const reportError = (error: unknown, fallback: string) => {
    console.error('[Central GO Commercial]', error);
    const message = error instanceof Error ? error.message : fallback;
    setOperationError(message);
    window.setTimeout(() => setOperationError((current) => current === message ? null : current), 7000);
  };

  const hydrate = async () => {
    if (!authUser || currentCompany.id === 'network') return;
    setLoadingData(true);
    setOperationError(null);
    try {
      const snapshot = await loadCommercialSnapshot(currentCompany.id, currentRole === 'super_admin');
      setVehicles(snapshot.vehicles);
      setDrivers(snapshot.drivers);
      setClients(snapshot.clients);
      setTrips((current) => {
        const persistedRequestIds = new Set(snapshot.trips.map((trip) => trip.operatorRequestId).filter(Boolean));
        const optimistic = current.filter((trip) => trip.id.startsWith('optimistic-')
          && (!trip.operatorRequestId || !persistedRequestIds.has(trip.operatorRequestId)));
        return [...optimistic, ...snapshot.trips];
      });
      setNotifications(snapshot.notifications);
      setAuditLogs(snapshot.auditLogs);
      setFareConfig(snapshot.fareConfig ?? DEFAULT_FARE_CONFIG);
      setActiveSOSDriver(snapshot.drivers.find((driver) => driver.sosActive) ?? null);
    } catch (error) {
      reportError(error, 'No fue posible sincronizar los datos de la central.');
    } finally {
      setLoadingData(false);
    }
  };

  useEffect(()=>{
    if(currentCompany.id==='network')return;
    try{
      const cached=readCachedSnapshot(currentCompany.id);if(!cached)return;
      setVehicles(cached.vehicles||[]);setDrivers(cached.drivers||[]);setClients(cached.clients||[]);setTrips(cached.trips||[]);setNotifications(cached.notifications||[]);setAuditLogs(cached.auditLogs||[]);setFareConfig(cached.fareConfig||DEFAULT_FARE_CONFIG);
      setActiveSOSDriver((cached.drivers||[]).find(driver=>driver.sosActive)??null);
    }catch{}
  },[currentCompany.id]);

  useEffect(()=>{
    if(currentCompany.id==='network'||!authUser)return;
    const timer=window.setTimeout(()=>{
      try{localStorage.setItem(snapshotKey(currentCompany.id),JSON.stringify({savedAt:Date.now(),companyId:currentCompany.id,vehicles,drivers,clients,trips:trips.filter((trip)=>!trip.id.startsWith('optimistic-')).slice(0,750),notifications:notifications.slice(0,300),auditLogs:auditLogs.slice(0,300),fareConfig} satisfies CachedSnapshot));}catch{}
    },350);
    return()=>window.clearTimeout(timer);
  },[authUser?.id,currentCompany.id,vehicles,drivers,clients,trips,notifications,auditLogs,fareConfig]);

  useEffect(() => {
    void hydrate();
  }, [authUser?.id, currentCompany.id, currentRole]);

  useEffect(()=>{
    const resync=()=>{if(navigator.onLine)void hydrate();};
    window.addEventListener('centralgo:driver-resync',resync);
    window.addEventListener('online',resync);
    return()=>{window.removeEventListener('centralgo:driver-resync',resync);window.removeEventListener('online',resync);};
  },[authUser?.id,currentCompany.id,currentRole]);

  useEffect(() => {
    const stage = (event: Event) => {
      const trip = (event as CustomEvent<Trip>).detail;
      const requestId = trip?.operatorRequestId;
      if (!trip || !requestId || trip.companyId !== currentCompany.id || !trip.id.startsWith('optimistic-')) return;
      if (!optimisticTripRequestsRef.current.has(requestId)) {
        let resolve!: (tripId: string) => void;
        let reject!: (error: Error) => void;
        const promise = new Promise<string>((res, rej) => { resolve = res; reject = rej; });
        void promise.catch(() => undefined);
        optimisticTripRequestsRef.current.set(requestId, { tempId: trip.id, state: 'pending', promise, resolve, reject });
      }
      setTrips((items) => upsertTrip(items, trip));
    };
    const settle = (event: Event) => {
      const detail = (event as CustomEvent<{ companyId?: string; requestId?: string }>).detail;
      if (!detail?.requestId || detail.companyId !== currentCompany.id) return;
      const entry = optimisticTripRequestsRef.current.get(detail.requestId);
      if (entry?.state === 'pending') rejectOptimisticTripRequest(detail.requestId, new Error('No fue posible confirmar la carrera.'));
      setTrips((items) => items.filter((trip) => !(trip.id.startsWith('optimistic-') && trip.operatorRequestId === detail.requestId)));
    };
    window.addEventListener('centralgo:trip-optimistic', stage);
    window.addEventListener('centralgo:trip-optimistic-settled', settle);
    return () => {
      window.removeEventListener('centralgo:trip-optimistic', stage);
      window.removeEventListener('centralgo:trip-optimistic-settled', settle);
    };
  }, [currentCompany.id]);

  useEffect(()=>{
    if(!authUser||currentRole!=='driver'||currentCompany.id==='network')return;
    let active=true;
    const reconcile=()=>{if(!navigator.onLine)return;void loadDriverVisibleTrips(currentCompany.id).then(items=>{if(active)setTrips(items);}).catch(()=>{});};
    const onVisible=()=>{if(document.visibilityState==='visible')reconcile();};
    reconcile();
    const timer=window.setInterval(()=>{if(document.visibilityState==='visible')reconcile();},8000);
    window.addEventListener('focus',reconcile);window.addEventListener('online',reconcile);document.addEventListener('visibilitychange',onVisible);
    return()=>{active=false;window.clearInterval(timer);window.removeEventListener('focus',reconcile);window.removeEventListener('online',reconcile);document.removeEventListener('visibilitychange',onVisible);};
  },[authUser?.id,currentCompany.id,currentRole]);

  useEffect(() => {
    if (!authUser || currentCompany.id === 'network') return;
    const unsubscribe = subscribeCompanyRealtime(currentCompany.id, {
      onTrip: (trip) => {
        resolveOptimisticTripRequest(trip.operatorRequestId, trip.id);
        setTrips((items) => upsertTrip(items, trip));
      },
      onDriver: (row) => setDrivers((items) => {
        const existing = items.find((driver) => driver.id === row.id);
        return upsertById(items, mapDriverRow(row, existing ? {
          lat: existing.currentLocation.lat,
          lng: existing.currentLocation.lng,
          address: existing.currentLocation.address,
          speed_kmh: existing.currentLocation.speed,
          heading_degrees: existing.currentLocation.heading,
          recorded_at: existing.currentLocation.lastUpdated,
        } : undefined));
      }),
      onLocation: (row) => setDrivers((items) => items.map((driver) => driver.id === row.driver_id ? {
        ...driver,
        currentLocation: {
          ...driver.currentLocation,
          lat: row.lat,
          lng: row.lng,
          address: row.address ?? driver.currentLocation.address,
          speed: row.speed_kmh == null ? driver.currentLocation.speed : Number(row.speed_kmh),
          heading: row.heading_degrees == null ? driver.currentLocation.heading : Number(row.heading_degrees),
          lastUpdated: row.recorded_at,
        },
      } : driver)),
      onNotification: (notification) => {
        setNotifications((items) => upsertById(items, notification));
        if(currentRole==='driver'&&notification.relatedId)void loadTripById(notification.relatedId).then(trip=>{if(trip)setTrips(items=>upsertTrip(items,trip));}).catch(()=>{});
        if (notification.type === 'sos' && !soundMuted) playSOSSiren();
        if(['operator','company_admin'].includes(currentRole)&&notification.type==='warning'&&notification.title.toUpperCase().includes('RESERVA')&&!soundMuted){
          void soundManager.prime().then(ready=>{if(ready)soundManager.playReservationAlarmOnce(`due:${notification.relatedId??notification.id}`);});
        }
      },
      onStatus:status=>{if(currentRole==='driver'&&status==='SUBSCRIBED')void loadDriverVisibleTrips(currentCompany.id).then(setTrips).catch(()=>{});},
    });
    return unsubscribe;
  }, [authUser?.id, currentCompany.id, currentRole, soundMuted]);

  const addAuditLog = (action: string, description: string) => {
    if (currentCompany.id === 'network') return;
    void writeAudit(currentCompany.id, action, description)
      .then(() => setAuditLogs((items) => [{
        id: `pending-${Date.now()}`,
        companyId: currentCompany.id,
        userName: currentUser.name,
        userRole: currentRole,
        action,
        description,
        timestamp: new Date().toISOString(),
      }, ...items]))
      .catch((error) => reportError(error, 'No fue posible registrar auditoría.'));
  };

  const addNotification = (title: string, message: string, type: AppNotification['type'], relatedId?: string) => {
    if (currentCompany.id === 'network') return;
    void insertNotification(currentCompany.id, title, message, type, relatedId)
      .then((notification) => setNotifications((items) => upsertById(items, notification)))
      .catch((error) => reportError(error, 'No fue posible registrar la notificación.'));
  };

  const sendVHFMessageToDriver = (driver: Driver, message: string) => {
    if (!soundMuted) speakVHFDispatch(message);
    addAuditLog('TRANSMISION_VHF', `Transmisión VHF a ${driver.unitNumber}: "${message}"`);
    addNotification('Mensaje VHF', `${driver.unitNumber}: ${message}`, 'info', driver.id);
  };

  const createTrip = async (data: Partial<Trip>) => {
    try {
      const trip = await insertTrip(currentCompany, currentUser, data);
      resolveOptimisticTripRequest(trip.operatorRequestId ?? data.operatorRequestId, trip.id);
      setTrips((items) => upsertTrip(items, trip));
      if (trip.driverId) setDrivers((items) => items.map((driver) => driver.id === trip.driverId ? { ...driver, status: 'en_route' } : driver));
      const scheduleLabel = trip.scheduledFor ? ` agendada para ${new Date(trip.scheduledFor).toLocaleString('es-CL')}` : '';
      addAuditLog('CREAR_VIAJE', `Creó despacho ${trip.code}${scheduleLabel} para ${trip.clientName}`);
      if (!soundMuted && !trip.scheduledFor) {
        speakVHFDispatch(trip.driverUnitNumber ? `Atención ${trip.driverUnitNumber}, nuevo despacho en ${trip.origin.address}` : `Atención central y unidades, nuevo despacho en ${trip.origin.address}`);
      }
      return trip;
    } catch (error) {
      rejectOptimisticTripRequest(data.operatorRequestId, error);
      setTrips((items) => items.filter((trip) => !(trip.id.startsWith('optimistic-') && trip.operatorRequestId === data.operatorRequestId)));
      throw error;
    }
  };

  const assignTrip = async (tripId: string, driverId: string) => {
    const persistedTripId = await resolveOperationalTripId(tripId);
    const trip = await assignTripAtomic(persistedTripId, driverId);
    setTrips((items) => upsertTrip(items, trip));
    setDrivers((items) => items.map((driver) => driver.id === driverId ? { ...driver, status: 'en_route' } : driver));
    addAuditLog('ASIGNAR_VIAJE', `Asignó ${trip.driverUnitNumber ?? driverId} a ${trip.code}`);
  };

  const reassignTrip = async (tripId: string, newDriverId: string) => {
    const persistedTripId = await resolveOperationalTripId(tripId);
    const before = trips.find((trip) => trip.id === persistedTripId) ?? trips.find((trip) => trip.id === tripId);
    const trip = await assignTripAtomic(persistedTripId, newDriverId);
    setTrips((items) => upsertTrip(items, trip));
    setDrivers((items) => items.map((driver) => {
      if (driver.id === newDriverId) return { ...driver, status: 'en_route' };
      if (before?.driverId === driver.id) return { ...driver, status: 'available' };
      return driver;
    }));
    addAuditLog('REASIGNAR_VIAJE', `Reasignó ${trip.code} a ${trip.driverUnitNumber ?? newDriverId}`);
  };

  const updateTripStatus = async (tripId: string, status: TripStatus, notes?: string) => {
    const persistedTripId = await resolveOperationalTripId(tripId);
    const trip = await setTripStatusAtomic(persistedTripId, status, currentRole === 'driver');
    setTrips((items) => upsertTrip(items, notes ? { ...trip, notes: [trip.notes, notes].filter(Boolean).join(' | ') } : trip));
    if (trip.driverId) {
      setDrivers((items) => items.map((driver) => driver.id === trip.driverId ? {
        ...driver,
        status: status === 'completed' ? 'available' : status === 'in_progress' ? 'in_trip' : 'en_route',
      } : driver));
    }
    addAuditLog('ESTADO_VIAJE', `Actualizó ${trip.code} a ${status}`);
  };

  const completeTrip = async (tripId: string, finalFare: number, paymentMethod: PaymentMethod) => {
    const persistedTripId = await resolveOperationalTripId(tripId);
    const before = trips.find((item) => item.id === persistedTripId) ?? trips.find((item) => item.id === tripId);
    const trip = await completeTripAtomic(persistedTripId, finalFare, paymentMethod);
    setTrips((items) => upsertTrip(items, trip));
    if (trip.driverId && before?.status !== 'completed') {
      setDrivers((items) => items.map((driver) => driver.id === trip.driverId ? {
        ...driver,
        status: 'available',
        todayEarnings: driver.todayEarnings + (trip.finalFare ?? 0),
        totalTripsCompleted: driver.totalTripsCompleted + 1,
      } : driver));
    }
  };

  const cancelTrip = async (tripId: string, reason: string) => {
    const persistedTripId = await resolveOperationalTripId(tripId);
    const before = trips.find((trip) => trip.id === persistedTripId) ?? trips.find((trip) => trip.id === tripId);
    const trip = await cancelTripAtomic(persistedTripId, reason);
    setTrips((items) => upsertTrip(items, trip));
    if (before?.driverId) setDrivers((items) => items.map((driver) => driver.id === before.driverId ? { ...driver, status: 'available' } : driver));
    addAuditLog('CANCELAR_VIAJE', `Canceló ${trip.code}. Motivo: ${reason}`);
  };

  const unassignTrip = async (tripId: string, reason?: string) => {
    const persistedTripId = await resolveOperationalTripId(tripId);
    const before = trips.find((trip) => trip.id === persistedTripId) ?? trips.find((trip) => trip.id === tripId);
    const trip = await unassignTripAtomic(persistedTripId, reason);
    setTrips((items) => upsertTrip(items, trip));
    if (before?.driverId) setDrivers((items) => items.map((driver) => driver.id === before.driverId ? { ...driver, status: 'available' } : driver));
  };

  const rejectTripOffer = async (tripId: string, reason: string) => {
    const persistedTripId = await resolveOperationalTripId(tripId);
    if (currentRole !== 'driver') return unassignTrip(persistedTripId, reason);
    const before = trips.find((trip) => trip.id === persistedTripId) ?? trips.find((trip) => trip.id === tripId);
    const trip = await rejectDriverTripAtomic(persistedTripId, reason);
    setTrips((items) => upsertTrip(items, trip));
    if (before?.driverId) setDrivers((items) => items.map((driver) => driver.id === before.driverId ? { ...driver, status: 'available' } : driver));
  };

  const toggleDriverAvailability = async (driverId: string, status: DriverStatus) => {
    if (!['available', 'paused', 'offline'].includes(status)) throw new Error('Este estado se administra desde la carrera activa.');
    if (currentRole === 'driver') await setDriverManualStatus(currentCompany.id, status);
    else await setDriverStatusAsOperator(driverId, status);
    setDrivers((items) => items.map((driver) => driver.id === driverId ? { ...driver, status } : driver));
    addAuditLog('DISPONIBILIDAD_CONDUCTOR', `${driverId} cambió a ${status}`);
  };

  const updateDriverLocation = async (driverId: string, lat: number, lng: number, address?: string) => {
    const ownDriver = drivers.find((driver) => driver.id === driverId);
    if (!ownDriver || currentRole !== 'driver') return;
    await reportDriverLocation(currentCompany.id, lat, lng, address);
    setDrivers((items) => items.map((driver) => driver.id === driverId ? {
      ...driver,
      currentLocation: { ...driver.currentLocation, lat, lng, address: address ?? driver.currentLocation.address, lastUpdated: new Date().toISOString() },
    } : driver));
  };

  const triggerDriverSOS = async (driverId: string) => {
    const driver = drivers.find((item) => item.id === driverId);
    if (!driver || currentRole !== 'driver') throw new Error('Solo el conductor autenticado puede activar su SOS.');
    await triggerDriverSos(driver);
    const updated = { ...driver, sosActive: true, status: 'sos' as DriverStatus, sosTimestamp: new Date().toISOString() };
    setDrivers((items) => items.map((item) => item.id === driver.id ? updated : item));
    setActiveSOSDriver(updated);
    if (!soundMuted) playSOSSiren();
  };

  const resolveDriverSOS = async (driverId: string) => {
    if (currentRole === 'driver') await resolveOwnDriverSos();
    else await resolveDriverSos(driverId);
    setDrivers((items) => items.map((driver) => driver.id === driverId ? { ...driver, sosActive: false, status: 'available', sosTimestamp: undefined } : driver));
    setActiveSOSDriver((driver) => driver?.id === driverId ? null : driver);
  };

  const autoAssignClosestDriver = async (tripId: string): Promise<Driver | null> => {
    const persistedTripId = await resolveOperationalTripId(tripId);
    const trip = await autoDispatchTripAtomic(persistedTripId);
    setTrips((items) => upsertTrip(items, trip));
    const candidateId = trip.driverId ?? trip.reservedDriverId;
    if (!candidateId) return null;
    const candidate = drivers.find((driver) => driver.id === candidateId) ?? null;
    if (trip.driverId && candidate) {
      setDrivers((items) => items.map((driver) => driver.id === trip.driverId ? { ...driver, status: 'en_route' } : driver));
      addAuditLog('AUTO_DESPACHO', `Asignación automática inteligente: ${trip.code} → ${candidate.unitNumber}`);
    } else if (trip.reservedDriverId && candidate) {
      addAuditLog('AUTO_RESERVA', `Reserva predictiva: ${trip.code} espera a ${candidate.unitNumber}, que termina cerca del retiro`);
    }
    return trip.driverId ? candidate : null;
  };

  const settleDriverCommission = async (driverId: string) => {
    await settleDriverAtomic(driverId);
    setDrivers((items) => items.map((driver) => driver.id === driverId ? { ...driver, commissionBalance: 0 } : driver));
  };

  const addClient = async (data: Omit<Client, 'id' | 'totalTrips'>) => {
    const client = await insertClient({ ...data, companyId: currentCompany.id });
    setClients((items) => upsertById(items, client));
    addAuditLog('NUEVO_CLIENTE', `Agregó cliente ${client.name}`);
    return client;
  };

  const addVehicle = async (data: Omit<Vehicle, 'id'>) => {
    const vehicle = await insertVehicle({ ...data, companyId: currentCompany.id });
    setVehicles((items) => upsertById(items, vehicle));
    addAuditLog('NUEVO_VEHICULO', `Registró ${vehicle.unitNumber} (${vehicle.licensePlate})`);
    return vehicle;
  };

  const updateVehicle = async (data: Vehicle) => {
    const vehicle = await updateVehicleRecord({ ...data, companyId: currentCompany.id });
    setVehicles((items) => upsertById(items, vehicle));
    addAuditLog('EDICION_VEHICULO', `Actualizó ${vehicle.unitNumber} (${vehicle.licensePlate})`);
    return vehicle;
  };

  const addDriver = async (data: Omit<Driver, 'id' | 'rating' | 'totalTripsCompleted' | 'todayEarnings'>) => {
    let linkedUserId = data.userId;
    if (linkedUserId.includes('@')) linkedUserId = await assignCompanyUserByEmail(currentCompany.id, linkedUserId, 'driver');
    const driver = await insertDriver({ ...data, userId: linkedUserId, companyId: currentCompany.id });
    setDrivers((items) => upsertById(items, driver));
    addAuditLog('NUEVO_CONDUCTOR', `Registró ${driver.unitNumber} (${driver.name})`);
    return driver;
  };

  const updateFareConfig = async (config: FareConfig) => {
    await saveFareConfig(currentCompany.id, config);
    setFareConfig(config);
    addAuditLog('CONFIG_TARIFAS', 'Actualizó configuración de tarifas');
  };

  const markNotificationAsRead = async (id: string) => {
    await markNotificationRead(id);
    setNotifications((items) => items.map((notification) => notification.id === id ? { ...notification, read: true } : notification));
  };

  const clearAllNotifications = async () => {
    if (currentCompany.id === 'network') return;
    await markAllNotificationsRead(currentCompany.id);
    setNotifications((items) => items.map((notification) => ({ ...notification, read: true })));
  };

  const toggleSound = () => {
    const muted = soundManager.toggleMute();
    setSoundMuted(muted);
    if (!muted) void soundManager.prime().then((ready) => {
      if (ready) soundManager.playDispatchChime();
    });
  };

  const value: AppContextType = {
    currentRole,
    setCurrentRole: () => undefined,
    currentUser,
    currentCompany,
    setCurrentCompany,
    companies: authorizedCompanies,
    vehicles,
    drivers,
    clients,
    trips,
    operators,
    notifications,
    auditLogs,
    fareConfig,
    zones: ZONES,
    soundMuted,
    toggleSound,
    activeModule,
    setActiveModule,
    selectedTripForDetail,
    setSelectedTripForDetail,
    newTripModalOpen,
    setNewTripModalOpen,
    activeSOSDriver,
    setActiveSOSDriver,
    vhfModalDriver,
    setVHFModalDriver,
    sendVHFMessageToDriver,
    isMobileDevice,
    createTrip,
    assignTrip,
    reassignTrip,
    updateTripStatus,
    completeTrip,
    cancelTrip,
    rejectTripOffer,
    toggleDriverAvailability,
    updateDriverLocation,
    triggerDriverSOS,
    resolveDriverSOS,
    autoAssignClosestDriver,
    unassignTrip,
    settleDriverCommission,
    addClient,
    addVehicle,
    updateVehicle,
    addDriver,
    updateFareConfig,
    markNotificationAsRead,
    clearAllNotifications,
    addAuditLog,
    addNotification,
  };

  if (!effectiveRole) {
    return <main className="min-h-screen bg-zinc-950 text-zinc-100 flex items-center justify-center p-6"><section className="max-w-lg rounded-3xl border border-amber-400/20 bg-zinc-900 p-7"><h1 className="text-xl font-black">Cuenta creada, acceso pendiente</h1><p className="mt-2 text-sm text-zinc-400">Tu usuario está autenticado, pero todavía no tiene una central o rol asignado. Un administrador de Central GO debe habilitarlo antes de operar.</p></section></main>;
  }

  return (
    <AppContext.Provider value={value}>
      {operationError && <div className="fixed right-4 top-20 z-[200] max-w-md rounded-xl border border-rose-500/30 bg-rose-950/95 px-4 py-3 text-sm font-semibold text-rose-100 shadow-2xl">{operationError}</div>}
      {loadingData && currentCompany.id !== 'network' && <div className="fixed left-1/2 top-20 z-[150] -translate-x-1/2 rounded-full border border-blue-500/20 bg-zinc-950/95 px-4 py-2 text-xs font-bold text-blue-300 shadow-xl">Sincronizando central…</div>}
      {children}
    </AppContext.Provider>
  );
};

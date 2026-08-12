import React, { useEffect, useMemo, useState } from 'react';
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
  insertClient,
  insertDriver,
  insertNotification,
  insertTrip,
  insertVehicle,
  loadCommercialSnapshot,
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

export const CommercialAppProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const { authUser, profile, memberships, companies: authorizedCompanies, effectiveRole } = useAuth();
  const [currentCompany, setCurrentCompany] = useState<Company>(authorizedCompanies[0] ?? NETWORK_COMPANY);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [fareConfig, setFareConfig] = useState<FareConfig>(DEFAULT_FARE_CONFIG);
  const [soundMuted, setSoundMuted] = useState(false);
  const [activeModule, setActiveModule] = useState('dashboard');
  const [selectedTripForDetail, setSelectedTripForDetail] = useState<Trip | null>(null);
  const [newTripModalOpen, setNewTripModalOpen] = useState(false);
  const [activeSOSDriver, setActiveSOSDriver] = useState<Driver | null>(null);
  const [vhfModalDriver, setVHFModalDriver] = useState<Driver | null>(null);
  const [isMobileDevice, setIsMobileDevice] = useState(false);
  const [loadingData, setLoadingData] = useState(false);
  const [operationError, setOperationError] = useState<string | null>(null);

  const currentRole = effectiveRole ?? 'operator';

  useEffect(() => {
    if (!authorizedCompanies.length) {
      setCurrentCompany(NETWORK_COMPANY);
      return;
    }
    if (!authorizedCompanies.some((company) => company.id === currentCompany.id)) {
      setCurrentCompany(authorizedCompanies[0]);
    }
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
      setTrips(snapshot.trips);
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

  useEffect(() => {
    void hydrate();
  }, [authUser?.id, currentCompany.id, currentRole]);

  useEffect(() => {
    if (!authUser || currentCompany.id === 'network') return;
    const unsubscribe = subscribeCompanyRealtime(currentCompany.id, {
      onTrip: (trip) => setTrips((items) => upsertById(items, trip)),
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
        if (notification.type === 'sos' && !soundMuted) playSOSSiren();
      },
    });
    return unsubscribe;
  }, [authUser?.id, currentCompany.id, soundMuted]);

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
    const trip = await insertTrip(currentCompany, currentUser, data);
    setTrips((items) => upsertById(items, trip));
    if (trip.driverId) setDrivers((items) => items.map((driver) => driver.id === trip.driverId ? { ...driver, status: 'en_route' } : driver));
    const scheduleLabel = trip.scheduledFor ? ` agendada para ${new Date(trip.scheduledFor).toLocaleString('es-CL')}` : '';
    addAuditLog('CREAR_VIAJE', `Creó despacho ${trip.code}${scheduleLabel} para ${trip.clientName}`);
    if (!soundMuted && !trip.scheduledFor) {
      speakVHFDispatch(trip.driverUnitNumber ? `Atención ${trip.driverUnitNumber}, nuevo despacho en ${trip.origin.address}` : `Atención central y unidades, nuevo despacho en ${trip.origin.address}`);
    }
    return trip;
  };

  const assignTrip = async (tripId: string, driverId: string) => {
    const trip = await assignTripAtomic(tripId, driverId);
    setTrips((items) => upsertById(items, trip));
    setDrivers((items) => items.map((driver) => driver.id === driverId ? { ...driver, status: 'en_route' } : driver));
    addAuditLog('ASIGNAR_VIAJE', `Asignó ${trip.driverUnitNumber ?? driverId} a ${trip.code}`);
  };

  const reassignTrip = async (tripId: string, newDriverId: string) => {
    const before = trips.find((trip) => trip.id === tripId);
    const trip = await assignTripAtomic(tripId, newDriverId);
    setTrips((items) => upsertById(items, trip));
    setDrivers((items) => items.map((driver) => {
      if (driver.id === newDriverId) return { ...driver, status: 'en_route' };
      if (before?.driverId === driver.id) return { ...driver, status: 'available' };
      return driver;
    }));
    addAuditLog('REASIGNAR_VIAJE', `Reasignó ${trip.code} a ${trip.driverUnitNumber ?? newDriverId}`);
  };

  const updateTripStatus = async (tripId: string, status: TripStatus, notes?: string) => {
    const trip = await setTripStatusAtomic(tripId, status, currentRole === 'driver');
    setTrips((items) => upsertById(items, notes ? { ...trip, notes: [trip.notes, notes].filter(Boolean).join(' | ') } : trip));
    if (trip.driverId) {
      setDrivers((items) => items.map((driver) => driver.id === trip.driverId ? {
        ...driver,
        status: status === 'completed' ? 'available' : status === 'in_progress' ? 'in_trip' : 'en_route',
      } : driver));
    }
    addAuditLog('ESTADO_VIAJE', `Actualizó ${trip.code} a ${status}`);
  };

  const cancelTrip = async (tripId: string, reason: string) => {
    const before = trips.find((trip) => trip.id === tripId);
    const trip = await cancelTripAtomic(tripId, reason);
    setTrips((items) => upsertById(items, trip));
    if (before?.driverId) setDrivers((items) => items.map((driver) => driver.id === before.driverId ? { ...driver, status: 'available' } : driver));
    addAuditLog('CANCELAR_VIAJE', `Canceló ${trip.code}. Motivo: ${reason}`);
  };

  const unassignTrip = async (tripId: string, reason?: string) => {
    const before = trips.find((trip) => trip.id === tripId);
    const trip = await unassignTripAtomic(tripId, reason);
    setTrips((items) => upsertById(items, trip));
    if (before?.driverId) setDrivers((items) => items.map((driver) => driver.id === before.driverId ? { ...driver, status: 'available' } : driver));
  };

  const rejectTripOffer = async (tripId: string, reason: string) => {
    if (currentRole !== 'driver') return unassignTrip(tripId, reason);
    const before = trips.find((trip) => trip.id === tripId);
    const trip = await rejectDriverTripAtomic(tripId, reason);
    setTrips((items) => upsertById(items, trip));
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
    const trip = await autoDispatchTripAtomic(tripId);
    setTrips((items) => upsertById(items, trip));
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
    toggleSound: () => setSoundMuted(soundManager.toggleMute()),
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

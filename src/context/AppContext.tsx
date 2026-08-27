import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import {
  UserRole,
  DriverStatus,
  TripStatus,
  User,
  Company,
  Vehicle,
  Driver,
  Client,
  Trip,
  Operator,
  AppNotification,
  AuditLog,
  FareConfig,
  Zone,
  PaymentMethod,
} from '../types';
import {
  INITIAL_COMPANIES,
  INITIAL_VEHICLES,
  INITIAL_DRIVERS,
  INITIAL_CLIENTS,
  INITIAL_TRIPS,
  INITIAL_OPERATORS,
  INITIAL_NOTIFICATIONS,
  INITIAL_AUDIT_LOGS,
  DEFAULT_FARE_CONFIG,
  ZONES,
} from '../data/mockData';
import { playVHFRadioChirp, playSOSSiren, speakVHFDispatch } from '../lib/audioService';
import { soundManager } from '../lib/audio';
import { runtimeConfig } from '../config/runtime';
import { advanceAlongRoute, requestDrivingRoute, RoadPoint } from '../lib/roadRouting';

export type MaybePromise<T> = T | Promise<T>;

export interface AppContextType {
  // Roles & Session
  currentRole: UserRole;
  setCurrentRole: (role: UserRole) => void;
  currentUser: User;
  currentCompany: Company;
  setCurrentCompany: (comp: Company) => void;
  
  // Data Collections
  companies: Company[];
  vehicles: Vehicle[];
  drivers: Driver[];
  clients: Client[];
  trips: Trip[];
  operators: Operator[];
  notifications: AppNotification[];
  auditLogs: AuditLog[];
  fareConfig: FareConfig;
  zones: Zone[];
  
  // UI State
  soundMuted: boolean;
  toggleSound: () => void;
  activeModule: string;
  setActiveModule: (mod: string) => void;
  selectedTripForDetail: Trip | null;
  setSelectedTripForDetail: (trip: Trip | null) => void;
  newTripModalOpen: boolean;
  setNewTripModalOpen: (open: boolean) => void;
  activeSOSDriver: Driver | null;
  setActiveSOSDriver: (driver: Driver | null) => void;
  vhfModalDriver: Driver | null;
  setVHFModalDriver: (driver: Driver | null) => void;
  sendVHFMessageToDriver: (driver: Driver, message: string) => void;
  isMobileDevice: boolean;
  
  // Operational Actions
  createTrip: (data: Partial<Trip>) => MaybePromise<Trip>;
  assignTrip: (tripId: string, driverId: string) => MaybePromise<void>;
  reassignTrip: (tripId: string, newDriverId: string) => MaybePromise<void>;
  updateTripStatus: (tripId: string, status: TripStatus, notes?: string) => MaybePromise<void>;
  completeTrip: (tripId: string, finalFare: number, paymentMethod: PaymentMethod) => MaybePromise<void>;
  cancelTrip: (tripId: string, reason: string) => MaybePromise<void>;
  rejectTripOffer: (tripId: string, reason: string) => MaybePromise<void>;
  toggleDriverAvailability: (driverId: string, status: DriverStatus) => MaybePromise<void>;
  updateDriverLocation: (driverId: string, lat: number, lng: number, address?: string) => MaybePromise<void>;
  triggerDriverSOS: (driverId: string) => MaybePromise<void>;
  resolveDriverSOS: (driverId: string) => MaybePromise<void>;
  autoAssignClosestDriver: (tripId: string) => MaybePromise<Driver | null>;
  unassignTrip: (tripId: string) => MaybePromise<void>;
  settleDriverCommission: (driverId: string) => MaybePromise<void>;
  
  // Management CRUD
  addClient: (client: Omit<Client, 'id' | 'totalTrips'>) => MaybePromise<Client>;
  addVehicle: (vehicle: Omit<Vehicle, 'id'>) => MaybePromise<Vehicle>;
  updateVehicle: (vehicle: Vehicle) => MaybePromise<Vehicle>;
  addDriver: (driver: Omit<Driver, 'id' | 'rating' | 'totalTripsCompleted' | 'todayEarnings'>) => MaybePromise<Driver>;
  updateFareConfig: (config: FareConfig) => MaybePromise<void>;
  markNotificationAsRead: (id: string) => MaybePromise<void>;
  clearAllNotifications: () => MaybePromise<void>;
  addAuditLog: (action: string, description: string) => MaybePromise<void>;
  addNotification: (title: string, message: string, type: AppNotification['type'], relatedId?: string) => MaybePromise<void>;
}

export const AppContext = createContext<AppContextType | undefined>(undefined);

const createLocalId = (prefix: string) => {
  const uniquePart = typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  return `${prefix}-${uniquePart}`;
};

interface DriverRoadRouteState {
  key: string;
  mode: 'trip_origin' | 'trip_destination' | 'patrol';
  points: RoadPoint[];
  index: number;
  segmentOffsetMeters: number;
  loading: boolean;
  finished: boolean;
  arrivalHandled: boolean;
  tripId?: string;
  patrolIndex?: number;
}

const LINARES_PATROL_DESTINATIONS: Array<RoadPoint & { address: string }> = [
  { lat: -35.8454, lng: -71.5979, address: 'Plaza de Armas de Linares' },
  { lat: -35.8430, lng: -71.5880, address: 'Terminal de Buses de Linares' },
  { lat: -35.8412, lng: -71.5921, address: 'Avenida León Bustos' },
  { lat: -35.8480, lng: -71.5920, address: 'Población San Antonio' },
  { lat: -35.8490, lng: -71.6030, address: 'Hospital Base de Linares' },
  { lat: -35.8520, lng: -71.5950, address: 'Estación de Trenes de Linares' },
];

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentRole, setCurrentRole] = useState<UserRole>('operator');
  const [companies, setCompanies] = useState<Company[]>(INITIAL_COMPANIES);
  const [currentCompany, setCurrentCompany] = useState<Company>(INITIAL_COMPANIES[0]);
  
  const [vehicles, setVehicles] = useState<Vehicle[]>(INITIAL_VEHICLES);
  const [drivers, setDrivers] = useState<Driver[]>(INITIAL_DRIVERS);
  const [clients, setClients] = useState<Client[]>(INITIAL_CLIENTS);
  const [trips, setTrips] = useState<Trip[]>(INITIAL_TRIPS);
  const [operators] = useState<Operator[]>(INITIAL_OPERATORS);
  const [notifications, setNotifications] = useState<AppNotification[]>(INITIAL_NOTIFICATIONS);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>(INITIAL_AUDIT_LOGS);
  const [fareConfig, setFareConfig] = useState<FareConfig>(DEFAULT_FARE_CONFIG);
  const [zones] = useState<Zone[]>(ZONES);
  
  const [soundMuted, setSoundMuted] = useState<boolean>(() => soundManager.isMuted());
  const [activeModule, setActiveModule] = useState<string>('dashboard');
  const [selectedTripForDetail, setSelectedTripForDetail] = useState<Trip | null>(null);
  const [newTripModalOpen, setNewTripModalOpen] = useState<boolean>(false);
  const [activeSOSDriver, setActiveSOSDriver] = useState<Driver | null>(null);
  const [vhfModalDriver, setVHFModalDriver] = useState<Driver | null>(null);
  const [isMobileDevice, setIsMobileDevice] = useState<boolean>(false);

  const driverRoadRoutesRef = useRef<Record<string, DriverRoadRouteState>>({});
  const driversSnapshotRef = useRef<Driver[]>(INITIAL_DRIVERS);
  const tripsSnapshotRef = useRef<Trip[]>(INITIAL_TRIPS);
  const patrolIndexRef = useRef<Record<string, number>>({});

  useEffect(() => {
    driversSnapshotRef.current = drivers;
  }, [drivers]);

  useEffect(() => {
    tripsSnapshotRef.current = trips;
  }, [trips]);

  const sendVHFMessageToDriver = (driver: Driver, message: string) => {
    if (!soundMuted) {
      speakVHFDispatch(message);
    }
    addAuditLog('TRANSMISION_VHF', `Transmisión VHF a ${driver.unitNumber}: "${message}"`);
    addNotification('Mensaje VHF', `${driver.unitNumber}: ${message}`, 'info', driver.id);
  };

  // Check screen width for mobile driver experience
  useEffect(() => {
    const handleResize = () => {
      setIsMobileDevice(window.innerWidth < 768);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Set default current user profile based on role
  const sessionProfiles: Record<UserRole, { id: string; name: string; email: string; phone: string }> = {
    driver: { id: 'usr-drv-2', name: 'Gustavo Rossi (Móvil 12)', email: 'grossi@radiotaxilinares.cl', phone: '+56 9 7654 3210' },
    operator: { id: 'usr-op-1', name: 'Sonia Rodríguez (Operadora 01)', email: 'operaciones@radiotaxilinares.cl', phone: '+56 9 7654 3210' },
    company_admin: { id: 'usr-admin-1', name: 'Ing. Roberto Paz (Admin)', email: 'administracion@radiotaxilinares.cl', phone: '+56 9 8112 4400' },
    sales_partner: { id: 'usr-partner-1', name: 'Ignacio Varas (Partner Comercial)', email: 'ignacio@centralgo.network', phone: '+56 9 7330 4431' },
    regional_partner: { id: 'usr-regional-1', name: 'María Paz Herrera (Partner Regional)', email: 'maria@centralgo.network', phone: '+56 9 8812 0911' },
    super_admin: { id: 'usr-super-1', name: 'Superadmin Central GO', email: 'admin@centralgo.network', phone: '+56 9 9000 1000' },
  };
  const sessionProfile = sessionProfiles[currentRole];

  const currentUser: User = {
    id: sessionProfile.id,
    companyId: currentCompany.id,
    name: sessionProfile.name,
    email: sessionProfile.email,
    phone: sessionProfile.phone,
    role: currentRole,
    active: true,
    createdAt: '2025-01-01T00:00:00Z',
  };

  const toggleSound = () => {
    const muted = soundManager.toggleMute();
    setSoundMuted(muted);
    if (!muted) void soundManager.prime().then((ready) => {
      if (ready) soundManager.playDispatchChime();
    });
  };

  const addAuditLog = (action: string, description: string) => {
    const newLog: AuditLog = {
      id: `log-${Date.now()}`,
      companyId: currentCompany.id,
      userName: currentUser.name,
      userRole: currentRole,
      action,
      description,
      timestamp: new Date().toISOString(),
    };
    setAuditLogs((prev) => [newLog, ...prev]);
  };

  const addNotification = (title: string, message: string, type: AppNotification['type'], relatedId?: string) => {
    const newNotif: AppNotification = {
      id: `notif-${Date.now()}`,
      companyId: currentCompany.id,
      title,
      message,
      type,
      read: false,
      timestamp: new Date().toISOString(),
      relatedId,
    };
    setNotifications((prev) => [newNotif, ...prev]);

    if (type === 'sos') {
      soundManager.playSOSAlarm();
    } else if (type === 'trip') {
      soundManager.playDispatchChime();
    }
  };

  // Road-aware simulation: every vehicle follows a driving route returned by
  // OpenStreetMap/OSRM. When the service is unavailable, roadRouting uses a
  // local Linares street-grid fallback instead of moving diagonally over blocks.
  useEffect(() => {
    if (!runtimeConfig.isDemo) return;

    let cancelled = false;

    const ensureDriverRoutes = async () => {
      const currentDrivers = driversSnapshotRef.current;
      const currentTrips = tripsSnapshotRef.current;

      await Promise.all(
        currentDrivers.map(async (driver) => {
          if (cancelled || ['paused', 'offline', 'sos'].includes(driver.status)) {
            delete driverRoadRoutesRef.current[driver.id];
            return;
          }

          const activeTrip = currentTrips.find(
            (trip) =>
              trip.driverId === driver.id &&
              ['assigned', 'en_route', 'in_progress'].includes(trip.status)
          );

          let target: RoadPoint;
          let key: string;
          let mode: DriverRoadRouteState['mode'];
          let tripId: string | undefined;
          let patrolIndex: number | undefined;

          if (activeTrip && driver.status === 'en_route') {
            target = { lat: activeTrip.origin.lat, lng: activeTrip.origin.lng };
            key = `trip:${activeTrip.id}:origin:${target.lat.toFixed(5)}:${target.lng.toFixed(5)}`;
            mode = 'trip_origin';
            tripId = activeTrip.id;
          } else if (activeTrip && driver.status === 'in_trip') {
            target = { lat: activeTrip.destination.lat, lng: activeTrip.destination.lng };
            key = `trip:${activeTrip.id}:destination:${target.lat.toFixed(5)}:${target.lng.toFixed(5)}`;
            mode = 'trip_destination';
            tripId = activeTrip.id;
          } else if (driver.status === 'available') {
            const storedIndex = patrolIndexRef.current[driver.id] ??
              Math.abs(driver.id.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0)) % LINARES_PATROL_DESTINATIONS.length;
            patrolIndex = storedIndex % LINARES_PATROL_DESTINATIONS.length;
            target = LINARES_PATROL_DESTINATIONS[patrolIndex];

            // Do not route a car to the point where it is already parked.
            const distanceToTarget = Math.hypot(
              target.lat - driver.currentLocation.lat,
              target.lng - driver.currentLocation.lng
            );
            if (distanceToTarget < 0.00045) {
              patrolIndex = (patrolIndex + 1) % LINARES_PATROL_DESTINATIONS.length;
              patrolIndexRef.current[driver.id] = patrolIndex;
              target = LINARES_PATROL_DESTINATIONS[patrolIndex];
            }

            key = `patrol:${driver.id}:${patrolIndex}`;
            mode = 'patrol';
          } else {
            delete driverRoadRoutesRef.current[driver.id];
            return;
          }

          const existingRoute = driverRoadRoutesRef.current[driver.id];
          if (existingRoute?.key === key) return;

          const pendingRoute: DriverRoadRouteState = {
            key,
            mode,
            points: [],
            index: 0,
            segmentOffsetMeters: 0,
            loading: true,
            finished: false,
            arrivalHandled: false,
            tripId,
            patrolIndex,
          };
          driverRoadRoutesRef.current[driver.id] = pendingRoute;

          const points = await requestDrivingRoute(
            { lat: driver.currentLocation.lat, lng: driver.currentLocation.lng },
            target
          );

          if (cancelled || driverRoadRoutesRef.current[driver.id]?.key !== key) return;
          driverRoadRoutesRef.current[driver.id] = {
            ...pendingRoute,
            points,
            loading: false,
          };
        })
      );
    };

    void ensureDriverRoutes();
    const routeRefreshInterval = window.setInterval(() => {
      void ensureDriverRoutes();
    }, 2200);

    return () => {
      cancelled = true;
      window.clearInterval(routeRefreshInterval);
    };
  }, []);

  useEffect(() => {
    if (!runtimeConfig.isDemo) return;

    const movementInterval = window.setInterval(() => {
      setDrivers((previousDrivers) =>
        previousDrivers.map((driver) => {
          if (['paused', 'offline', 'sos'].includes(driver.status)) {
            return {
              ...driver,
              currentLocation: { ...driver.currentLocation, speed: 0 },
            };
          }

          const routeState = driverRoadRoutesRef.current[driver.id];
          if (!routeState || routeState.loading || routeState.points.length < 2 || routeState.finished) {
            return driver;
          }

          const speed = routeState.mode === 'patrol'
            ? Math.round(18 + Math.random() * 10)
            : Math.round(32 + Math.random() * 14);

          // La simulación avanza aproximadamente 4,2 veces más rápido que el
          // tiempo real para que el desplazamiento sea visible durante una demo.
          const travelMeters = (speed / 3.6) * 0.9 * 4.2;
          const advanced = advanceAlongRoute(
            routeState.points,
            routeState.index,
            routeState.segmentOffsetMeters,
            travelMeters
          );

          routeState.index = advanced.index;
          routeState.segmentOffsetMeters = advanced.remainingOnSegmentMeters;
          routeState.finished = advanced.finished;

          if (advanced.finished) {
            if (routeState.mode === 'patrol') {
              const nextIndex = ((routeState.patrolIndex ?? 0) + 1) % LINARES_PATROL_DESTINATIONS.length;
              patrolIndexRef.current[driver.id] = nextIndex;
              delete driverRoadRoutesRef.current[driver.id];
            } else if (!routeState.arrivalHandled && routeState.tripId) {
              routeState.arrivalHandled = true;
              const activeTrip = tripsSnapshotRef.current.find((trip) => trip.id === routeState.tripId);

              if (activeTrip && routeState.mode === 'trip_origin') {
                queueMicrotask(() => {
                  updateTripStatus(activeTrip.id, 'in_progress');
                  if (!soundMuted) {
                    speakVHFDispatch(`Atención central, móvil ${driver.unitNumber} ha llegado al origen.`);
                  }
                });
              } else if (activeTrip && routeState.mode === 'trip_destination') {
                queueMicrotask(() => {
                  updateTripStatus(activeTrip.id, 'completed');
                  if (!soundMuted) {
                    speakVHFDispatch(
                      `Atención central, móvil ${driver.unitNumber} finalizó carrera en ${activeTrip.destination.address}. Móvil libre.`
                    );
                  }
                });
              }
            }
          }

          return {
            ...driver,
            currentLocation: {
              ...driver.currentLocation,
              lat: advanced.point.lat,
              lng: advanced.point.lng,
              heading: advanced.heading,
              speed: advanced.finished ? 0 : speed,
              lastUpdated: new Date().toISOString(),
            },
          };
        })
      );
    }, 900);

    return () => window.clearInterval(movementInterval);
  }, [trips, soundMuted]);

  // Operational Actions

  const createTrip = (data: Partial<Trip>): Trip => {
    const newId = createLocalId('trp');
    const code = `${currentCompany.code}-${Math.floor(1000 + Math.random() * 9000)}`;

    let assignedDriverId = data.driverId;
    let assignedUnitNumber = data.driverUnitNumber;
    let assignedDriverName = data.driverName;
    let wasAutoAssigned = false;

    const originLat = data.origin?.lat ?? -35.8454;
    const originLng = data.origin?.lng ?? -71.5979;

    // Auto-GPS / Auto-dispatch if no explicit driver chosen
    if (!assignedDriverId) {
      const avail = drivers.filter((d) => d.status === 'available');
      if (avail.length > 0) {
        let closest = avail[0];
        let minDist = Infinity;
        avail.forEach((d) => {
          const dist = Math.hypot(d.currentLocation.lat - originLat, d.currentLocation.lng - originLng);
          if (dist < minDist) {
            minDist = dist;
            closest = d;
          }
        });

        assignedDriverId = closest.id;
        assignedUnitNumber = closest.unitNumber;
        assignedDriverName = closest.name;
        wasAutoAssigned = true;
      }
    }

    const newTrip: Trip = {
      id: newId,
      companyId: currentCompany.id,
      code,
      clientName: data.clientName || 'Cliente Particular',
      clientPhone: data.clientPhone || '+56 9 8000 0000',
      clientId: data.clientId,
      origin: data.origin || {
        lat: -35.8454,
        lng: -71.5979,
        address: 'Plaza de Armas, Linares',
      },
      destination: data.destination || {
        lat: -35.8490,
        lng: -71.6030,
        address: 'Hospital Base de Linares, Calle Max Jara',
      },
      status: assignedDriverId ? 'assigned' : 'pending',
      driverId: assignedDriverId,
      driverUnitNumber: assignedUnitNumber,
      driverName: assignedDriverName,
      operatorId: currentUser.id,
      operatorName: currentUser.name,
      vehicleTypeRequested: data.vehicleTypeRequested || 'standard',
      estimatedDistanceKm: data.estimatedDistanceKm ?? 4.2,
      estimatedDurationMins: data.estimatedDurationMins ?? 12,
      estimatedFare: data.isFixedFare && data.fixedFareAmount != null ? data.fixedFareAmount : (data.estimatedFare ?? 5200),
      isFixedFare: data.isFixedFare,
      fixedFareAmount: data.fixedFareAmount,
      finalFare: data.isFixedFare ? data.fixedFareAmount : data.finalFare,
      paymentMethod: data.paymentMethod || 'efectivo',
      notes: data.notes,
      createdAt: new Date().toISOString(),
      assignedAt: assignedDriverId ? new Date().toISOString() : undefined,
    };

    setTrips((prev) => [newTrip, ...prev]);

    if (assignedDriverId) {
      setDrivers((prev) =>
        prev.map((d) => (d.id === assignedDriverId ? { ...d, status: 'en_route' } : d))
      );
    }

    addAuditLog(
      'CREAR_VIAJE',
      `Creó despacho ${code} para ${newTrip.clientName} ${assignedUnitNumber ? `(${assignedUnitNumber})` : ''}`
    );
    addNotification('Nuevo Viaje Creado', `Despacho ${code} ingresado en ${newTrip.origin.address}`, 'trip', newTrip.id);

    if (!soundMuted) {
      if (wasAutoAssigned && assignedUnitNumber) {
        speakVHFDispatch(
          `Atención móvil ${assignedUnitNumber}, viaje asignado automáticamente en ${newTrip.origin.address}`
        );
      } else if (assignedUnitNumber) {
        speakVHFDispatch(`Atención móvil ${assignedUnitNumber}, nuevo despacho en ${newTrip.origin.address}`);
      } else {
        speakVHFDispatch(`Atención central y unidades, nuevo despacho libre ingresado en ${newTrip.origin.address}`);
      }
    }

    return newTrip;
  };

  const assignTrip = (tripId: string, driverId: string) => {
    const driver = drivers.find((d) => d.id === driverId);
    if (!driver) return;

    setTrips((prev) =>
      prev.map((t) => {
        if (t.id === tripId) {
          return {
            ...t,
            driverId,
            driverUnitNumber: driver.unitNumber,
            driverName: driver.name,
            status: 'assigned',
            assignedAt: new Date().toISOString(),
          };
        }
        return t;
      })
    );

    setDrivers((prev) =>
      prev.map((d) => (d.id === driverId ? { ...d, status: 'en_route' } : d))
    );

    addAuditLog('ASIGNAR_VIAJE', `Asignó ${driver.unitNumber} (${driver.name}) al viaje ${tripId}`);
    addNotification('Viaje Asignado', `${driver.unitNumber} asignado al despacho`, 'trip', tripId);

    if (!soundMuted) {
      speakVHFDispatch(`Atención ${driver.unitNumber}, viaje asignado. Diríjase al origen.`);
    }
  };

  const reassignTrip = (tripId: string, newDriverId: string) => {
    const newDriver = drivers.find((d) => d.id === newDriverId);
    if (!newDriver) return;

    const trip = trips.find((t) => t.id === tripId);
    if (!trip) return;

    // Free up old driver if applicable
    if (trip.driverId) {
      setDrivers((prev) =>
        prev.map((d) => (d.id === trip.driverId ? { ...d, status: 'available' } : d))
      );
    }

    setTrips((prev) =>
      prev.map((t) => {
        if (t.id === tripId) {
          return {
            ...t,
            driverId: newDriverId,
            driverUnitNumber: newDriver.unitNumber,
            driverName: newDriver.name,
            status: 'assigned',
            assignedAt: new Date().toISOString(),
          };
        }
        return t;
      })
    );

    setDrivers((prev) =>
      prev.map((d) => (d.id === newDriverId ? { ...d, status: 'en_route' } : d))
    );

    addAuditLog('REASIGNAR_VIAJE', `Reasignó el viaje ${trip.code} a ${newDriver.unitNumber}`);
    addNotification('Viaje Reasignado', `Viaje ${trip.code} transferido a ${newDriver.unitNumber}`, 'info', tripId);
  };

  const updateTripStatus = (tripId: string, status: TripStatus, notes?: string) => {
    const trip = trips.find((t) => t.id === tripId);
    if (!trip || trip.status === status) return;
    if (['completed', 'cancelled'].includes(trip.status)) return;

    const now = new Date().toISOString();

    setTrips((prev) =>
      prev.map((t) => {
        if (t.id === tripId) {
          return {
            ...t,
            status,
            notes: notes ? `${t.notes ? t.notes + ' | ' : ''}${notes}` : t.notes,
            enRouteAt: status === 'en_route' ? now : t.enRouteAt,
            arrivedAt: status === 'arrived' ? now : t.arrivedAt,
            startedAt: status === 'in_progress' ? now : t.startedAt,
            completedAt: status === 'completed' ? now : t.completedAt,
            finalFare: status === 'completed' ? t.estimatedFare : t.finalFare,
          };
        }
        return t;
      })
    );

    // Update driver status in tandem
    if (trip.driverId) {
      setDrivers((prev) =>
        prev.map((d) => {
          if (d.id === trip.driverId) {
            let newDriverStatus: DriverStatus = d.status;
            let earningsIncrement = 0;

            if (status === 'en_route') newDriverStatus = 'en_route';
            else if (status === 'arrived') newDriverStatus = 'en_route';
            else if (status === 'in_progress') newDriverStatus = 'in_trip';
            else if (status === 'completed') {
              newDriverStatus = 'available';
              earningsIncrement = trip.estimatedFare;
            } else if (status === 'cancelled') {
              newDriverStatus = 'available';
            }

            return {
              ...d,
              status: newDriverStatus,
              todayEarnings: d.todayEarnings + earningsIncrement,
              totalTripsCompleted: status === 'completed' ? d.totalTripsCompleted + 1 : d.totalTripsCompleted,
            };
          }
          return d;
        })
      );
    }

    if (status === 'arrived') {
      soundManager.playArrivalDing();
    }

    addAuditLog('ESTADO_VIAJE', `Actualizó estado del viaje ${trip.code} a ${status.toUpperCase()}`);
    addNotification('Estado de Viaje', `Viaje ${trip.code} cambió a ${status}`, 'info', tripId);
  };

  const completeTrip = (tripId: string, finalFare: number, paymentMethod: PaymentMethod) => {
    const trip = trips.find((item) => item.id === tripId);
    if (!trip || trip.status !== 'in_progress') return;
    const safeFare = Math.max(0, finalFare);
    const now = new Date().toISOString();
    setTrips((items) => items.map((item) => item.id === tripId ? {
      ...item,
      status: 'completed',
      completedAt: now,
      finalFare: safeFare,
      paymentMethod,
    } : item));
    if (trip.driverId) {
      setDrivers((items) => items.map((driver) => driver.id === trip.driverId ? {
        ...driver,
        status: 'available',
        todayEarnings: driver.todayEarnings + safeFare,
        totalTripsCompleted: driver.totalTripsCompleted + 1,
      } : driver));
    }
    addAuditLog('FINALIZAR_VIAJE', `Finalizó ${trip.code} por $${safeFare} mediante ${paymentMethod}`);
    addNotification('Carrera completada', `${trip.code} fue cobrada y completada.`, 'success', tripId);
  };

  const cancelTrip = (tripId: string, reason: string) => {
    const trip = trips.find((t) => t.id === tripId);
    if (!trip || ['completed', 'cancelled'].includes(trip.status)) return;

    setTrips((prev) =>
      prev.map((t) =>
        t.id === tripId
          ? {
              ...t,
              status: 'cancelled',
              cancelledAt: new Date().toISOString(),
              cancelReason: reason,
            }
          : t
      )
    );

    if (trip.driverId) {
      setDrivers((prev) =>
        prev.map((d) => (d.id === trip.driverId ? { ...d, status: 'available' } : d))
      );
    }

    addAuditLog('CANCELAR_VIAJE', `Canceló viaje ${trip.code}. Motivo: ${reason}`);
    addNotification('Viaje Cancelado', `Cancelación de ${trip.code}: ${reason}`, 'warning', tripId);
  };

  const rejectTripOffer = (tripId: string, reason: string) => {
    const trip = trips.find((t) => t.id === tripId);
    if (!trip || ['completed', 'cancelled'].includes(trip.status)) return;

    setTrips((prev) =>
      prev.map((t) =>
        t.id === tripId
          ? {
              ...t,
              status: 'pending',
              driverId: undefined,
              driverUnitNumber: undefined,
              driverName: undefined,
              assignedAt: undefined,
              notes: `${t.notes ? `${t.notes} | ` : ''}${reason}`,
            }
          : t
      )
    );

    if (trip.driverId) {
      setDrivers((prev) =>
        prev.map((driver) =>
          driver.id === trip.driverId ? { ...driver, status: 'available' } : driver
        )
      );
    }

    addAuditLog('RECHAZAR_OFERTA', `${trip.code} volvió a la cola. Motivo: ${reason}`);
    addNotification('Carrera nuevamente disponible', `${trip.code}: ${reason}`, 'warning', tripId);
  };

  const toggleDriverAvailability = (driverId: string, status: DriverStatus) => {
    setDrivers((prev) =>
      prev.map((d) => (d.id === driverId ? { ...d, status } : d))
    );
    addAuditLog('DISPONIBILIDAD_CONDUCTOR', `Conductor ${driverId} cambió estado a ${status}`);
  };

  const updateDriverLocation = (driverId: string, lat: number, lng: number, address?: string) => {
    setDrivers((prev) =>
      prev.map((d) =>
        d.id === driverId
          ? {
              ...d,
              currentLocation: {
                ...d.currentLocation,
                lat,
                lng,
                address: address || `Ubicación GPS (${lat.toFixed(4)}, ${lng.toFixed(4)}) - Linares`,
                lastUpdated: new Date().toISOString(),
              },
            }
          : d
      )
    );
  };

  const triggerDriverSOS = (driverId: string) => {
    const driver = drivers.find((d) => d.id === driverId);
    if (!driver) return;

    const updatedDriver = { ...driver, sosActive: true, status: 'sos' as DriverStatus, sosTimestamp: new Date().toISOString() };

    setDrivers((prev) =>
      prev.map((d) => (d.id === driverId ? updatedDriver : d))
    );

    setActiveSOSDriver(updatedDriver);
    addAuditLog('ALERTA_SOS', `🚨 EMERGENCIA SOS Activada por ${driver.unitNumber} (${driver.name})`);
    
    if (!soundMuted) {
      playSOSSiren();
    }

    addNotification(
      '🚨 ALERTA SOS EMERGENCIA',
      `Móvil ${driver.unitNumber} (${driver.name}) activó botón de pánico en ${driver.currentLocation.address || 'Ubicación GPS'}`,
      'sos',
      driverId
    );
  };

  const resolveDriverSOS = (driverId: string) => {
    setDrivers((prev) =>
      prev.map((d) => (d.id === driverId ? { ...d, sosActive: false, status: 'available' } : d))
    );
    if (activeSOSDriver?.id === driverId) {
      setActiveSOSDriver(null);
    }
    addAuditLog('SOS_RESUELTO', `Emergencia de ${driverId} marcada como resuelta.`);
  };

  const settleDriverCommission = (driverId: string) => {
    const driver = drivers.find((d) => d.id === driverId);
    if (!driver) return;

    setDrivers((prev) =>
      prev.map((d) => (d.id === driverId ? { ...d, commissionBalance: 0 } : d))
    );

    addAuditLog('RENDICION_CUOTAS', `Central cobró y saldó la cuota de radio de ${driver.unitNumber} (${driver.name})`);
    addNotification(
      'Cuota Saldada Exitosamente',
      `La comisión de ${driver.unitNumber} (${driver.name}) fue registrada como pagada.`,
      'success',
      driverId
    );
  };

  const autoAssignClosestDriver = (tripId: string): Driver | null => {
    const pendingTrip = trips.find((t) => t.id === tripId);
    if (!pendingTrip) return null;

    // Find available drivers
    const available = drivers.filter((d) => d.status === 'available');
    if (available.length === 0) {
      addNotification('Despacho Automático', 'No hay móviles libres en este momento', 'warning');
      return null;
    }

    // Pick closest driver by simple Euclidean distance to origin
    let closestDriver = available[0];
    let minDistance = 999999;

    available.forEach((d) => {
      const dx = d.currentLocation.lat - pendingTrip.origin.lat;
      const dy = d.currentLocation.lng - pendingTrip.origin.lng;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < minDistance) {
        minDistance = dist;
        closestDriver = d;
      }
    });

    assignTrip(tripId, closestDriver.id);
    return closestDriver;
  };

  const unassignTrip = (tripId: string) => {
    const trip = trips.find((item) => item.id === tripId);
    if (!trip || !trip.driverId || ['completed', 'cancelled'].includes(trip.status)) return;

    const previousDriverId = trip.driverId;
    const previousUnit = trip.driverUnitNumber || 'Móvil';

    setTrips((prev) =>
      prev.map((item) =>
        item.id === tripId
          ? {
              ...item,
              status: 'pending',
              driverId: undefined,
              driverUnitNumber: undefined,
              driverName: undefined,
              assignedAt: undefined,
              enRouteAt: undefined,
              arrivedAt: undefined,
            }
          : item
      )
    );

    setDrivers((prev) =>
      prev.map((driver) =>
        driver.id === previousDriverId ? { ...driver, status: 'available' } : driver
      )
    );

    addAuditLog('DESHACER_ASIGNACION', `Devolvió ${trip.code} a pendientes y liberó ${previousUnit}`);
    addNotification('Asignación deshecha', `${trip.code} volvió a la cola de pendientes`, 'info', tripId);
  };

  // CRUD Helpers

  const addClient = (data: Omit<Client, 'id' | 'totalTrips'>): Client => {
    const newClient: Client = {
      ...data,
      id: `cli-${Date.now()}`,
      totalTrips: 0,
      rating: 5.0,
    };
    setClients((prev) => [newClient, ...prev]);
    addAuditLog('NUEVO_CLIENTE', `Agregó cliente ${newClient.name}`);
    return newClient;
  };

  const addVehicle = (data: Omit<Vehicle, 'id'>): Vehicle => {
    const newVeh: Vehicle = {
      ...data,
      id: `veh-${Date.now()}`,
    };
    setVehicles((prev) => [newVeh, ...prev]);
    addAuditLog('NUEVO_VEHICULO', `Registró vehículo ${newVeh.unitNumber} (${newVeh.licensePlate})`);
    return newVeh;
  };

  const updateVehicle = (vehicle: Vehicle): Vehicle => {
    setVehicles((prev) => prev.map((item) => item.id === vehicle.id ? vehicle : item));
    addAuditLog('EDICION_VEHICULO', `Actualizó vehículo ${vehicle.unitNumber} (${vehicle.licensePlate})`);
    return vehicle;
  };

  const addDriver = (data: Omit<Driver, 'id' | 'rating' | 'totalTripsCompleted' | 'todayEarnings'>): Driver => {
    const newDrv: Driver = {
      ...data,
      id: `drv-${Date.now()}`,
      rating: 5.0,
      totalTripsCompleted: 0,
      todayEarnings: 0,
    };
    setDrivers((prev) => [newDrv, ...prev]);
    addAuditLog('NUEVO_CONDUCTOR', `Registró conductor ${newDrv.unitNumber} (${newDrv.name})`);
    return newDrv;
  };

  const updateFareConfig = (config: FareConfig) => {
    setFareConfig(config);
    addAuditLog('CONFIG_TARIFAS', 'Actualizó configuración de tarifas centrales');
    addNotification('Tarifas Actualizadas', 'Se han modificado los valores de bajada de bandera y precio por km', 'info');
  };

  const markNotificationAsRead = (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
  };

  const clearAllNotifications = () => {
    setNotifications([]);
  };

  return (
    <AppContext.Provider
      value={{
        currentRole,
        setCurrentRole,
        currentUser,
        currentCompany,
        setCurrentCompany,
        companies,
        vehicles,
        drivers,
        clients,
        trips,
        operators,
        notifications,
        auditLogs,
        fareConfig,
        zones,
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
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};


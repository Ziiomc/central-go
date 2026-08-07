import React, { createContext, useContext, useState, useEffect } from 'react';
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

interface AppContextType {
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
  createTrip: (data: Partial<Trip>) => Trip;
  assignTrip: (tripId: string, driverId: string) => void;
  reassignTrip: (tripId: string, newDriverId: string) => void;
  updateTripStatus: (tripId: string, status: TripStatus, notes?: string) => void;
  cancelTrip: (tripId: string, reason: string) => void;
  toggleDriverAvailability: (driverId: string, status: DriverStatus) => void;
  updateDriverLocation: (driverId: string, lat: number, lng: number, address?: string) => void;
  triggerDriverSOS: (driverId: string) => void;
  resolveDriverSOS: (driverId: string) => void;
  autoAssignClosestDriver: (tripId: string) => void;
  settleDriverCommission: (driverId: string) => void;
  
  // Management CRUD
  addClient: (client: Omit<Client, 'id' | 'totalTrips'>) => Client;
  addVehicle: (vehicle: Omit<Vehicle, 'id'>) => Vehicle;
  addDriver: (driver: Omit<Driver, 'id' | 'rating' | 'totalTripsCompleted' | 'todayEarnings'>) => Driver;
  updateFareConfig: (config: FareConfig) => void;
  markNotificationAsRead: (id: string) => void;
  clearAllNotifications: () => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const createLocalId = (prefix: string) => {
  const uniquePart = typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  return `${prefix}-${uniquePart}`;
};

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
  
  const [soundMuted, setSoundMuted] = useState<boolean>(false);
  const [activeModule, setActiveModule] = useState<string>('dashboard');
  const [selectedTripForDetail, setSelectedTripForDetail] = useState<Trip | null>(null);
  const [newTripModalOpen, setNewTripModalOpen] = useState<boolean>(false);
  const [activeSOSDriver, setActiveSOSDriver] = useState<Driver | null>(null);
  const [vhfModalDriver, setVHFModalDriver] = useState<Driver | null>(null);
  const [isMobileDevice, setIsMobileDevice] = useState<boolean>(false);

  const sendVHFMessageToDriver = (driver: Driver, message: string) => {
    if (!soundMuted) {
      playVHFRadioChirp();
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
  const currentUser: User = {
    id: currentRole === 'driver' ? 'usr-drv-2' : currentRole === 'operator' ? 'usr-op-1' : 'usr-admin-1',
    companyId: currentCompany.id,
    name:
      currentRole === 'driver'
        ? 'Gustavo Rossi (Móvil 12)'
        : currentRole === 'operator'
        ? 'Sonia Rodríguez (Operadora 01)'
        : currentRole === 'company_admin'
        ? 'Ing. Roberto Paz (Admin)'
        : 'SuperAdmin CentralGo',
    email: currentRole === 'driver' ? 'grossi@radiotaxilinares.cl' : 'operaciones@radiotaxilinares.cl',
    phone: '+56 9 7654 3210',
    role: currentRole,
    active: true,
    createdAt: '2025-01-01T00:00:00Z',
  };

  const toggleSound = () => {
    const muted = soundManager.toggleMute();
    setSoundMuted(muted);
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

  // Real-time Driver Simulation Loop (Moves vehicles along Linares street grid)
  useEffect(() => {
    const interval = setInterval(() => {
      setDrivers((prevDrivers) =>
        prevDrivers.map((drv) => {
          if (drv.status === 'paused' || drv.status === 'offline' || drv.status === 'sos') {
            return drv;
          }

          let { lat, lng, heading } = drv.currentLocation;
          let speed = 0;

          // Find active trip for this driver
          const activeTrip = trips.find(
            (t) => t.driverId === drv.id && ['assigned', 'en_route', 'in_progress'].includes(t.status)
          );

          if (activeTrip && (drv.status === 'en_route' || drv.status === 'in_trip')) {
            const target = drv.status === 'en_route' ? activeTrip.origin : activeTrip.destination;
            const dLat = target.lat - lat;
            const dLng = target.lng - lng;
            const distance = Math.hypot(dLat, dLng);

            speed = Math.floor(28 + Math.random() * 20);

            if (distance < 0.0008) {
              // Arrived at waypoint
              if (drv.status === 'en_route') {
                queueMicrotask(() => {
                  updateTripStatus(activeTrip.id, 'in_progress');
                  if (!soundMuted) {
                    speakVHFDispatch(`Atención central, móvil ${drv.unitNumber} ha llegado al origen.`);
                  }
                });
              } else if (drv.status === 'in_trip') {
                queueMicrotask(() => {
                  updateTripStatus(activeTrip.id, 'completed');
                  if (!soundMuted) {
                    speakVHFDispatch(`Atención central, móvil ${drv.unitNumber} finalizó carrera en ${activeTrip.destination.address}. Móvil libre.`);
                  }
                });
              }
            } else {
              // Street movement along primary axis (Manhattan grid)
              const stepSize = 0.00045;
              if (Math.abs(dLat) > Math.abs(dLng)) {
                lat += Math.sign(dLat) * stepSize;
                heading = dLat > 0 ? 0 : 180; // North or South
              } else {
                lng += Math.sign(dLng) * stepSize;
                heading = dLng > 0 ? 90 : 270; // East or West
              }
            }
          } else if (drv.status === 'available') {
            // Patrol along Linares street grid
            speed = Math.floor(15 + Math.random() * 15);
            let currentHeading = heading || 90;

            // 12% chance to turn 90 deg at cross street
            if (Math.random() < 0.12) {
              const cardinalTurns = [0, 90, 180, 270];
              currentHeading = cardinalTurns[Math.floor(Math.random() * cardinalTurns.length)];
            }

            const step = 0.00028;
            if (currentHeading === 0) lat += step;
            else if (currentHeading === 90) lng += step;
            else if (currentHeading === 180) lat -= step;
            else if (currentHeading === 270) lng -= step;
            else lng += step;

            heading = currentHeading;

            // Bound within Linares city limits (-35.860 to -35.832 lat, -71.615 to -71.580 lng)
            if (lat < -35.860 || lat > -35.832 || lng < -71.615 || lng > -71.580) {
              const dCenterLat = -35.8454 - lat;
              const dCenterLng = -71.5979 - lng;
              heading = Math.abs(dCenterLat) > Math.abs(dCenterLng)
                ? (dCenterLat > 0 ? 0 : 180)
                : (dCenterLng > 0 ? 90 : 270);
            }
          }

          return {
            ...drv,
            currentLocation: {
              ...drv.currentLocation,
              lat,
              lng,
              heading,
              speed,
              lastUpdated: new Date().toISOString(),
            },
          };
        })
      );
    }, 2500);

    return () => clearInterval(interval);
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
        playVHFRadioChirp();
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

  const autoAssignClosestDriver = (tripId: string) => {
    const pendingTrip = trips.find((t) => t.id === tripId);
    if (!pendingTrip) return;

    // Find available drivers
    const available = drivers.filter((d) => d.status === 'available');
    if (available.length === 0) {
      addNotification('Despacho Automático', 'No hay móviles libres en este momento', 'warning');
      return;
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
        cancelTrip,
        toggleDriverAvailability,
        updateDriverLocation,
        triggerDriverSOS,
        resolveDriverSOS,
        autoAssignClosestDriver,
        settleDriverCommission,
        addClient,
        addVehicle,
        addDriver,
        updateFareConfig,
        markNotificationAsRead,
        clearAllNotifications,
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

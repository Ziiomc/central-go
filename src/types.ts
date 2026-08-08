export type UserRole = 'super_admin' | 'regional_partner' | 'sales_partner' | 'company_admin' | 'operator' | 'driver';

export type DriverStatus = 'available' | 'en_route' | 'in_trip' | 'paused' | 'offline' | 'sos';

export type TripStatus = 'pending' | 'assigned' | 'en_route' | 'arrived' | 'in_progress' | 'completed' | 'cancelled';

export type PaymentMethod = 'efectivo' | 'transferencia' | 'posnet_tarjeta' | 'cuenta_corriente';

export interface Location {
  lat: number;
  lng: number;
  address: string;
  notes?: string;
}

export interface User {
  id: string;
  companyId: string;
  name: string;
  email: string;
  phone: string;
  role: UserRole;
  avatarUrl?: string;
  active: boolean;
  createdAt: string;
}

export interface Company {
  id: string;
  name: string;
  code: string; // e.g. "ROYAL", "VIP"
  phone: string;
  address: string;
  vhfFrequency?: string; // Radio frequency channel for emergency fallback e.g. "148.525 MHz"
  totalVehicles: number;
  totalDrivers: number;
  active: boolean;
  logoUrl?: string;
}

export interface Vehicle {
  id: string;
  companyId: string;
  unitNumber: string; // "Móvil 12"
  licensePlate: string; // "AA 123 CD"
  brand: string;
  model: string;
  year: number;
  color: string;
  capacity: number;
  petFriendly: boolean;
  wheelchairAccessible: boolean;
  airConditioning: boolean;
  technicalInspectionExpiry: string; // VTO Date
  status: 'active' | 'maintenance' | 'inactive';
}

export interface Driver {
  id: string;
  userId: string;
  companyId: string;
  vehicleId?: string;
  unitNumber: string; // "Móvil 12"
  name: string;
  phone: string;
  licenseNumber: string;
  licenseExpiry: string;
  photoUrl: string;
  status: DriverStatus;
  currentLocation: {
    lat: number;
    lng: number;
    address?: string;
    speed?: number; // km/h
    heading?: number; // degrees
    lastUpdated: string;
  };
  rating: number; // 4.9
  totalTripsCompleted: number;
  todayEarnings: number;
  commissionBalance: number; // positive = driver owes central, negative = central owes driver
  sosActive: boolean;
  sosTimestamp?: string;
}

export interface Client {
  id: string;
  companyId: string;
  name: string;
  phone: string;
  email?: string;
  frequentAddresses: {
    label: string; // "Casa", "Trabajo"
    address: string;
    lat: number;
    lng: number;
  }[];
  totalTrips: number;
  rating: number;
  isVIP: boolean;
  notes?: string; // e.g. "Cliente preferencial, esperar afuera"
  hasCurrentAccount?: boolean; // Cuenta Corriente
}

export interface Trip {
  id: string;
  companyId: string;
  code: string; // #TRP-8492
  clientId?: string;
  clientName: string;
  clientPhone: string;
  origin: Location;
  destination: Location;
  status: TripStatus;
  driverId?: string;
  driverUnitNumber?: string;
  driverName?: string;
  operatorId: string;
  operatorName: string;
  
  // Trip details
  vehicleTypeRequested?: 'standard' | 'pet' | 'wheelchair' | 'vip';
  estimatedDistanceKm: number;
  estimatedDurationMins: number;
  estimatedFare: number;
  finalFare?: number;
  isFixedFare?: boolean;
  fixedFareAmount?: number;
  paymentMethod: PaymentMethod;
  notes?: string;
  
  // Timestamps
  createdAt: string; // Requested time
  assignedAt?: string;
  enRouteAt?: string;
  arrivedAt?: string;
  startedAt?: string;
  completedAt?: string;
  cancelledAt?: string;
  cancelReason?: string;
  
  // Rating
  rating?: number;
  feedback?: string;
}

export interface Operator {
  id: string;
  userId: string;
  companyId: string;
  name: string;
  shift: 'Mañana' | 'Tarde' | 'Noche';
  dispatchesToday: number;
  avgDispatchTimeSeconds: number; // e.g. 18 seconds
  status: 'active' | 'on_break' | 'offline';
}

export interface AppNotification {
  id: string;
  companyId: string;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'sos' | 'success' | 'trip';
  read: boolean;
  timestamp: string;
  relatedId?: string; // Trip ID, Driver ID, etc.
}

export interface AuditLog {
  id: string;
  companyId: string;
  userName: string;
  userRole: UserRole;
  action: string;
  description: string;
  timestamp: string;
  ipAddress?: string;
}

export interface FareConfig {
  baseFare: number; // Bajada de bandera
  pricePerKm: number; // Ficha / km
  pricePerMinuteWait: number; // Minuto de espera
  nightSurchargePercent: number; // Recargo nocturno (e.g. 20%)
  sundaySurchargePercent: number; // Recargo domingos/feriados
  cancellationFee: number;
  currencySymbol: string; // "$"
}

export interface Zone {
  id: string;
  name: string;
  activeDriversCount: number;
  demandLevel: 'low' | 'medium' | 'high';
}

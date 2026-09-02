import React, { useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import { maplibreGL } from '@maplibre/maplibre-gl-leaflet';
import 'maplibre-gl/dist/maplibre-gl.css';
import 'leaflet/dist/leaflet.css';
import {
  ArrowLeft,
  BadgeDollarSign,
  BellRing,
  Building2,
  Car,
  Check,
  CheckCircle2,
  Clock3,
  Crown,
  Gauge,
  Headphones,
  LayoutDashboard,
  MapPin,
  Megaphone,
  Navigation,
  Phone,
  Radio,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Store,
  Timer,
  UserRound,
  UsersRound,
  Volume2,
  VolumeX,
  Wifi,
  X,
  Zap,
} from 'lucide-react';
import centralGoLogo from '../../assets/images/central-go-logo.svg';
import { advanceAlongRoute, requestDrivingRoute, type RoadPoint } from '../../lib/roadRouting';
import { speakVHFDispatch } from '../../lib/audioService';

type DemoView = 'operator' | 'driver' | 'admin' | 'plans' | 'sales_partner' | 'regional_partner';
type DemoTaxiStatus = 'available' | 'en_route' | 'in_trip';
type DemoTripStatus = 'pending' | 'en_route' | 'in_progress' | 'completed';

type DemoTaxi = {
  id: string;
  unit: string;
  driver: string;
  phone: string;
  plate: string;
  vehicle: string;
  status: DemoTaxiStatus;
  position: RoadPoint;
  heading: number;
  speed: number;
  tripId?: string;
};

type DemoTrip = {
  id: string;
  code: string;
  client: string;
  phone: string;
  origin: RoadPoint & { address: string };
  destination: RoadPoint & { address: string };
  fare: number;
  status: DemoTripStatus;
  createdAt: string;
  payment: 'Efectivo' | 'Transferencia' | 'Tarjeta';
  service: 'Estándar' | 'Ejecutivo' | 'Accesible';
  taxiId?: string;
  unit?: string;
};

type RouteState = {
  points: RoadPoint[];
  index: number;
  offset: number;
  phase: 'patrol' | 'pickup' | 'trip';
  targetKey: string;
  tripId?: string;
};

type Plan = {
  name: string;
  monthly: number;
  annualEquivalent: number;
  annualTotal: number;
  featured?: boolean;
  description: string;
  features: Array<{ label: string; enabled: boolean; highlight?: boolean }>;
};

const center: [number, number] = [-35.8454, -71.5979];

const patrolPoints: Array<RoadPoint & { address: string }> = [
  { lat: -35.8454, lng: -71.5979, address: 'Plaza de Armas' },
  { lat: -35.8427, lng: -71.5886, address: 'Terminal de Buses' },
  { lat: -35.8491, lng: -71.6030, address: 'Hospital Base' },
  { lat: -35.8516, lng: -71.5948, address: 'Estación de Trenes' },
  { lat: -35.8413, lng: -71.5923, address: 'Av. León Bustos' },
  { lat: -35.8481, lng: -71.5918, address: 'San Antonio' },
];

const initialTaxis: DemoTaxi[] = [
  { id: 'demo-taxi-05', unit: 'Móvil 05', driver: 'Carlos Méndez', phone: '+56 9 6512 0905', plate: 'LR-KT-05', vehicle: 'Toyota Yaris', status: 'available', position: { lat: -35.8470, lng: -71.5992 }, heading: 0, speed: 0 },
  { id: 'demo-taxi-12', unit: 'Móvil 12', driver: 'Gustavo Rossi', phone: '+56 9 6128 1812', plate: 'PL-GR-12', vehicle: 'Hyundai Accent', status: 'available', position: { lat: -35.8434, lng: -71.5916 }, heading: 0, speed: 0 },
  { id: 'demo-taxi-18', unit: 'Móvil 18', driver: 'María Fuentes', phone: '+56 9 6128 1818', plate: 'KB-MF-18', vehicle: 'Kia Soluto', status: 'available', position: { lat: -35.8500, lng: -71.5955 }, heading: 0, speed: 0 },
  { id: 'demo-taxi-24', unit: 'Móvil 24', driver: 'Luis Sanhueza', phone: '+56 9 6128 1824', plate: 'JR-LS-24', vehicle: 'Suzuki Dzire', status: 'available', position: { lat: -35.8418, lng: -71.6010 }, heading: 0, speed: 0 },
  { id: 'demo-taxi-31', unit: 'Móvil 31', driver: 'Patricio Vera', phone: '+56 9 6128 1831', plate: 'PK-PV-31', vehicle: 'Nissan Versa', status: 'available', position: { lat: -35.8520, lng: -71.5889 }, heading: 0, speed: 0 },
];

const requestPool = [
  { client: 'Alejandro Martínez', phone: '+56 9 7654 0988', origin: { lat: -35.8454, lng: -71.5979, address: 'Plaza de Armas de Linares' }, destination: { lat: -35.8427, lng: -71.5886, address: 'Terminal de Buses de Linares' }, fare: 5200, payment: 'Efectivo' as const, service: 'Estándar' as const },
  { client: 'Dra. Patricia Morales', phone: '+56 9 8712 3456', origin: { lat: -35.8484, lng: -71.5919, address: 'Calle Manuel Rodríguez 450' }, destination: { lat: -35.8491, lng: -71.6030, address: 'Hospital Base de Linares' }, fare: 4800, payment: 'Transferencia' as const, service: 'Ejecutivo' as const },
  { client: 'Gonzalo Fontana', phone: '+56 9 9876 5432', origin: { lat: -35.8481, lng: -71.5918, address: 'Población San Antonio' }, destination: { lat: -35.8454, lng: -71.5979, address: 'Centro de Linares' }, fare: 4100, payment: 'Efectivo' as const, service: 'Estándar' as const },
  { client: 'Camila Rojas', phone: '+56 9 7441 2200', origin: { lat: -35.8516, lng: -71.5948, address: 'Estación de Trenes' }, destination: { lat: -35.8413, lng: -71.5923, address: 'Avenida León Bustos' }, fare: 5600, payment: 'Tarjeta' as const, service: 'Accesible' as const },
  { client: 'Rodrigo Leiva', phone: '+56 9 8110 7701', origin: { lat: -35.8427, lng: -71.5886, address: 'Terminal de Buses' }, destination: { lat: -35.8481, lng: -71.5918, address: 'San Antonio' }, fare: 4600, payment: 'Efectivo' as const, service: 'Estándar' as const },
  { client: 'Valentina Soto', phone: '+56 9 6760 3112', origin: { lat: -35.8413, lng: -71.5923, address: 'Avenida León Bustos' }, destination: { lat: -35.8516, lng: -71.5948, address: 'Estación de Trenes' }, fare: 5900, payment: 'Transferencia' as const, service: 'Ejecutivo' as const },
];

const plans: Plan[] = [
  {
    name: 'Start', monthly: 149000, annualEquivalent: 59000, annualTotal: 708000,
    description: 'Para centrales pequeñas que quieren profesionalizar el despacho.',
    features: [
      { label: 'Hasta 10 móviles', enabled: true },
      { label: 'Hasta 2 operadoras', enabled: true },
      { label: 'Despacho + mapa operativo', enabled: true, highlight: true },
      { label: 'Historial básico', enabled: true },
      { label: 'App independiente de conductor', enabled: false },
      { label: 'GPS del conductor en vivo', enabled: false },
      { label: 'Reportes avanzados', enabled: false },
      { label: 'Múltiples sedes / ciudades', enabled: false },
      { label: 'API e integraciones', enabled: false },
    ],
  },
  {
    name: 'Pro', monthly: 219000, annualEquivalent: 99000, annualTotal: 1188000,
    description: 'La operación completa para una central moderna y en crecimiento.',
    features: [
      { label: 'Hasta 50 móviles', enabled: true },
      { label: 'Operadoras ilimitadas', enabled: true },
      { label: 'Despacho + mapa operativo', enabled: true },
      { label: 'Historial completo', enabled: true },
      { label: 'App independiente de conductor', enabled: true, highlight: true },
      { label: 'GPS del conductor en vivo', enabled: true, highlight: true },
      { label: 'Reportes avanzados', enabled: true },
      { label: 'Múltiples sedes / ciudades', enabled: false },
      { label: 'API e integraciones', enabled: false },
    ],
  },
  {
    name: 'Enterprise', monthly: 289000, annualEquivalent: 149000, annualTotal: 1788000, featured: true,
    description: 'La plataforma completa para redes, ciudades y operaciones de gran escala.',
    features: [
      { label: 'Móviles ilimitados', enabled: true, highlight: true },
      { label: 'Operadoras ilimitadas', enabled: true },
      { label: 'Despacho + mapa operativo', enabled: true },
      { label: 'Historial completo', enabled: true },
      { label: 'App independiente de conductor', enabled: true },
      { label: 'GPS del conductor en vivo', enabled: true },
      { label: 'Reportes avanzados', enabled: true },
      { label: 'Múltiples sedes / ciudades', enabled: true, highlight: true },
      { label: 'API e integraciones', enabled: true, highlight: true },
    ],
  },
];

const vhfPresets = [
  'Confirme recepción del servicio.',
  'Diríjase al origen indicado.',
  'Cliente esperando en el exterior.',
  'Confirme llegada al origen.',
  'Informe inicio de carrera.',
  'Confirme destino y valor del servicio.',
  'Al finalizar queda libre para nuevo despacho.',
  'Comuníquese con central cuando sea posible.',
  'Prioridad: servicio urgente.',
  'Regrese a su zona de cobertura asignada.',
];

const formatMoney = (value: number) => `$${Math.round(value).toLocaleString('es-CL')}`;
const formatTime = (value: string) => new Date(value).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });
const distance = (a: RoadPoint, b: RoadPoint) => Math.hypot(a.lat - b.lat, a.lng - b.lng);

const viewFromQuery = (): DemoView => {
  const raw = new URLSearchParams(window.location.search).get('view');
  if (raw === 'driver') return 'driver';
  if (raw === 'company_admin' || raw === 'admin') return 'admin';
  if (raw === 'sales_partner') return 'sales_partner';
  if (raw === 'regional_partner') return 'regional_partner';
  if (raw === 'plans') return 'plans';
  return 'operator';
};

const statusLabel: Record<DemoTaxiStatus, string> = { available: 'Libre', en_route: 'En camino', in_trip: 'En viaje' };
const statusTone: Record<DemoTaxiStatus, string> = {
  available: 'border-emerald-500/25 bg-emerald-500/10 text-emerald-300',
  en_route: 'border-amber-500/25 bg-amber-500/10 text-amber-300',
  in_trip: 'border-blue-500/25 bg-blue-500/10 text-blue-300',
};

export const SalesDemoScreen: React.FC = () => {
  const [activeView, setActiveView] = useState<DemoView>(viewFromQuery);
  const [taxis, setTaxis] = useState<DemoTaxi[]>(initialTaxis);
  const [trips, setTrips] = useState<DemoTrip[]>([]);
  const [selectedTaxiId, setSelectedTaxiId] = useState<string | null>(null);
  const [selectedTripId, setSelectedTripId] = useState<string | null>(null);
  const [dispatchTripId, setDispatchTripId] = useState<string | null>(null);
  const [dispatchTaxiId, setDispatchTaxiId] = useState<string>('');
  const [vhfTaxiId, setVhfTaxiId] = useState<string | null>(null);
  const [activity, setActivity] = useState<string[]>(['Central GO Demo iniciada · operación automática lista para mostrar.']);
  const [clock, setClock] = useState(new Date());
  const [autoRequests, setAutoRequests] = useState(true);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [newRequestPulse, setNewRequestPulse] = useState(false);
  const requestCursorRef = useRef(0);
  const routeCursorRef = useRef<Record<string, number>>({});
  const routesRef = useRef<Record<string, RouteState>>({});
  const taxisRef = useRef(taxis);
  const tripsRef = useRef(trips);
  const voiceRef = useRef(voiceEnabled);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<Record<string, L.Marker>>({});
  const routeLineRef = useRef<L.Polyline | null>(null);

  useEffect(() => { taxisRef.current = taxis; }, [taxis]);
  useEffect(() => { tripsRef.current = trips; }, [trips]);
  useEffect(() => { voiceRef.current = voiceEnabled; }, [voiceEnabled]);

  const pushActivity = (message: string) => {
    setActivity((items) => [message, ...items].slice(0, 8));
  };

  const announce = (message: string) => {
    pushActivity(message);
    if (voiceRef.current) speakVHFDispatch(message);
  };

  const changeView = (view: DemoView) => {
    setActiveView(view);
    const url = new URL(window.location.href);
    url.searchParams.set('demo', '1');
    url.searchParams.set('view', view);
    window.history.replaceState({}, '', url.toString());
  };

  const buildRoute = async (taxiId: string, target: RoadPoint, phase: RouteState['phase'], tripId?: string) => {
    const taxi = taxisRef.current.find((item) => item.id === taxiId);
    if (!taxi) return;
    const targetKey = `${phase}:${tripId ?? 'patrol'}:${target.lat.toFixed(5)}:${target.lng.toFixed(5)}`;
    if (routesRef.current[taxiId]?.targetKey === targetKey) return;
    const points = await requestDrivingRoute(taxi.position, target);
    routesRef.current[taxiId] = { points, index: 0, offset: 0, phase, targetKey, tripId };
  };

  const sendTaxiToPatrol = (taxiId: string) => {
    const index = ((routeCursorRef.current[taxiId] ?? 0) + 1) % patrolPoints.length;
    routeCursorRef.current[taxiId] = index;
    void buildRoute(taxiId, patrolPoints[index], 'patrol');
  };

  const freeTaxisForTrip = (trip: DemoTrip) => taxis.filter((taxi) => taxi.status === 'available')
    .sort((a, b) => distance(a.position, trip.origin) - distance(b.position, trip.origin));

  const assignTripToTaxi = (tripId: string, taxiId: string) => {
    const trip = tripsRef.current.find((item) => item.id === tripId);
    const taxi = taxisRef.current.find((item) => item.id === taxiId);
    if (!trip || !taxi || trip.status !== 'pending' || taxi.status !== 'available') return;

    const nextTrips = tripsRef.current.map((item) => item.id === tripId ? { ...item, status: 'en_route' as const, taxiId, unit: taxi.unit } : item);
    const nextTaxis = taxisRef.current.map((item) => item.id === taxiId ? { ...item, status: 'en_route' as const, tripId } : item);
    tripsRef.current = nextTrips;
    taxisRef.current = nextTaxis;
    setTrips(nextTrips);
    setTaxis(nextTaxis);
    setSelectedTaxiId(taxiId);
    setSelectedTripId(tripId);
    setDispatchTripId(null);
    setDispatchTaxiId('');
    announce(`Atención ${taxi.unit}. Nuevo servicio ${trip.code}. Diríjase a ${trip.origin.address}. Cliente ${trip.client}.`);
    void buildRoute(taxi.id, trip.origin, 'pickup', trip.id);
  };

  const autoAssignTrip = (tripId: string) => {
    const trip = tripsRef.current.find((item) => item.id === tripId);
    if (!trip) return;
    const closest = taxisRef.current.filter((taxi) => taxi.status === 'available')
      .sort((a, b) => distance(a.position, trip.origin) - distance(b.position, trip.origin))[0];
    if (!closest) {
      announce(`Central sin móviles libres para ${trip.code}. La solicitud queda en cola.`);
      return;
    }
    assignTripToTaxi(tripId, closest.id);
  };

  const rejectAssignedTrip = (tripId: string) => {
    const trip = tripsRef.current.find((item) => item.id === tripId);
    if (!trip?.taxiId) return;
    const taxiId = trip.taxiId;
    const nextTrips = tripsRef.current.map((item) => item.id === tripId ? { ...item, status: 'pending' as const, taxiId: undefined, unit: undefined } : item);
    const nextTaxis = taxisRef.current.map((item) => item.id === taxiId ? { ...item, status: 'available' as const, tripId: undefined } : item);
    tripsRef.current = nextTrips;
    taxisRef.current = nextTaxis;
    setTrips(nextTrips);
    setTaxis(nextTaxis);
    delete routesRef.current[taxiId];
    sendTaxiToPatrol(taxiId);
    announce(`${trip.unit ?? 'El móvil'} rechazó ${trip.code}. Servicio devuelto a la cola para reasignación.`);
  };

  const addIncomingRequest = (openDispatcher = false) => {
    const source = requestPool[requestCursorRef.current % requestPool.length];
    requestCursorRef.current += 1;
    const id = `demo-trip-${Date.now()}-${requestCursorRef.current}`;
    const trip: DemoTrip = {
      id,
      code: `LIN-${String(8400 + requestCursorRef.current).padStart(4, '0')}`,
      client: source.client,
      phone: source.phone,
      origin: source.origin,
      destination: source.destination,
      fare: source.fare,
      status: 'pending',
      createdAt: new Date().toISOString(),
      payment: source.payment,
      service: source.service,
    };
    const next = [trip, ...tripsRef.current].slice(0, 14);
    tripsRef.current = next;
    setTrips(next);
    setSelectedTripId(id);
    setNewRequestPulse(true);
    window.setTimeout(() => setNewRequestPulse(false), 1600);
    announce(`Nueva solicitud ${trip.code}. ${trip.client}, desde ${trip.origin.address} hacia ${trip.destination.address}.`);
    if (openDispatcher) {
      setDispatchTaxiId('');
      setDispatchTripId(id);
    }
  };

  const forceTripToPassenger = (tripId: string) => {
    const trip = tripsRef.current.find((item) => item.id === tripId);
    if (!trip?.taxiId) return;
    const taxi = taxisRef.current.find((item) => item.id === trip.taxiId);
    if (!taxi) return;
    const nextTrips = tripsRef.current.map((item) => item.id === tripId ? { ...item, status: 'in_progress' as const } : item);
    const nextTaxis = taxisRef.current.map((item) => item.id === taxi.id ? { ...item, status: 'in_trip' as const } : item);
    tripsRef.current = nextTrips;
    taxisRef.current = nextTaxis;
    setTrips(nextTrips);
    setTaxis(nextTaxis);
    announce(`${taxi.unit} confirma pasajero a bordo. Inicia carrera hacia ${trip.destination.address}.`);
    void buildRoute(taxi.id, trip.destination, 'trip', trip.id);
  };

  useEffect(() => {
    const timer = window.setInterval(() => setClock(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    initialTaxis.forEach((taxi, index) => {
      routeCursorRef.current[taxi.id] = index % patrolPoints.length;
      void buildRoute(taxi.id, patrolPoints[(index + 1) % patrolPoints.length], 'patrol');
    });
  }, []);

  useEffect(() => {
    if (!autoRequests) return;
    const first = window.setTimeout(() => addIncomingRequest(false), 4500);
    const timer = window.setInterval(() => addIncomingRequest(false), 24000);
    return () => { window.clearTimeout(first); window.clearInterval(timer); };
  }, [autoRequests]);

  useEffect(() => {
    const movementTimer = window.setInterval(() => {
      const nextTaxis = taxisRef.current.map((taxi) => {
        const route = routesRef.current[taxi.id];
        if (!route || route.points.length < 2) return taxi;
        const speed = route.phase === 'patrol' ? 24 : 38;
        const advanced = advanceAlongRoute(route.points, route.index, route.offset, (speed / 3.6) * 0.9 * 4.4);
        route.index = advanced.index;
        route.offset = advanced.remainingOnSegmentMeters;

        if (advanced.finished) {
          if (route.phase === 'patrol') {
            delete routesRef.current[taxi.id];
            window.setTimeout(() => sendTaxiToPatrol(taxi.id), 600);
          } else if (route.tripId) {
            const trip = tripsRef.current.find((item) => item.id === route.tripId);
            if (trip && route.phase === 'pickup') {
              const updatedTrips = tripsRef.current.map((item) => item.id === trip.id ? { ...item, status: 'in_progress' as const } : item);
              tripsRef.current = updatedTrips;
              setTrips(updatedTrips);
              announce(`${taxi.unit} llegó al origen de ${trip.code}. Pasajero abordando. Se inicia el viaje.`);
              window.setTimeout(() => void buildRoute(taxi.id, trip.destination, 'trip', trip.id), 800);
              return { ...taxi, status: 'in_trip' as const, position: advanced.point, heading: advanced.heading, speed: 0 };
            }
            if (trip && route.phase === 'trip') {
              const updatedTrips = tripsRef.current.map((item) => item.id === trip.id ? { ...item, status: 'completed' as const } : item);
              tripsRef.current = updatedTrips;
              setTrips(updatedTrips);
              announce(`${taxi.unit} finalizó ${trip.code} en ${trip.destination.address}. Valor ${formatMoney(trip.fare)}. Móvil queda libre.`);
              delete routesRef.current[taxi.id];
              window.setTimeout(() => sendTaxiToPatrol(taxi.id), 900);
              return { ...taxi, status: 'available' as const, tripId: undefined, position: advanced.point, heading: advanced.heading, speed: 0 };
            }
          }
        }

        return { ...taxi, position: advanced.point, heading: advanced.heading, speed: advanced.finished ? 0 : speed };
      });
      taxisRef.current = nextTaxis;
      setTaxis(nextTaxis);
    }, 900);
    return () => window.clearInterval(movementTimer);
  }, []);

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current || activeView !== 'operator') return;
    const map = L.map(mapContainerRef.current, { center, zoom: 14, zoomControl: false });
    L.control.zoom({ position: 'bottomright' }).addTo(map);
    maplibreGL({ style: 'https://tiles.openfreemap.org/styles/dark', attributionControl: false }).addTo(map);
    map.attributionControl.addAttribution('OpenFreeMap © OpenMapTiles · Datos © OpenStreetMap contributors');
    map.on('click', () => setSelectedTaxiId(null));
    mapRef.current = map;
    const observer = new ResizeObserver(() => map.invalidateSize());
    observer.observe(mapContainerRef.current);
    window.setTimeout(() => map.invalidateSize(), 150);
    return () => {
      observer.disconnect();
      Object.values(markersRef.current).forEach((marker) => marker.remove());
      markersRef.current = {};
      routeLineRef.current?.remove();
      routeLineRef.current = null;
      map.remove();
      mapRef.current = null;
    };
  }, [activeView]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || activeView !== 'operator') return;
    taxis.forEach((taxi) => {
      const selected = taxi.id === selectedTaxiId;
      const tone = taxi.status === 'available' ? '#10b981' : taxi.status === 'en_route' ? '#f59e0b' : '#3b82f6';
      const html = `<div style="position:relative;width:46px;height:58px"><div style="position:absolute;left:7px;top:10px;transform:rotate(${taxi.heading}deg);transform-origin:16px 20px;transition:transform .35s ease"><svg width="32" height="42" viewBox="0 0 32 42" xmlns="http://www.w3.org/2000/svg"><rect x="7" y="1" width="18" height="40" rx="7" fill="#facc15" stroke="${selected ? '#fff' : tone}" stroke-width="2"/><rect x="9" y="8" width="14" height="8" rx="2" fill="#111827"/><rect x="9" y="24" width="14" height="9" rx="2" fill="#111827"/><rect x="11" y="18" width="10" height="5" rx="1.5" fill="#f59e0b"/><text x="16" y="22" text-anchor="middle" font-size="4" font-weight="900" fill="#111">TAXI</text><rect x="4" y="10" width="3" height="8" rx="1" fill="#27272a"/><rect x="25" y="10" width="3" height="8" rx="1" fill="#27272a"/><rect x="4" y="27" width="3" height="8" rx="1" fill="#27272a"/><rect x="25" y="27" width="3" height="8" rx="1" fill="#27272a"/><circle cx="11" cy="4" r="1.5" fill="#fff7cc"/><circle cx="21" cy="4" r="1.5" fill="#fff7cc"/></svg></div><div style="position:absolute;left:50%;top:-8px;transform:translateX(-50%);white-space:nowrap;background:${tone};color:#050505;font-weight:900;font-size:9px;padding:3px 7px;border-radius:999px;box-shadow:0 5px 15px #0008">${taxi.unit}</div></div>`;
      const icon = L.divIcon({ className: 'custom-taxi-pin', html, iconSize: [46, 58], iconAnchor: [23, 35] });
      const existing = markersRef.current[taxi.id];
      if (existing) {
        existing.setLatLng([taxi.position.lat, taxi.position.lng]);
        existing.setIcon(icon);
      } else {
        const marker = L.marker([taxi.position.lat, taxi.position.lng], { icon }).addTo(map);
        marker.on('click', (event) => {
          L.DomEvent.stopPropagation(event);
          setSelectedTaxiId((current) => current === taxi.id ? null : taxi.id);
        });
        markersRef.current[taxi.id] = marker;
      }
    });
  }, [taxis, selectedTaxiId, activeView]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || activeView !== 'operator') return;
    routeLineRef.current?.remove();
    routeLineRef.current = null;
    if (!selectedTaxiId) return;
    const route = routesRef.current[selectedTaxiId];
    if (!route?.points.length) return;
    routeLineRef.current = L.polyline(route.points.map((point) => [point.lat, point.lng] as [number, number]), {
      color: '#f59e0b', weight: 4, opacity: 0.8, dashArray: '8 7',
    }).addTo(map);
  }, [selectedTaxiId, taxis, activeView]);

  const pendingTrips = trips.filter((trip) => trip.status === 'pending');
  const activeTrips = trips.filter((trip) => ['en_route', 'in_progress'].includes(trip.status));
  const completedTrips = trips.filter((trip) => trip.status === 'completed');
  const freeCount = taxis.filter((taxi) => taxi.status === 'available').length;
  const selectedTaxi = taxis.find((taxi) => taxi.id === selectedTaxiId) ?? null;
  const dispatchTrip = trips.find((trip) => trip.id === dispatchTripId) ?? null;
  const vhfTaxi = taxis.find((taxi) => taxi.id === vhfTaxiId) ?? null;

  const navItems: Array<{ id: DemoView; label: string; icon: React.ComponentType<{ className?: string }> }> = [
    { id: 'operator', label: 'Central / Operadora', icon: Headphones },
    { id: 'driver', label: 'App Conductor', icon: Smartphone },
    { id: 'admin', label: 'Administrador', icon: Building2 },
    { id: 'sales_partner', label: 'Partner Comercial', icon: Store },
    { id: 'regional_partner', label: 'Partner Regional', icon: UsersRound },
    { id: 'plans', label: 'Planes y precios', icon: BadgeDollarSign },
  ];

  return (
    <main className="min-h-screen bg-[#08090b] text-zinc-100">
      <header className="sticky top-0 z-50 border-b border-zinc-800 bg-[#0a0b0d]/95 px-3 py-2.5 shadow-2xl backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1900px] flex-wrap items-center gap-3">
          <div className="flex items-center gap-2.5 pr-2"><img src={centralGoLogo} alt="Central GO" className="h-10 w-10 rounded-xl border-2 border-amber-400/70 bg-black p-0.5" /><div><div className="text-sm font-black">CENTRAL <span className="rounded bg-amber-400 px-1.5 py-0.5 text-zinc-950">GO</span></div><p className="text-[8px] font-black uppercase tracking-[0.16em] text-purple-300">Demo comercial interactiva</p></div></div>
          <div className="order-3 flex w-full gap-1 overflow-x-auto lg:order-none lg:w-auto lg:flex-1">{navItems.map(({ id, label, icon: Icon }) => <button key={id} onClick={() => changeView(id)} className={`flex shrink-0 items-center gap-1.5 rounded-lg border px-2.5 py-2 text-[9px] font-black transition ${activeView === id ? 'border-amber-400/35 bg-amber-400/10 text-amber-300' : 'border-zinc-800 bg-zinc-950 text-zinc-500 hover:text-white'}`}><Icon className="h-3.5 w-3.5" />{label}</button>)}</div>
          <button onClick={() => setVoiceEnabled((value) => !value)} className={`rounded-lg border p-2 ${voiceEnabled ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-300' : 'border-zinc-800 bg-zinc-950 text-zinc-500'}`} title="Operadora virtual">{voiceEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}</button>
          <button onClick={() => { window.location.href = '/'; }} className="flex items-center gap-2 rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-[10px] font-black text-zinc-300 hover:border-amber-400/40 hover:text-white"><ArrowLeft className="h-4 w-4" />Acceso oficial</button>
        </div>
      </header>

      <div className="mx-auto max-w-[1900px] p-3 md:p-5">
        <div className="mb-4 flex flex-col justify-between gap-3 rounded-2xl border border-purple-500/20 bg-purple-500/[0.05] px-4 py-3 md:flex-row md:items-center"><div className="flex items-start gap-3"><Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-purple-300" /><div><p className="text-xs font-black text-white">Recorrido comercial completo</p><p className="mt-0.5 text-[10px] leading-relaxed text-zinc-500">Datos 100% simulados. Esta experiencia no toca usuarios, GPS ni carreras de ninguna central real.</p></div></div><div className="flex items-center gap-2 text-[9px] font-bold text-zinc-500"><span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />Operadora virtual {voiceEnabled ? 'activa' : 'silenciada'} · {clock.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</div></div>

        {activeView === 'operator' && (
          <OperatorDemo
            taxis={taxis}
            trips={trips}
            selectedTaxi={selectedTaxi}
            pendingCount={pendingTrips.length}
            activeCount={activeTrips.length}
            completedCount={completedTrips.length}
            freeCount={freeCount}
            mapContainerRef={mapContainerRef}
            newRequestPulse={newRequestPulse}
            autoRequests={autoRequests}
            activity={activity}
            onToggleAuto={() => setAutoRequests((value) => !value)}
            onSimulate={() => addIncomingRequest(true)}
            onDispatch={(tripId) => { setDispatchTaxiId(''); setDispatchTripId(tripId); }}
            onSelectTrip={setSelectedTripId}
            selectedTripId={selectedTripId}
            onSelectTaxi={setSelectedTaxiId}
            onVhf={setVhfTaxiId}
          />
        )}
        {activeView === 'driver' && <DriverDemo taxis={taxis} trips={trips} onReject={rejectAssignedTrip} onStartTrip={forceTripToPassenger} onGoOperator={() => changeView('operator')} />}
        {activeView === 'admin' && <AdminDemo taxis={taxis} trips={trips} onView={changeView} />}
        {activeView === 'sales_partner' && <SalesPartnerDemo onPlans={() => changeView('plans')} />}
        {activeView === 'regional_partner' && <RegionalPartnerDemo onPlans={() => changeView('plans')} />}
        {activeView === 'plans' && <PlansDemo onView={changeView} />}
      </div>

      {dispatchTrip && <DispatchModal trip={dispatchTrip} taxis={freeTaxisForTrip(dispatchTrip)} selectedTaxiId={dispatchTaxiId} onSelectTaxi={setDispatchTaxiId} onAuto={() => autoAssignTrip(dispatchTrip.id)} onAssign={() => dispatchTaxiId && assignTripToTaxi(dispatchTrip.id, dispatchTaxiId)} onQueue={() => { announce(`${dispatchTrip.code} permanece en cola a la espera de móvil.`); setDispatchTripId(null); }} onClose={() => setDispatchTripId(null)} />}
      {vhfTaxi && <VhfModal taxi={vhfTaxi} onSend={(preset) => { announce(`Atención ${vhfTaxi.unit}. ${preset}`); }} onClose={() => setVhfTaxiId(null)} />}
    </main>
  );
};

const Kpi: React.FC<{ label: string; value: string; detail: string; icon: React.ComponentType<{ className?: string }>; tone?: string }> = ({ label, value, detail, icon: Icon, tone = 'text-blue-300' }) => <div className="rounded-2xl border border-zinc-800 bg-[#0d0f12] p-3.5"><div className="flex items-start justify-between"><div><p className="text-[9px] font-black uppercase tracking-widest text-zinc-600">{label}</p><p className="mt-1 text-2xl font-black text-white">{value}</p><p className="mt-1 text-[9px] text-zinc-500">{detail}</p></div><div className={`rounded-xl border border-zinc-800 bg-zinc-950 p-2 ${tone}`}><Icon className="h-4 w-4" /></div></div></div>;

const OperatorDemo: React.FC<{
  taxis: DemoTaxi[]; trips: DemoTrip[]; selectedTaxi: DemoTaxi | null; pendingCount: number; activeCount: number; completedCount: number; freeCount: number;
  mapContainerRef: React.RefObject<HTMLDivElement | null>; newRequestPulse: boolean; autoRequests: boolean; activity: string[]; selectedTripId: string | null;
  onToggleAuto: () => void; onSimulate: () => void; onDispatch: (id: string) => void; onSelectTrip: (id: string) => void; onSelectTaxi: (id: string | null) => void; onVhf: (id: string) => void;
}> = ({ taxis, trips, selectedTaxi, pendingCount, activeCount, completedCount, freeCount, mapContainerRef, newRequestPulse, autoRequests, activity, selectedTripId, onToggleAuto, onSimulate, onDispatch, onSelectTrip, onSelectTaxi, onVhf }) => (
  <div className="space-y-4">
    <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-center"><div><div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-amber-300"><Headphones className="h-4 w-4" />Central de despacho</div><h1 className="mt-1 text-2xl font-black text-white">La operadora decide cómo despachar cada pedido</h1><p className="mt-1 text-xs text-zinc-500">Pedidos entran a cola; Central GO propone el móvil más cercano y reduce el uso de radio con avisos automáticos.</p></div><div className="flex flex-wrap gap-2"><button onClick={onToggleAuto} className={`rounded-xl border px-3 py-2.5 text-[10px] font-black ${autoRequests ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-300' : 'border-zinc-800 bg-zinc-950 text-zinc-500'}`}><BellRing className="mr-1.5 inline h-4 w-4" />Pedidos automáticos {autoRequests ? 'ON' : 'OFF'}</button><button onClick={onSimulate} className={`rounded-xl border border-amber-300 bg-amber-400 px-4 py-2.5 text-[10px] font-black text-zinc-950 shadow-lg ${newRequestPulse ? 'animate-pulse' : ''}`}><Zap className="mr-1.5 inline h-4 w-4" />Simular pedido</button></div></div>

    <div className="grid grid-cols-2 gap-3 xl:grid-cols-4"><Kpi label="Móviles libres" value={String(freeCount)} detail={`${taxis.length} conectados en la demo`} icon={Car} tone="text-emerald-300" /><Kpi label="Por despachar" value={String(pendingCount)} detail="esperando decisión de operadora" icon={Clock3} tone="text-amber-300" /><Kpi label="En servicio" value={String(activeCount)} detail="hacia pasajero o destino" icon={Navigation} /><Kpi label="Finalizadas" value={String(completedCount)} detail="durante esta sesión" icon={CheckCircle2} tone="text-purple-300" /></div>

    <div className="grid gap-4 xl:grid-cols-[.78fr_1.42fr]">
      <section className="overflow-hidden rounded-2xl border border-zinc-800 bg-[#0d0f12]"><div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3"><div><h2 className="text-sm font-black text-white">Cola de despacho</h2><p className="text-[9px] text-zinc-600">Presiona Despachar para ver todas las opciones de la operadora.</p></div><span className="rounded-full bg-amber-400/10 px-2 py-1 text-[9px] font-black text-amber-300">{pendingCount} pendientes</span></div><div className="max-h-[525px] overflow-y-auto">{trips.length === 0 && <div className="p-8 text-center text-xs text-zinc-600">Esperando solicitudes…</div>}{trips.map((trip) => <button key={trip.id} onClick={() => onSelectTrip(trip.id)} className={`block w-full border-b border-zinc-900 p-3 text-left transition ${selectedTripId === trip.id ? 'bg-blue-500/[0.08]' : 'hover:bg-zinc-900/45'}`}><div className="flex items-start justify-between gap-3"><div className="min-w-0"><div className="flex items-center gap-2"><span className="text-[10px] font-black text-white">{formatTime(trip.createdAt)}</span><span className={`rounded-full px-2 py-0.5 text-[8px] font-black uppercase ${trip.status === 'pending' ? 'bg-amber-500/10 text-amber-300' : trip.status === 'completed' ? 'bg-emerald-500/10 text-emerald-300' : 'bg-blue-500/10 text-blue-300'}`}>{trip.status === 'pending' ? 'Por asignar' : trip.status === 'en_route' ? 'Móvil en camino' : trip.status === 'in_progress' ? 'En viaje' : 'Finalizada'}</span></div><p className="mt-1 truncate text-xs font-black text-zinc-200">{trip.client} · {trip.code}</p><p className="mt-1 truncate text-[9px] text-zinc-500">{trip.origin.address} → {trip.destination.address}</p><p className="mt-1 text-[8px] text-zinc-600">{trip.service} · {trip.payment} · {formatMoney(trip.fare)}</p></div><div className="shrink-0 text-right">{trip.status === 'pending' ? <span onClick={(event) => { event.stopPropagation(); onDispatch(trip.id); }} className="inline-flex cursor-pointer items-center gap-1 rounded-lg bg-amber-400 px-2.5 py-2 text-[9px] font-black text-zinc-950"><Navigation className="h-3.5 w-3.5" />Despachar</span> : <span className="text-[9px] font-black text-blue-300">{trip.unit ?? 'Procesando'}</span>}</div></div></button>)}</div></section>
      <section className="overflow-hidden rounded-2xl border border-zinc-800 bg-[#0d0f12]"><div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3"><div><h2 className="text-sm font-black text-white">Mapa operativo en vivo</h2><p className="text-[9px] text-zinc-600">Los taxis siguen rutas vehiculares, no flotan sobre edificios.</p></div><span className="flex items-center gap-1.5 text-[9px] font-black text-emerald-300"><Wifi className="h-3.5 w-3.5" />EN LÍNEA</span></div><div className="relative"><div ref={mapContainerRef} className="h-[525px] w-full bg-zinc-950" />{selectedTaxi && <div className="absolute left-3 top-3 z-[450] w-[245px] rounded-2xl border border-zinc-700 bg-zinc-950/95 p-3 shadow-2xl"><div className="flex items-start justify-between gap-2"><div><p className="text-xs font-black text-white">{selectedTaxi.unit}</p><p className="text-[9px] text-zinc-500">{selectedTaxi.driver} · {selectedTaxi.vehicle}</p></div><button onClick={() => onSelectTaxi(null)} className="text-zinc-600 hover:text-white"><X className="h-4 w-4" /></button></div><div className="mt-3 grid grid-cols-2 gap-2 text-[9px]"><div className="rounded-lg bg-zinc-900 p-2"><span className="text-zinc-600">Estado</span><p className="font-black text-white">{statusLabel[selectedTaxi.status]}</p></div><div className="rounded-lg bg-zinc-900 p-2"><span className="text-zinc-600">Velocidad</span><p className="font-black text-white">{selectedTaxi.speed} km/h</p></div></div><button onClick={() => onVhf(selectedTaxi.id)} className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-amber-500/25 bg-amber-500/10 px-3 py-2.5 text-[9px] font-black text-amber-300"><Radio className="h-4 w-4" />VHF / mensajes rápidos</button></div>}</div></section>
    </div>

    <section className="overflow-hidden rounded-2xl border border-zinc-800 bg-[#0d0f12]"><div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3"><div><h2 className="text-sm font-black text-white">Control de móviles</h2><p className="text-[9px] text-zinc-600">Ubicación, conexión, estado y canal de respaldo.</p></div><Radio className="h-4 w-4 text-amber-300" /></div><div className="overflow-x-auto"><table className="w-full min-w-[850px]"><thead><tr>{['Móvil / conductor','Vehículo','Estado','GPS','Velocidad','Conexión','Acciones'].map((head) => <th key={head} className="border-b border-zinc-800 bg-zinc-950/50 p-3 text-left text-[8px] font-black uppercase tracking-widest text-zinc-600">{head}</th>)}</tr></thead><tbody>{taxis.map((taxi) => <tr key={taxi.id} className="border-b border-zinc-900"><td className="p-3"><p className="text-xs font-black text-white">{taxi.unit}</p><p className="text-[9px] text-zinc-500">{taxi.driver}</p></td><td className="p-3 text-[9px] text-zinc-400">{taxi.vehicle}<br/><span className="text-zinc-600">{taxi.plate}</span></td><td className="p-3"><span className={`rounded-full border px-2.5 py-1 text-[8px] font-black ${statusTone[taxi.status]}`}>{statusLabel[taxi.status]}</span></td><td className="p-3 text-[9px] font-black text-emerald-300">ACTIVO</td><td className="p-3 text-[9px] text-zinc-300">{taxi.speed} km/h</td><td className="p-3 text-[9px] font-black text-blue-300">APP</td><td className="p-3"><div className="flex gap-1.5"><button onClick={() => onSelectTaxi(taxi.id)} className="rounded-lg border border-zinc-800 bg-zinc-950 px-2 py-1.5 text-[8px] font-black text-zinc-400">Ubicar</button><button onClick={() => onVhf(taxi.id)} className="rounded-lg border border-amber-500/20 bg-amber-500/10 px-2 py-1.5 text-[8px] font-black text-amber-300">VHF</button></div></td></tr>)}</tbody></table></div></section>

    <section className="rounded-2xl border border-zinc-800 bg-[#0d0f12] p-4"><div className="flex items-center gap-2"><Megaphone className="h-4 w-4 text-purple-300" /><h2 className="text-xs font-black text-white">Operadora virtual / registro de avisos</h2></div><div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-4">{activity.slice(0, 8).map((item, index) => <div key={`${item}-${index}`} className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-3 text-[9px] leading-relaxed text-zinc-400">{item}</div>)}</div></section>
  </div>
);

const DispatchModal: React.FC<{ trip: DemoTrip; taxis: DemoTaxi[]; selectedTaxiId: string; onSelectTaxi: (id: string) => void; onAuto: () => void; onAssign: () => void; onQueue: () => void; onClose: () => void }> = ({ trip, taxis, selectedTaxiId, onSelectTaxi, onAuto, onAssign, onQueue, onClose }) => <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/80 p-4 backdrop-blur-md"><section className="w-full max-w-4xl overflow-hidden rounded-3xl border border-amber-500/25 bg-[#0c0d10] shadow-2xl"><div className="flex items-start justify-between border-b border-zinc-800 p-5"><div><div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-widest text-amber-300"><Navigation className="h-4 w-4" />Mesa de despacho</div><h2 className="mt-1 text-xl font-black text-white">¿Cómo quieres despachar {trip.code}?</h2><p className="mt-1 text-[10px] text-zinc-500">La operadora conserva el control: autoasignar, elegir móvil o mantener en cola.</p></div><button onClick={onClose} className="rounded-lg border border-zinc-800 bg-zinc-950 p-2 text-zinc-500"><X className="h-4 w-4" /></button></div><div className="grid gap-5 p-5 lg:grid-cols-[.9fr_1.1fr]"><div className="space-y-3"><div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4"><p className="text-xs font-black text-white">{trip.client}</p><p className="mt-1 text-[9px] text-zinc-500">{trip.phone}</p><div className="mt-4 space-y-3 text-[10px]"><div className="flex gap-2"><MapPin className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" /><div><p className="font-black text-zinc-300">Origen</p><p className="text-zinc-500">{trip.origin.address}</p></div></div><div className="flex gap-2"><Navigation className="mt-0.5 h-4 w-4 shrink-0 text-blue-300" /><div><p className="font-black text-zinc-300">Destino</p><p className="text-zinc-500">{trip.destination.address}</p></div></div></div><div className="mt-4 grid grid-cols-3 gap-2 text-center"><div className="rounded-xl bg-zinc-900 p-2"><p className="text-[8px] text-zinc-600">Servicio</p><p className="mt-1 text-[9px] font-black text-white">{trip.service}</p></div><div className="rounded-xl bg-zinc-900 p-2"><p className="text-[8px] text-zinc-600">Pago</p><p className="mt-1 text-[9px] font-black text-white">{trip.payment}</p></div><div className="rounded-xl bg-zinc-900 p-2"><p className="text-[8px] text-zinc-600">Estimado</p><p className="mt-1 text-[9px] font-black text-amber-300">{formatMoney(trip.fare)}</p></div></div></div><button onClick={onAuto} disabled={!taxis.length} className="flex w-full items-center justify-center gap-2 rounded-xl bg-amber-400 px-4 py-3 text-xs font-black text-zinc-950 disabled:opacity-40"><Zap className="h-4 w-4" />Autoasignar móvil más cercano</button><button onClick={onQueue} className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-[10px] font-black text-zinc-400">Mantener solicitud en cola</button></div><div><div className="mb-3 flex items-center justify-between"><div><p className="text-xs font-black text-white">Elegir móvil manualmente</p><p className="text-[9px] text-zinc-600">Ordenados por cercanía estimada al pasajero.</p></div><span className="text-[9px] font-black text-emerald-300">{taxis.length} libres</span></div><div className="max-h-[340px] space-y-2 overflow-y-auto pr-1">{taxis.map((taxi, index) => <button key={taxi.id} onClick={() => onSelectTaxi(taxi.id)} className={`flex w-full items-center justify-between rounded-2xl border p-3 text-left ${selectedTaxiId === taxi.id ? 'border-blue-400/40 bg-blue-500/10' : 'border-zinc-800 bg-zinc-950 hover:border-zinc-700'}`}><div className="flex items-center gap-3"><div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-400 text-xl">🚕</div><div><p className="text-xs font-black text-white">{taxi.unit} · {taxi.driver}</p><p className="text-[9px] text-zinc-600">{taxi.vehicle} · {taxi.plate}</p></div></div><div className="text-right"><p className="text-[9px] font-black text-emerald-300">#{index + 1} recomendado</p><p className="text-[8px] text-zinc-600">GPS activo</p></div></button>)}{!taxis.length && <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-6 text-center text-xs text-rose-300">No hay móviles libres. La carrera debe permanecer en cola.</div>}</div><button disabled={!selectedTaxiId} onClick={onAssign} className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-blue-400/30 bg-blue-600 px-4 py-3 text-xs font-black text-white disabled:opacity-30"><Navigation className="h-4 w-4" />Asignar móvil seleccionado</button></div></div></section></div>;

const VhfModal: React.FC<{ taxi: DemoTaxi; onSend: (preset: string) => void; onClose: () => void }> = ({ taxi, onSend, onClose }) => <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/80 p-4 backdrop-blur"><section className="w-full max-w-xl rounded-3xl border border-amber-500/25 bg-[#0d0f12] p-5 shadow-2xl"><div className="flex items-start justify-between"><div><div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-widest text-amber-300"><Radio className="h-4 w-4" />VHF de respaldo</div><h2 className="mt-1 text-lg font-black text-white">Mensajes rápidos · {taxi.unit}</h2><p className="mt-1 text-[10px] text-zinc-500">Central GO automatiza gran parte de los avisos. El VHF queda para instrucciones rápidas y contingencias.</p></div><button onClick={onClose} className="rounded-lg border border-zinc-800 bg-zinc-950 p-2 text-zinc-500"><X className="h-4 w-4" /></button></div><div className="mt-5 grid gap-2 sm:grid-cols-2">{vhfPresets.map((preset) => <button key={preset} onClick={() => onSend(preset)} className="rounded-xl border border-zinc-800 bg-zinc-950 p-3 text-left text-[10px] font-bold leading-relaxed text-zinc-300 transition hover:border-amber-500/30 hover:bg-amber-500/5 hover:text-amber-200">{preset}</button>)}</div><div className="mt-4 rounded-xl border border-blue-500/20 bg-blue-500/5 p-3 text-[9px] leading-relaxed text-blue-200/70">En operación real estos mensajes quedan registrados en auditoría. La voz demo reproduce el mensaje para mostrar cómo Central GO reduce conversaciones repetitivas por radio.</div></section></div>;

const DriverDemo: React.FC<{ taxis: DemoTaxi[]; trips: DemoTrip[]; onReject: (id: string) => void; onStartTrip: (id: string) => void; onGoOperator: () => void }> = ({ taxis, trips, onReject, onStartTrip, onGoOperator }) => {
  const active = trips.find((trip) => trip.taxiId && ['en_route', 'in_progress'].includes(trip.status));
  const taxi = active ? taxis.find((item) => item.id === active.taxiId) : taxis[1];
  return <div className="grid gap-6 xl:grid-cols-[.72fr_1.28fr]"><section className="mx-auto w-full max-w-[430px] rounded-[2.5rem] border-[7px] border-zinc-800 bg-black p-3 shadow-2xl"><div className="rounded-[2rem] bg-[#0d0f12] p-4"><div className="flex items-center justify-between"><div><p className="text-[9px] font-black uppercase tracking-widest text-amber-300">Central GO Conductor</p><h2 className="mt-1 text-lg font-black text-white">{taxi?.unit ?? 'Móvil 12'}</h2><p className="text-[9px] text-zinc-500">{taxi?.driver ?? 'Gustavo Rossi'} · GPS conectado</p></div><span className="flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-1 text-[8px] font-black text-emerald-300"><Wifi className="h-3 w-3" />ONLINE</span></div><div className="mt-4 grid grid-cols-3 gap-2"><div className="rounded-xl bg-zinc-950 p-2 text-center"><p className="text-[7px] text-zinc-600">Estado</p><p className="mt-1 text-[9px] font-black text-emerald-300">{taxi ? statusLabel[taxi.status] : 'Libre'}</p></div><div className="rounded-xl bg-zinc-950 p-2 text-center"><p className="text-[7px] text-zinc-600">GPS</p><p className="mt-1 text-[9px] font-black text-blue-300">ACTIVO</p></div><div className="rounded-xl bg-zinc-950 p-2 text-center"><p className="text-[7px] text-zinc-600">Velocidad</p><p className="mt-1 text-[9px] font-black text-white">{taxi?.speed ?? 0} km/h</p></div></div>{active ? <div className="mt-4 rounded-2xl border border-amber-500/25 bg-amber-500/[0.06] p-4"><div className="flex items-center justify-between"><span className="text-[8px] font-black uppercase tracking-widest text-amber-300">Servicio {active.code}</span><span className="text-[8px] font-black text-zinc-500">{active.status === 'en_route' ? 'IR A PASAJERO' : 'EN VIAJE'}</span></div><p className="mt-3 text-sm font-black text-white">{active.client}</p><div className="mt-3 space-y-2 text-[9px]"><p className="flex gap-2 text-zinc-400"><MapPin className="h-3.5 w-3.5 shrink-0 text-emerald-300" />{active.origin.address}</p><p className="flex gap-2 text-zinc-400"><Navigation className="h-3.5 w-3.5 shrink-0 text-blue-300" />{active.destination.address}</p></div><div className="mt-4 grid grid-cols-2 gap-2">{active.status === 'en_route' && <><button onClick={() => onReject(active.id)} className="rounded-xl border border-rose-500/20 bg-rose-500/10 px-3 py-3 text-[9px] font-black text-rose-300">Rechazar</button><button onClick={() => onStartTrip(active.id)} className="rounded-xl bg-emerald-500 px-3 py-3 text-[9px] font-black text-zinc-950">Pasajero a bordo</button></>}{active.status === 'in_progress' && <button className="col-span-2 rounded-xl bg-blue-600 px-3 py-3 text-[9px] font-black text-white"><Navigation className="mr-1 inline h-3.5 w-3.5" />Navegar al destino</button>}</div></div> : <div className="mt-4 rounded-2xl border border-zinc-800 bg-zinc-950 p-8 text-center"><Car className="mx-auto h-8 w-8 text-zinc-700" /><p className="mt-3 text-xs font-black text-zinc-400">Esperando servicio</p><p className="mt-1 text-[9px] text-zinc-600">La central enviará aquí la próxima carrera.</p></div>}<button className="mt-4 w-full rounded-xl border border-rose-500/25 bg-rose-500/10 px-4 py-3 text-[9px] font-black text-rose-300">SOS DE EMERGENCIA</button></div></section><section className="space-y-4"><div><div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-blue-300"><Smartphone className="h-4 w-4" />App independiente del conductor</div><h1 className="mt-1 text-2xl font-black text-white">El conductor recibe solo lo que necesita</h1><p className="mt-2 max-w-3xl text-xs leading-relaxed text-zinc-500">Cada móvil queda vinculado a su usuario. GPS, estado y carrera se sincronizan sin pedir por radio ubicación, dirección o confirmaciones repetitivas.</p></div><div className="grid gap-3 sm:grid-cols-2"><Feature title="GPS continuo" detail="La central ve posición, rumbo y última actividad del móvil." icon={MapPin} /><Feature title="Carrera en el teléfono" detail="Origen, destino, cliente, valor estimado y método de pago." icon={Navigation} /><Feature title="Estados claros" detail="Libre, en camino, en viaje, pausa y fuera de servicio." icon={Gauge} /><Feature title="SOS" detail="Alerta prioritaria asociada al conductor y ubicación." icon={ShieldCheck} /></div><div className="rounded-2xl border border-zinc-800 bg-[#0d0f12] p-5"><h3 className="text-sm font-black text-white">Qué deja de preguntar la radio</h3><div className="mt-3 grid gap-2 sm:grid-cols-2">{['¿Dónde está el móvil?','¿Recibió la dirección?','¿Llegó al pasajero?','¿Inició la carrera?','¿Terminó el viaje?','¿Quedó libre?'].map((item) => <div key={item} className="flex items-center gap-2 rounded-xl bg-zinc-950 p-3 text-[10px] text-zinc-400"><Check className="h-3.5 w-3.5 text-emerald-300" />{item}</div>)}</div></div><button onClick={onGoOperator} className="rounded-xl bg-amber-400 px-4 py-3 text-xs font-black text-zinc-950">Ver lo mismo desde la central</button></section></div>;
};

const AdminDemo: React.FC<{ taxis: DemoTaxi[]; trips: DemoTrip[]; onView: (view: DemoView) => void }> = ({ taxis, trips, onView }) => <div className="space-y-5"><div><div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-blue-300"><Building2 className="h-4 w-4" />Administrador de la empresa</div><h1 className="mt-1 text-2xl font-black text-white">Control de la central, usuarios y operación</h1><p className="mt-1 text-xs text-zinc-500">Esta es la vista que recibe el dueño o administrador de cada empresa.</p></div><div className="grid grid-cols-2 gap-3 xl:grid-cols-4"><Kpi label="Móviles registrados" value={String(taxis.length)} detail={`${taxis.filter((taxi) => taxi.status !== 'available').length} actualmente en servicio`} icon={Car} /><Kpi label="Usuarios" value="7" detail="1 admin · 2 operadoras · 4 conductores" icon={UsersRound} tone="text-purple-300" /><Kpi label="Carreras hoy" value={String(Math.max(34, trips.length + 31))} detail={`${trips.filter((trip) => trip.status === 'completed').length} completadas en demo`} icon={Navigation} tone="text-emerald-300" /><Kpi label="Plan actual" value="PRO" detail="App conductor + GPS + reportes" icon={Crown} tone="text-amber-300" /></div><div className="grid gap-4 lg:grid-cols-3">{[
  ['Usuarios y permisos','Invitar operadoras y conductores, activar/suspender accesos.',UsersRound],
  ['Conductores','Documentos, móvil asignado, estado y actividad.',UserRound],
  ['Vehículos','Patente, modelo, inspección, características y estado.',Car],
  ['Tarifas y zonas','Bajada de bandera, kilómetro, espera y zonas especiales.',BadgeDollarSign],
  ['Reportes','Carreras, tiempos de despacho, facturación y actividad por hora.',LayoutDashboard],
  ['Configuración','Datos de central, ciudad, soporte, preferencias y seguridad.',ShieldCheck],
].map(([title, detail, Icon]) => { const C = Icon as React.ComponentType<{ className?: string }>; return <div key={String(title)} className="rounded-2xl border border-zinc-800 bg-[#0d0f12] p-5"><C className="h-5 w-5 text-blue-300" /><p className="mt-3 text-sm font-black text-white">{String(title)}</p><p className="mt-1 text-[10px] leading-relaxed text-zinc-500">{String(detail)}</p><span className="mt-4 inline-flex rounded-lg border border-zinc-800 bg-zinc-950 px-2.5 py-2 text-[9px] font-black text-zinc-500">Incluido en panel administrador</span></div>; })}</div><section className="rounded-2xl border border-zinc-800 bg-[#0d0f12] p-5"><div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center"><div><p className="text-sm font-black text-white">Supervisión de la operación</p><p className="mt-1 text-[10px] text-zinc-500">El administrador puede revisar cómo trabaja la operadora y cómo recibe el servicio el conductor.</p></div><div className="flex flex-wrap gap-2"><button onClick={() => onView('operator')} className="rounded-xl bg-amber-400 px-4 py-3 text-[10px] font-black text-zinc-950">Ver como operadora</button><button onClick={() => onView('driver')} className="rounded-xl border border-blue-500/25 bg-blue-500/10 px-4 py-3 text-[10px] font-black text-blue-300">Ver app conductor</button><button onClick={() => onView('plans')} className="rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-[10px] font-black text-zinc-300">Comparar planes</button></div></div></section></div>;

const SalesPartnerDemo: React.FC<{ onPlans: () => void }> = ({ onPlans }) => <div className="space-y-5"><div><div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-amber-300"><Store className="h-4 w-4" />Partner comercial</div><h1 className="mt-1 text-2xl font-black text-white">Herramientas para vender Central GO</h1><p className="mt-1 text-xs text-zinc-500">Cartera, precios, registro de centrales y comisión sobre suscripciones reales.</p></div><div className="grid grid-cols-2 gap-3 xl:grid-cols-4"><Kpi label="Centrales en cartera" value="8" detail="6 activas · 2 en prueba" icon={Building2} /><Kpi label="Valor mensual" value="$1.248.000" detail="equivalente de suscripciones" icon={BadgeDollarSign} tone="text-emerald-300" /><Kpi label="Comisión directa" value="20%" detail="sobre ventas atribuidas" icon={Crown} tone="text-amber-300" /><Kpi label="Disponible" value="$196.400" detail="para próxima liquidación" icon={CheckCircle2} tone="text-purple-300" /></div><section className="grid gap-4 lg:grid-cols-[1fr_1fr]"><div className="rounded-2xl border border-zinc-800 bg-[#0d0f12] p-5"><h2 className="text-sm font-black text-white">Flujo de venta</h2><div className="mt-4 space-y-2">{['Mostrar Modo Demo al cliente','Comparar Start / Pro / Enterprise','Registrar la nueva central','Asignar plan y período de prueba','Invitar al administrador de la central','Seguir estado de la suscripción y comisión'].map((step, index) => <div key={step} className="flex items-center gap-3 rounded-xl bg-zinc-950 p-3"><span className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-400 text-[9px] font-black text-zinc-950">{index + 1}</span><span className="text-[10px] font-bold text-zinc-300">{step}</span></div>)}</div></div><div className="rounded-2xl border border-amber-500/20 bg-amber-500/[0.04] p-5"><p className="text-[9px] font-black uppercase tracking-widest text-amber-300">Herramienta frente al cliente</p><h2 className="mt-2 text-lg font-black text-white">Planes claros, con ✓ y ✕</h2><p className="mt-2 text-[10px] leading-relaxed text-zinc-500">El partner puede mostrar exactamente qué obtiene cada central. Enterprise se destaca como la opción de máxima capacidad.</p><button onClick={onPlans} className="mt-5 rounded-xl bg-amber-400 px-4 py-3 text-xs font-black text-zinc-950">Abrir planes y valores</button></div></section></div>;

const RegionalPartnerDemo: React.FC<{ onPlans: () => void }> = ({ onPlans }) => <div className="space-y-5"><div><div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-purple-300"><UsersRound className="h-4 w-4" />Partner regional</div><h1 className="mt-1 text-2xl font-black text-white">Territorio, equipo comercial y cartera regional</h1><p className="mt-1 text-xs text-zinc-500">El regional supervisa comerciales vinculados a su territorio sin acceder a administración global.</p></div><div className="grid grid-cols-2 gap-3 xl:grid-cols-4"><Kpi label="Territorio" value="Maule" detail="Chile · región asignada" icon={MapPin} /><Kpi label="Partners comerciales" value="5" detail="4 activos · 1 onboarding" icon={UsersRound} tone="text-purple-300" /><Kpi label="Centrales regionales" value="23" detail="19 activas · 4 en prueba" icon={Building2} tone="text-blue-300" /><Kpi label="Comisión regional" value="5%" detail="sobre cartera atribuida al equipo" icon={BadgeDollarSign} tone="text-amber-300" /></div><div className="grid gap-4 lg:grid-cols-[1.2fr_.8fr]"><section className="overflow-hidden rounded-2xl border border-zinc-800 bg-[#0d0f12]"><div className="border-b border-zinc-800 p-4"><h2 className="text-sm font-black text-white">Equipo comercial</h2><p className="text-[9px] text-zinc-600">Ejemplo de cómo se ve la estructura Regional → Comercial → Centrales.</p></div>{[['Diego Carrasco','Talca','6','$886.000'],['Carolina Muñoz','Linares','5','$742.000'],['Tomás Reyes','Curicó','4','$598.000'],['Fernanda Silva','Cauquenes','3','$447.000'],['Matías López','Parral','1','$149.000']].map(([name,city,centrals,portfolio]) => <div key={name} className="grid grid-cols-[1fr_.8fr_.5fr_.7fr] items-center border-b border-zinc-900 p-3 text-[9px]"><div><p className="font-black text-white">{name}</p><p className="text-zinc-600">Partner comercial</p></div><span className="text-zinc-400">{city}</span><span className="font-black text-blue-300">{centrals}</span><span className="text-right font-black text-emerald-300">{portfolio}</span></div>)}</section><section className="rounded-2xl border border-purple-500/20 bg-purple-500/[0.04] p-5"><p className="text-[9px] font-black uppercase tracking-widest text-purple-300">Función regional</p><div className="mt-4 space-y-3">{['Visualizar equipo y territorios','Acompañar ventas y onboarding','Revisar centrales activas / en prueba','Consultar comisiones regionales','Acceder al comparador comercial de planes'].map((item) => <div key={item} className="flex gap-2 text-[10px] text-zinc-400"><Check className="h-4 w-4 shrink-0 text-purple-300" />{item}</div>)}</div><button onClick={onPlans} className="mt-5 w-full rounded-xl bg-purple-600 px-4 py-3 text-[10px] font-black text-white">Ver catálogo comercial</button></section></div></div>;

const PlansDemo: React.FC<{ onView: (view: DemoView) => void }> = ({ onView }) => <div className="space-y-5"><div className="text-center"><div className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-amber-300"><BadgeDollarSign className="h-4 w-4" />Planes Central GO</div><h1 className="mt-2 text-3xl font-black text-white">Una propuesta clara para cada tamaño de central</h1><p className="mx-auto mt-2 max-w-3xl text-xs leading-relaxed text-zinc-500">Valores de lista mensual y promoción anual. Las ✕ hacen visible lo que el cliente gana al subir de plan.</p></div><div className="grid gap-4 xl:grid-cols-3">{plans.map((plan) => <section key={plan.name} className={`relative rounded-3xl border p-5 ${plan.featured ? 'border-amber-400/50 bg-gradient-to-b from-amber-500/[0.10] to-[#0d0f12] shadow-2xl shadow-amber-950/20' : 'border-zinc-800 bg-[#0d0f12]'}`}>{plan.featured && <span className="absolute right-4 top-4 rounded-full bg-amber-400 px-3 py-1 text-[8px] font-black uppercase text-zinc-950">Recomendado</span>}<p className={`text-sm font-black ${plan.featured ? 'text-amber-300' : 'text-white'}`}>{plan.name}</p><p className="mt-2 min-h-10 text-[10px] leading-relaxed text-zinc-500">{plan.description}</p><div className="mt-5"><p className="text-[9px] font-black uppercase tracking-widest text-zinc-600">Mensual</p><p className="mt-1 text-3xl font-black text-white">{formatMoney(plan.monthly)}<span className="text-xs font-bold text-zinc-600"> / mes</span></p><div className="mt-3 rounded-xl border border-emerald-500/20 bg-emerald-500/[0.05] p-3"><p className="text-[8px] font-black uppercase tracking-widest text-emerald-300">Plan anual promocional</p><p className="mt-1 text-lg font-black text-emerald-200">{formatMoney(plan.annualEquivalent)}<span className="text-[9px] text-emerald-400/60"> / mes equivalente</span></p><p className="text-[8px] text-zinc-600">Facturado {formatMoney(plan.annualTotal)} al año</p></div></div><div className="mt-5 space-y-2">{plan.features.map((feature) => <div key={feature.label} className={`flex items-center gap-2 rounded-xl px-2.5 py-2 text-[9px] ${feature.highlight ? 'bg-amber-500/[0.06]' : ''}`}><span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${feature.enabled ? 'bg-emerald-500/10 text-emerald-300' : 'bg-rose-500/10 text-rose-300'}`}>{feature.enabled ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}</span><span className={feature.enabled ? 'font-bold text-zinc-300' : 'text-zinc-600'}>{feature.label}</span></div>)}</div></section>)}</div><section className="rounded-2xl border border-zinc-800 bg-[#0d0f12] p-5"><div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center"><div><p className="text-sm font-black text-white">Muéstrale primero la operación, después el plan</p><p className="mt-1 text-[10px] text-zinc-500">La demo permite enseñar por qué App Conductor, GPS, reportes y múltiples sedes tienen valor real antes de hablar del precio.</p></div><div className="flex flex-wrap gap-2"><button onClick={() => onView('operator')} className="rounded-xl bg-amber-400 px-4 py-3 text-[10px] font-black text-zinc-950">Ver operación</button><button onClick={() => onView('driver')} className="rounded-xl border border-blue-500/25 bg-blue-500/10 px-4 py-3 text-[10px] font-black text-blue-300">Ver App Conductor</button><button onClick={() => onView('sales_partner')} className="rounded-xl border border-purple-500/25 bg-purple-500/10 px-4 py-3 text-[10px] font-black text-purple-300">Ver Partner Comercial</button></div></div></section></div>;

const Feature: React.FC<{ title: string; detail: string; icon: React.ComponentType<{ className?: string }> }> = ({ title, detail, icon: Icon }) => <div className="rounded-2xl border border-zinc-800 bg-[#0d0f12] p-4"><Icon className="h-5 w-5 text-blue-300" /><p className="mt-3 text-xs font-black text-white">{title}</p><p className="mt-1 text-[10px] leading-relaxed text-zinc-500">{detail}</p></div>;

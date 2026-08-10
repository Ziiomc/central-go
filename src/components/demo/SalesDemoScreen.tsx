import React, { useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  ArrowLeft,
  BellRing,
  Car,
  CheckCircle2,
  Clock3,
  Gauge,
  MapPin,
  Navigation,
  Phone,
  Radio,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Timer,
  UserRound,
  Wifi,
  Zap,
} from 'lucide-react';
import centralGoLogo from '../../assets/images/central-go-logo.svg';
import { advanceAlongRoute, requestDrivingRoute, type RoadPoint } from '../../lib/roadRouting';

type DemoTaxiStatus = 'available' | 'en_route' | 'in_trip';
type DemoTripStatus = 'pending' | 'en_route' | 'in_progress' | 'completed';

type DemoTaxi = {
  id: string;
  unit: string;
  driver: string;
  phone: string;
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
  { id: 'demo-taxi-05', unit: 'Móvil 05', driver: 'Carlos Méndez', phone: '+56 9 6512 0905', status: 'available', position: { lat: -35.8470, lng: -71.5992 }, heading: 0, speed: 0 },
  { id: 'demo-taxi-12', unit: 'Móvil 12', driver: 'Gustavo Rossi', phone: '+56 9 6128 1812', status: 'available', position: { lat: -35.8434, lng: -71.5916 }, heading: 0, speed: 0 },
  { id: 'demo-taxi-18', unit: 'Móvil 18', driver: 'María Fuentes', phone: '+56 9 6128 1818', status: 'available', position: { lat: -35.8500, lng: -71.5955 }, heading: 0, speed: 0 },
  { id: 'demo-taxi-24', unit: 'Móvil 24', driver: 'Luis Sanhueza', phone: '+56 9 6128 1824', status: 'available', position: { lat: -35.8418, lng: -71.6010 }, heading: 0, speed: 0 },
  { id: 'demo-taxi-31', unit: 'Móvil 31', driver: 'Patricio Vera', phone: '+56 9 6128 1831', status: 'available', position: { lat: -35.8520, lng: -71.5889 }, heading: 0, speed: 0 },
];

const requestPool = [
  { client: 'Alejandro Martínez', phone: '+56 9 7654 0988', origin: { lat: -35.8454, lng: -71.5979, address: 'Plaza de Armas de Linares' }, destination: { lat: -35.8427, lng: -71.5886, address: 'Terminal de Buses de Linares' }, fare: 5200 },
  { client: 'Dra. Patricia Morales', phone: '+56 9 8712 3456', origin: { lat: -35.8484, lng: -71.5919, address: 'Calle Manuel Rodríguez 450' }, destination: { lat: -35.8491, lng: -71.6030, address: 'Hospital Base de Linares' }, fare: 4800 },
  { client: 'Gonzalo Fontana', phone: '+56 9 9876 5432', origin: { lat: -35.8481, lng: -71.5918, address: 'Población San Antonio' }, destination: { lat: -35.8454, lng: -71.5979, address: 'Centro de Linares' }, fare: 4100 },
  { client: 'Camila Rojas', phone: '+56 9 7441 2200', origin: { lat: -35.8516, lng: -71.5948, address: 'Estación de Trenes' }, destination: { lat: -35.8413, lng: -71.5923, address: 'Avenida León Bustos' }, fare: 5600 },
  { client: 'Rodrigo Leiva', phone: '+56 9 8110 7701', origin: { lat: -35.8427, lng: -71.5886, address: 'Terminal de Buses' }, destination: { lat: -35.8481, lng: -71.5918, address: 'San Antonio' }, fare: 4600 },
  { client: 'Valentina Soto', phone: '+56 9 6760 3112', origin: { lat: -35.8413, lng: -71.5923, address: 'Avenida León Bustos' }, destination: { lat: -35.8516, lng: -71.5948, address: 'Estación de Trenes' }, fare: 5900 },
];

const formatMoney = (value: number) => `$${Math.round(value).toLocaleString('es-CL')}`;
const formatTime = (value: string) => new Date(value).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });

const statusLabel: Record<DemoTaxiStatus, string> = {
  available: 'Libre',
  en_route: 'En camino',
  in_trip: 'En viaje',
};

const statusTone: Record<DemoTaxiStatus, string> = {
  available: 'border-emerald-500/25 bg-emerald-500/10 text-emerald-300',
  en_route: 'border-amber-500/25 bg-amber-500/10 text-amber-300',
  in_trip: 'border-blue-500/25 bg-blue-500/10 text-blue-300',
};

const distance = (a: RoadPoint, b: RoadPoint) => Math.hypot(a.lat - b.lat, a.lng - b.lng);

export const SalesDemoScreen: React.FC = () => {
  const [taxis, setTaxis] = useState<DemoTaxi[]>(initialTaxis);
  const [trips, setTrips] = useState<DemoTrip[]>([]);
  const [selectedTaxiId, setSelectedTaxiId] = useState<string | null>(null);
  const [selectedTripId, setSelectedTripId] = useState<string | null>(null);
  const [activity, setActivity] = useState<string>('Demo iniciada · Central GO está recibiendo solicitudes automáticamente.');
  const [clock, setClock] = useState(new Date());
  const [autoDemo, setAutoDemo] = useState(true);
  const [newRequestPulse, setNewRequestPulse] = useState(false);
  const requestCursorRef = useRef(0);
  const routeCursorRef = useRef<Record<string, number>>({});
  const routesRef = useRef<Record<string, RouteState>>({});
  const taxisRef = useRef(taxis);
  const tripsRef = useRef(trips);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<Record<string, L.Marker>>({});
  const routeLineRef = useRef<L.Polyline | null>(null);

  useEffect(() => { taxisRef.current = taxis; }, [taxis]);
  useEffect(() => { tripsRef.current = trips; }, [trips]);

  const appendActivity = (message: string) => setActivity(message);

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

  const assignTrip = (tripId: string) => {
    const trip = tripsRef.current.find((item) => item.id === tripId);
    if (!trip || trip.status !== 'pending') return;
    const free = taxisRef.current.filter((taxi) => taxi.status === 'available');
    if (!free.length) {
      appendActivity(`Sin móviles libres para ${trip.code}. La solicitud permanece en cola.`);
      return;
    }
    const taxi = [...free].sort((a, b) => distance(a.position, trip.origin) - distance(b.position, trip.origin))[0];
    setTrips((prev) => prev.map((item) => item.id === tripId ? { ...item, status: 'en_route', taxiId: taxi.id, unit: taxi.unit } : item));
    setTaxis((prev) => prev.map((item) => item.id === taxi.id ? { ...item, status: 'en_route', tripId } : item));
    appendActivity(`${trip.code} asignada automáticamente a ${taxi.unit} · móvil más cercano.`);
    void buildRoute(taxi.id, trip.origin, 'pickup', trip.id);
  };

  const addIncomingRequest = () => {
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
    };
    setTrips((prev) => [trip, ...prev].slice(0, 12));
    tripsRef.current = [trip, ...tripsRef.current].slice(0, 12);
    setSelectedTripId(id);
    setNewRequestPulse(true);
    window.setTimeout(() => setNewRequestPulse(false), 1600);
    appendActivity(`Nueva solicitud ${trip.code} · ${trip.client} · ${trip.origin.address}.`);
    window.setTimeout(() => assignTrip(id), 3500);
  };

  useEffect(() => {
    const clockTimer = window.setInterval(() => setClock(new Date()), 1000);
    return () => window.clearInterval(clockTimer);
  }, []);

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;
    const map = L.map(mapContainerRef.current, { center, zoom: 14, zoomControl: false });
    L.control.zoom({ position: 'bottomright' }).addTo(map);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; OpenStreetMap &copy; CARTO',
      maxZoom: 19,
      subdomains: 'abcd',
    }).addTo(map);
    map.on('click', () => setSelectedTaxiId(null));
    mapRef.current = map;
    const observer = new ResizeObserver(() => map.invalidateSize());
    observer.observe(mapContainerRef.current);
    window.setTimeout(() => map.invalidateSize(), 150);
    return () => {
      observer.disconnect();
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    taxis.forEach((taxi) => {
      const selected = taxi.id === selectedTaxiId;
      const tone = taxi.status === 'available' ? '#10b981' : taxi.status === 'en_route' ? '#f59e0b' : '#3b82f6';
      const html = `<div style="position:relative;transform:rotate(${taxi.heading}deg);transition:transform .4s ease"><div style="width:${selected ? 38 : 32}px;height:${selected ? 38 : 32}px;border-radius:12px;background:#09090b;border:2px solid ${tone};display:flex;align-items:center;justify-content:center;box-shadow:0 0 18px ${tone}55;font-size:17px">🚕</div></div><div style="position:absolute;left:50%;top:-22px;transform:translateX(-50%);white-space:nowrap;background:${tone};color:#050505;font-weight:900;font-size:10px;padding:3px 7px;border-radius:999px">${taxi.unit}</div>`;
      const icon = L.divIcon({ className: 'custom-taxi-pin', html, iconSize: [38, 48], iconAnchor: [19, 24] });
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
  }, [taxis, selectedTaxiId]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    routeLineRef.current?.remove();
    routeLineRef.current = null;
    if (!selectedTaxiId) return;
    const route = routesRef.current[selectedTaxiId];
    if (!route?.points?.length) return;
    routeLineRef.current = L.polyline(route.points.map((point) => [point.lat, point.lng] as [number, number]), {
      color: '#f59e0b', weight: 4, opacity: 0.75, dashArray: '7 7',
    }).addTo(map);
  }, [selectedTaxiId, taxis]);

  useEffect(() => {
    initialTaxis.forEach((taxi, index) => {
      routeCursorRef.current[taxi.id] = index % patrolPoints.length;
      void buildRoute(taxi.id, patrolPoints[(index + 1) % patrolPoints.length], 'patrol');
    });
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setTaxis((previous) => previous.map((taxi) => {
        const route = routesRef.current[taxi.id];
        if (!route || route.points.length < 2) return taxi;
        const speed = route.phase === 'patrol' ? 24 : 42;
        const advanced = advanceAlongRoute(route.points, route.index, route.offset, (speed / 3.6) * 0.9 * 4.6);
        route.index = advanced.index;
        route.offset = advanced.remainingOnSegmentMeters;
        const nextTaxi = { ...taxi, position: advanced.point, heading: advanced.heading, speed: advanced.finished ? 0 : speed };

        if (advanced.finished) {
          delete routesRef.current[taxi.id];
          if (route.phase === 'patrol') {
            window.setTimeout(() => sendTaxiToPatrol(taxi.id), 350);
          } else if (route.phase === 'pickup' && route.tripId) {
            setTrips((prev) => prev.map((trip) => trip.id === route.tripId ? { ...trip, status: 'in_progress' } : trip));
            const activeTrip = tripsRef.current.find((trip) => trip.id === route.tripId);
            if (activeTrip) {
              appendActivity(`${taxi.unit} llegó al pasajero · viaje ${activeTrip.code} iniciado.`);
              window.setTimeout(() => void buildRoute(taxi.id, activeTrip.destination, 'trip', activeTrip.id), 400);
            }
            return { ...nextTaxi, status: 'in_trip' as const };
          } else if (route.phase === 'trip' && route.tripId) {
            const activeTrip = tripsRef.current.find((trip) => trip.id === route.tripId);
            setTrips((prev) => prev.map((trip) => trip.id === route.tripId ? { ...trip, status: 'completed' } : trip));
            if (activeTrip) appendActivity(`${taxi.unit} finalizó ${activeTrip.code} · móvil nuevamente disponible.`);
            window.setTimeout(() => sendTaxiToPatrol(taxi.id), 400);
            return { ...nextTaxi, status: 'available' as const, tripId: undefined };
          }
        }
        return nextTaxi;
      }));
    }, 900);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    addIncomingRequest();
    const first = window.setTimeout(() => addIncomingRequest(), 6500);
    const timer = window.setInterval(() => {
      if (autoDemo) addIncomingRequest();
    }, 14500);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(timer);
    };
  }, [autoDemo]);

  const activeTrips = useMemo(() => trips.filter((trip) => trip.status !== 'completed'), [trips]);
  const completed = trips.filter((trip) => trip.status === 'completed').length;
  const pending = trips.filter((trip) => trip.status === 'pending').length;
  const free = taxis.filter((taxi) => taxi.status === 'available').length;
  const serving = taxis.filter((taxi) => taxi.status !== 'available').length;
  const selectedTaxi = taxis.find((taxi) => taxi.id === selectedTaxiId) ?? null;

  return (
    <div className="min-h-screen bg-[#070709] text-zinc-100 font-sans">
      <header className="sticky top-0 z-[1000] border-b border-zinc-800 bg-[#0a0a0c]/95 px-3 py-2.5 backdrop-blur md:px-5">
        <div className="mx-auto flex max-w-[1800px] items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <img src={centralGoLogo} alt="Central GO" className="h-10 w-10 rounded-xl border-2 border-amber-400/70 bg-zinc-950 p-0.5" />
            <div><div className="flex items-center gap-2"><span className="text-lg font-black">CENTRAL <span className="text-amber-400">GO</span></span><span className="rounded-full border border-purple-400/25 bg-purple-500/10 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-purple-300">Demo comercial</span></div><p className="hidden text-[9px] font-bold uppercase tracking-[0.16em] text-zinc-600 sm:block">Radiotaxis · despacho GPS · operación simulada</p></div>
          </div>
          <div className="flex items-center gap-2">
            <div className="hidden rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 lg:block"><p className="text-[8px] font-black uppercase tracking-widest text-emerald-400">Demo automática</p><p className="text-[10px] text-zinc-400">Pedidos y taxis se mueven en vivo</p></div>
            <button onClick={() => { window.location.href = '/'; }} className="inline-flex items-center gap-2 rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-xs font-black text-zinc-200 hover:bg-zinc-800"><ArrowLeft className="h-4 w-4" />Acceso oficial</button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1800px] p-2.5 md:p-4">
        <div className="mb-3 flex flex-col gap-2 rounded-2xl border border-purple-500/20 bg-gradient-to-r from-purple-500/10 via-zinc-950 to-amber-500/10 p-3 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3"><div className="rounded-xl border border-purple-400/20 bg-purple-500/10 p-2 text-purple-300"><Sparkles className="h-5 w-5" /></div><div><p className="text-sm font-black text-white">Así opera una central con Central GO</p><p className="text-[11px] text-zinc-500">Datos 100% simulados y aislados. Puedes tocar móviles, revisar la cola y crear una solicitud demo sin afectar ninguna central real.</p></div></div>
          <div className="flex items-center gap-2"><button onClick={() => setAutoDemo((value) => !value)} className={`rounded-xl border px-3 py-2 text-[10px] font-black ${autoDemo ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-300' : 'border-zinc-700 bg-zinc-900 text-zinc-400'}`}>{autoDemo ? '● DEMO EN VIVO' : '○ AUTO PAUSADA'}</button><button onClick={addIncomingRequest} className="inline-flex items-center gap-2 rounded-xl bg-amber-400 px-3 py-2 text-[10px] font-black text-zinc-950"><Zap className="h-3.5 w-3.5" />Simular pedido</button></div>
        </div>

        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          {[
            { label: 'Móviles libres', value: free, icon: Car, text: 'disponibles ahora', tone: 'text-emerald-400' },
            { label: 'En servicio', value: serving, icon: Navigation, text: 'en camino o carrera', tone: 'text-blue-400' },
            { label: 'Por asignar', value: pending, icon: BellRing, text: 'solicitudes en cola', tone: pending ? 'text-amber-400' : 'text-zinc-400' },
            { label: 'Finalizadas', value: completed, icon: CheckCircle2, text: 'durante esta demo', tone: 'text-purple-400' },
          ].map(({ label, value, icon: Icon, text, tone }) => <div key={label} className="rounded-2xl border border-zinc-800 bg-[#0d0d0f] p-3"><div className="flex items-center justify-between"><p className="text-[9px] font-black uppercase tracking-widest text-zinc-600">{label}</p><Icon className={`h-4 w-4 ${tone}`} /></div><div className="mt-1 flex items-end gap-2"><span className="text-2xl font-black text-white">{value}</span><span className="pb-1 text-[9px] text-zinc-600">{text}</span></div></div>)}
        </div>

        <div className="mt-3 grid gap-3 xl:grid-cols-[500px_minmax(0,1fr)]">
          <section className={`overflow-hidden rounded-2xl border bg-[#0d0d0f] ${newRequestPulse ? 'border-amber-400/70 shadow-lg shadow-amber-950/20' : 'border-zinc-800'}`}>
            <div className="flex items-center justify-between border-b border-zinc-800 px-3 py-3"><div><div className="flex items-center gap-2"><h2 className="text-sm font-black text-white">Cola de despacho</h2>{pending > 0 && <span className="rounded-full bg-amber-400 px-2 py-0.5 text-[9px] font-black text-zinc-950">{pending} por asignar</span>}</div><p className="mt-1 text-[9px] text-zinc-600">Solicitudes nuevas primero · asignación GPS automática</p></div><div className="text-right"><p className="font-mono text-sm font-black text-zinc-300">{clock.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</p><p className="text-[8px] uppercase text-zinc-600">Central Linares</p></div></div>
            <div className="max-h-[545px] overflow-y-auto">
              {activeTrips.length === 0 ? <div className="p-8 text-center"><RefreshCw className="mx-auto h-6 w-6 animate-spin text-zinc-700" /><p className="mt-3 text-xs font-bold text-zinc-500">Esperando próxima solicitud demo…</p></div> : activeTrips.map((trip) => <button key={trip.id} onClick={() => setSelectedTripId((current) => current === trip.id ? null : trip.id)} className={`w-full border-b border-zinc-900 p-3 text-left transition hover:bg-zinc-900/70 ${selectedTripId === trip.id ? 'bg-blue-500/[0.08]' : ''}`}><div className="flex items-start gap-3"><div className="w-12 shrink-0"><p className="font-mono text-[11px] font-black text-zinc-200">{formatTime(trip.createdAt)}</p><p className="mt-1 text-[8px] text-zinc-600">{trip.code}</p></div><div className="min-w-0 flex-1"><div className="flex items-center justify-between gap-2"><p className="truncate text-xs font-black text-white">{trip.client}</p><span className={`rounded-full px-2 py-0.5 text-[8px] font-black uppercase ${trip.status === 'pending' ? 'bg-amber-500/15 text-amber-300' : trip.status === 'en_route' ? 'bg-blue-500/15 text-blue-300' : 'bg-purple-500/15 text-purple-300'}`}>{trip.status === 'pending' ? 'Pendiente' : trip.status === 'en_route' ? trip.unit : 'En viaje'}</span></div><p className="mt-1 truncate text-[10px] font-semibold text-zinc-400"><MapPin className="mr-1 inline h-3 w-3 text-emerald-400" />{trip.origin.address}</p><p className="mt-1 truncate text-[9px] text-zinc-600">→ {trip.destination.address} · {formatMoney(trip.fare)}</p></div></div></button>)}
            </div>
            <div className="border-t border-zinc-800 bg-zinc-950/50 px-3 py-2.5"><p className="flex items-center gap-2 text-[10px] text-zinc-400"><Radio className="h-3.5 w-3.5 text-amber-400" /><span className="font-bold text-zinc-300">Actividad:</span><span className="truncate">{activity}</span></p></div>
          </section>

          <section className="overflow-hidden rounded-2xl border border-zinc-800 bg-[#0d0d0f]">
            <div className="flex flex-col gap-2 border-b border-zinc-800 px-3 py-3 sm:flex-row sm:items-center sm:justify-between"><div><div className="flex items-center gap-2"><h2 className="text-sm font-black text-white">Mapa operativo</h2><span className="flex items-center gap-1 text-[9px] font-black text-emerald-400"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />EN LÍNEA</span></div><p className="mt-1 text-[9px] text-zinc-600">Móviles siguen rutas vehiculares reales · selecciona un taxi para ver su recorrido</p></div><div className="flex gap-2"><span className="rounded-lg border border-zinc-800 bg-zinc-950 px-2 py-1 text-[9px] font-bold text-zinc-500"><Wifi className="mr-1 inline h-3 w-3 text-emerald-400" />5 conectados</span><span className="rounded-lg border border-zinc-800 bg-zinc-950 px-2 py-1 text-[9px] font-bold text-zinc-500"><Timer className="mr-1 inline h-3 w-3" />GPS &lt; 3 s</span></div></div>
            <div className="relative h-[545px] bg-zinc-950"><div ref={mapContainerRef} className="h-full w-full" />{selectedTaxi && <div className="absolute left-3 top-3 z-[800] w-[230px] rounded-2xl border border-zinc-700 bg-zinc-950/95 p-3 shadow-2xl backdrop-blur"><div className="flex items-center justify-between"><div><p className="text-xs font-black text-white">{selectedTaxi.unit}</p><p className="text-[9px] text-zinc-500">{selectedTaxi.driver}</p></div><span className={`rounded-full border px-2 py-1 text-[8px] font-black ${statusTone[selectedTaxi.status]}`}>{statusLabel[selectedTaxi.status]}</span></div><div className="mt-3 grid grid-cols-2 gap-2 text-[9px]"><div className="rounded-lg bg-zinc-900 p-2"><Gauge className="mb-1 h-3.5 w-3.5 text-blue-400" /><span className="font-black text-zinc-200">{selectedTaxi.speed} km/h</span></div><div className="rounded-lg bg-zinc-900 p-2"><Wifi className="mb-1 h-3.5 w-3.5 text-emerald-400" /><span className="font-black text-zinc-200">GPS activo</span></div></div><div className="mt-2 flex gap-2"><button className="flex flex-1 items-center justify-center gap-1 rounded-lg border border-zinc-800 bg-zinc-900 py-2 text-[9px] font-black text-zinc-300"><Phone className="h-3 w-3" />Llamar</button><button className="flex flex-1 items-center justify-center gap-1 rounded-lg border border-amber-500/20 bg-amber-500/10 py-2 text-[9px] font-black text-amber-300"><Radio className="h-3 w-3" />VHF</button></div></div>}</div>
          </section>
        </div>

        <section className="mt-3 overflow-hidden rounded-2xl border border-zinc-800 bg-[#0d0d0f]">
          <div className="flex items-center justify-between border-b border-zinc-800 px-3 py-3"><div><h2 className="text-sm font-black text-white">Control de móviles</h2><p className="mt-1 text-[9px] text-zinc-600">Estado, conductor, conexión y actividad GPS en una sola vista</p></div><span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-[9px] font-black text-emerald-300">{taxis.length} móviles demo</span></div>
          <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left"><thead className="bg-zinc-950/70 text-[8px] font-black uppercase tracking-wider text-zinc-600"><tr><th className="px-3 py-2.5">Turno</th><th className="px-3 py-2.5">Móvil / conductor</th><th className="px-3 py-2.5">Estado</th><th className="px-3 py-2.5">Velocidad</th><th className="px-3 py-2.5">Conexión</th><th className="px-3 py-2.5">Acción</th></tr></thead><tbody>{taxis.map((taxi, index) => <tr key={taxi.id} className="border-t border-zinc-900 text-[10px]"><td className="px-3 py-3 font-mono font-black text-zinc-500">#{index + 1}</td><td className="px-3 py-3"><div className="flex items-center gap-2"><div className="rounded-lg border border-zinc-800 bg-zinc-900 p-1.5"><Car className="h-3.5 w-3.5 text-amber-400" /></div><div><p className="font-black text-white">{taxi.unit}</p><p className="text-[9px] text-zinc-600">{taxi.driver}</p></div></div></td><td className="px-3 py-3"><span className={`rounded-full border px-2 py-1 text-[8px] font-black ${statusTone[taxi.status]}`}>{statusLabel[taxi.status]}</span></td><td className="px-3 py-3 font-mono font-bold text-zinc-400">{taxi.speed} km/h</td><td className="px-3 py-3"><span className="flex items-center gap-1 font-bold text-emerald-400"><Wifi className="h-3.5 w-3.5" />App en línea</span></td><td className="px-3 py-3"><button onClick={() => { setSelectedTaxiId(taxi.id); mapRef.current?.setView([taxi.position.lat, taxi.position.lng], 16, { animate: true }); }} className="inline-flex items-center gap-1 rounded-lg border border-zinc-800 bg-zinc-900 px-2 py-1.5 font-black text-zinc-300 hover:text-white"><Navigation className="h-3 w-3" />Ubicar</button></td></tr>)}</tbody></table></div>
        </section>

        <div className="mt-3 grid gap-2 md:grid-cols-3">
          <div className="rounded-2xl border border-zinc-800 bg-[#0d0d0f] p-3"><ShieldCheck className="h-5 w-5 text-emerald-400" /><p className="mt-2 text-xs font-black text-white">Separada de producción</p><p className="mt-1 text-[10px] leading-relaxed text-zinc-600">Esta demo no inicia sesión, no usa Supabase y nunca escribe carreras, usuarios ni GPS reales.</p></div>
          <div className="rounded-2xl border border-zinc-800 bg-[#0d0d0f] p-3"><Clock3 className="h-5 w-5 text-blue-400" /><p className="mt-2 text-xs font-black text-white">Entendible en minutos</p><p className="mt-1 text-[10px] leading-relaxed text-zinc-600">Un cliente puede observar desde la llamada hasta la asignación GPS, traslado, finalización y liberación del móvil.</p></div>
          <div className="rounded-2xl border border-amber-500/20 bg-amber-500/[0.06] p-3"><UserRound className="h-5 w-5 text-amber-400" /><p className="mt-2 text-xs font-black text-white">Pensada para vender</p><p className="mt-1 text-[10px] leading-relaxed text-zinc-500">La experiencia demuestra el valor operativo sin pedir credenciales ni revelar la administración interna de Central GO.</p></div>
        </div>
      </main>
    </div>
  );
};

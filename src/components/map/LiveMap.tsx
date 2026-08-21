import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { useApp } from '../../context/AppContext';
import { Driver, Trip, DriverStatus } from '../../types';
import { requestDrivingRoute, RoadPoint } from '../../lib/roadRouting';
import { isFlexibleDestinationAddress, isValidMapCoordinate } from '../../lib/flexibleDestination';
import { ShieldAlert, Navigation, Layers, Crosshair } from 'lucide-react';
import { useColorTheme } from '../../lib/theme';

const escapePopupText = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#039;' }[character] || character));

interface LiveMapProps {
  height?: string;
  onSelectDriver?: (driver: Driver | null) => void;
  selectedTrip?: Trip | null;
  focusDriverId?: string | null;
  focusDriverPoint?: { driverId:string; lat:number; lng:number } | null;
}

export const LiveMap: React.FC<LiveMapProps> = ({
  height = 'h-[500px]',
  onSelectDriver,
  selectedTrip,
  focusDriverId,
  focusDriverPoint,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersRef = useRef<{ [key: string]: L.Marker }>({});
  const tripPolylineRef = useRef<L.Polyline | null>(null);
  const approachPolylineRef = useRef<L.Polyline | null>(null);
  const tripMarkersRef = useRef<L.Marker[]>([]);
  const userGpsMarkerRef = useRef<L.Marker | null>(null);

  const { drivers, trips, activeSOSDriver, setNewTripModalOpen, setVHFModalDriver } = useApp();
  const { theme } = useColorTheme();
  const [tileMode, setTileMode] = useState<'dark' | 'street'>(theme === 'light' ? 'street' : 'dark');
  const [gpsStatusMsg, setGpsStatusMsg] = useState<string | null>(null);
  const [isLocatingGps, setIsLocatingGps] = useState<boolean>(false);

  const defaultCenter: [number, number] = [-35.8454, -71.5979];

  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;
    const map = L.map(mapContainerRef.current, { center: defaultCenter, zoom: 14, zoomControl: false });
    L.control.zoom({ position: 'bottomright' }).addTo(map);
    const initialTileUrl = tileMode === 'dark'
      ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
      : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
    L.tileLayer(initialTileUrl, {
      attribution: tileMode === 'dark' ? '&copy; CARTO' : '&copy; OpenStreetMap',
      maxZoom: 19,
      subdomains: 'abcd',
    }).addTo(map);
    mapInstanceRef.current = map;
    const clearDriverFocus = () => { map.closePopup(); onSelectDriver?.(null); };
    map.on('click', clearDriverFocus);
    setTimeout(() => map.invalidateSize(), 200);
    const resizeObserver = new ResizeObserver(() => mapInstanceRef.current?.invalidateSize());
    resizeObserver.observe(mapContainerRef.current);
    return () => {
      resizeObserver.disconnect();
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);
  useEffect(() => {
    setTileMode(theme === 'light' ? 'street' : 'dark');
  }, [theme]);


  const requestRealGPSLocation = () => {
    if (!navigator.geolocation) {
      setGpsStatusMsg('Geolocalización no soportada por el navegador. Usando Linares, Chile.');
      return;
    }
    setIsLocatingGps(true);
    setGpsStatusMsg('Obteniendo ubicación GPS en tiempo real...');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setIsLocatingGps(false);
        const { latitude, longitude } = position.coords;
        setGpsStatusMsg(`GPS Activo: ${latitude.toFixed(4)}, ${longitude.toFixed(4)}`);
        const map = mapInstanceRef.current;
        if (!map) return;
        map.setView([latitude, longitude], 16, { animate: true });
        const gpsIcon = L.divIcon({
          html: `<div class="relative flex items-center justify-center"><span class="animate-ping absolute inline-flex h-8 w-8 rounded-full bg-blue-400 opacity-75"></span><div class="relative px-2 py-1 rounded-full text-[10px] font-bold font-mono bg-blue-600 text-white border-2 border-white shadow-xl flex items-center gap-1"><span class="w-2 h-2 rounded-full bg-white"></span><span>MI GPS</span></div></div>`,
          className: 'custom-user-gps-pin', iconSize: [80, 32], iconAnchor: [40, 16],
        });
        if (userGpsMarkerRef.current) userGpsMarkerRef.current.setLatLng([latitude, longitude]);
        else userGpsMarkerRef.current = L.marker([latitude, longitude], { icon: gpsIcon }).addTo(map);
      },
      () => {
        setIsLocatingGps(false);
        setGpsStatusMsg('Permiso GPS no concedido. Centrado en Linares, Chile.');
        mapInstanceRef.current?.setView(defaultCenter, 14, { animate: true });
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
    );
  };

  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;
    map.eachLayer((layer) => { if (layer instanceof L.TileLayer) map.removeLayer(layer); });
    const url = tileMode === 'dark'
      ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
      : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
    L.tileLayer(url, { maxZoom: 19, attribution: tileMode === 'dark' ? '&copy; CARTO' : '&copy; OpenStreetMap' }).addTo(map);
  }, [tileMode]);

  const enableSmoothMarkerTransition = (marker: L.Marker) => {
    window.requestAnimationFrame(() => {
      const element = marker.getElement();
      if (element) { element.style.transition = 'transform 850ms linear'; element.style.willChange = 'transform'; }
    });
  };

  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;
    const filteredDrivers = drivers.filter((d) => filterStatus === 'all' || d.status === filterStatus);
    const activeIds = new Set(filteredDrivers.map((d) => d.id));
    Object.keys(markersRef.current).forEach((id) => {
      if (!activeIds.has(id)) { markersRef.current[id].remove(); delete markersRef.current[id]; }
    });

    filteredDrivers.forEach((driver) => {
      const { lat, lng } = driver.currentLocation;
      if (!isValidMapCoordinate(lat,lng)) return;
      let statusColor = '#10b981';
      let statusBadge = 'bg-emerald-500/95 text-slate-950 border-emerald-300 font-extrabold shadow-emerald-500/30';
      let haloGlow = 'rgba(16, 185, 129, 0.4)';
      let statusText = 'DISPONIBLE';
      let statusTone = 'available';
      if (driver.sosActive || driver.status === 'sos') {
        statusColor = '#ef4444'; statusBadge = 'bg-red-600 text-white border-red-300 animate-bounce shadow-red-500/50'; haloGlow = 'rgba(239, 68, 68, 0.8)'; statusText = 'SOS ALERTA';
      } else if (driver.status === 'en_route') {
        statusColor = '#f59e0b'; statusBadge = 'bg-amber-500/95 text-slate-950 border-amber-200 font-extrabold shadow-amber-500/30'; haloGlow = 'rgba(245, 158, 11, 0.5)'; statusText = 'EN CAMINO'; statusTone = 'en-route';
      } else if (driver.status === 'in_trip') {
        statusColor = '#3b82f6'; statusBadge = 'bg-blue-600 text-white border-blue-300 font-bold shadow-blue-500/30'; haloGlow = 'rgba(59, 130, 246, 0.5)'; statusText = 'EN VIAJE'; statusTone = 'in-trip';
      } else if (driver.status === 'paused') {
        statusColor = '#64748b'; statusBadge = 'bg-slate-700 text-slate-300 border-slate-600'; haloGlow = 'rgba(100, 116, 139, 0.2)'; statusText = 'PAUSADO'; statusTone = 'paused';
      } else if (driver.status === 'offline') {
        statusColor = '#ef4444'; statusBadge = 'bg-red-600 text-white border-red-300'; haloGlow = 'rgba(239, 68, 68, 0.38)'; statusText = 'DESCONECTADO'; statusTone = 'offline';
      }
      const heading = driver.currentLocation.heading || 0;
      const speed = driver.currentLocation.speed || 0;
      const customIcon = L.divIcon({
        html: `<div class="relative flex flex-col items-center justify-center group cursor-pointer pointer-events-auto" style="width:70px;height:70px"><div class="absolute -top-3 z-20 flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono border shadow-lg whitespace-nowrap ${statusBadge}"><span class="w-1.5 h-1.5 rounded-full" style="background-color:${statusColor}"></span><span>${driver.unitNumber}</span></div><div class="absolute inset-0 m-auto w-10 h-10 rounded-full" style="background:radial-gradient(circle,${haloGlow} 0%,transparent 70%)"></div><div class="relative z-10 w-10 h-10 flex items-center justify-center" style="transform:rotate(${heading}deg)"><svg viewBox="0 0 40 56" class="w-8 h-11 drop-shadow-[0_4px_8px_rgba(0,0,0,0.85)]"><rect x="5" y="8" width="4" height="9" rx="2" fill="#09090b"/><rect x="31" y="8" width="4" height="9" rx="2" fill="#09090b"/><rect x="5" y="38" width="4" height="9" rx="2" fill="#09090b"/><rect x="31" y="38" width="4" height="9" rx="2" fill="#09090b"/><rect x="8" y="4" width="24" height="48" rx="7" fill="#18181b" stroke="#27272a"/><path d="M 10 14 Q 20 12 30 14 L 29 42 Q 20 44 11 42 Z" fill="#eab308"/><path d="M 12 14 L 28 14 L 26 21 L 14 21 Z" fill="#0f172a"/><rect x="13" y="21" width="14" height="15" rx="2" fill="#facc15"/><rect x="14" y="26" width="12" height="5" rx="1" fill="#fff" stroke="#18181b"/><text x="20" y="29.8" font-size="3" font-weight="900" fill="#000" text-anchor="middle">TAXI</text><circle cx="11" cy="4" r="2" fill="#fef08a"/><circle cx="29" cy="4" r="2" fill="#fef08a"/><circle cx="11" cy="51" r="1.5" fill="#ef4444"/><circle cx="29" cy="51" r="1.5" fill="#ef4444"/></svg></div><div class="absolute top-12 z-30 hidden group-hover:flex flex-col items-center bg-slate-900/95 text-white border border-slate-700 px-2.5 py-1 rounded-lg text-[10px] font-mono shadow-2xl pointer-events-none whitespace-nowrap"><span class="font-bold text-amber-400">${driver.unitNumber} - ${driver.name}</span><span class="text-slate-300">${speed} km/h • ${statusText}</span></div></div>`,
        className: 'custom-taxi-pin', iconSize: [70, 70], iconAnchor: [35, 35],
      });
      const existing = markersRef.current[driver.id];
      if (existing) {
        existing.setIcon(customIcon); enableSmoothMarkerTransition(existing); existing.setLatLng([lat, lng]);
      } else {
        const marker = L.marker([lat, lng], { icon: customIcon }).addTo(map);
        const activeTrip = trips.find((trip) => trip.driverId === driver.id && !['completed', 'cancelled'].includes(trip.status));
        const buildDriverPopup = () => {
          const popupContent = document.createElement('div');
          const safeName = escapePopupText(driver.name);
          const safePhone = escapePopupText(driver.phone || 'Sin teléfono');
          const safeAddress = escapePopupText(driver.currentLocation.address || 'Ubicación GPS');
          const safeTripCode = activeTrip ? escapePopupText(activeTrip.code) : '';
          const safeClient = activeTrip ? escapePopupText(activeTrip.clientName) : '';
          const safeDestination = activeTrip ? escapePopupText(activeTrip.destination.address) : '';
          const lastUpdate = driver.currentLocation.lastUpdated
            ? new Date(driver.currentLocation.lastUpdated).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })
            : 'sin registro';
          popupContent.className = 'cg-map-popup';
          popupContent.innerHTML = \`
            <div class="cg-map-popup__head">
              <div class="cg-map-popup__identity">
                <div class="cg-map-popup__unit">\${escapePopupText(driver.unitNumber)}</div>
                <div class="cg-map-popup__person"><strong>\${safeName}</strong><span>Móvil conectado · \${safePhone}</span></div>
              </div>
              <span class="cg-map-popup__status cg-map-popup__status--\${statusTone}"><span></span>\${statusText}</span>
            </div>
            <div class="cg-map-popup__metrics">
              <div><small>VELOCIDAD</small><strong>\${speed} km/h</strong></div>
              <div><small>CALIFICACIÓN</small><strong>★ \${driver.rating.toFixed(1)}</strong></div>
              <div><small>VIAJES</small><strong>\${driver.totalTripsCompleted}</strong></div>
            </div>
            <div class="cg-map-popup__location"><span class="cg-map-popup__location-icon">⌖</span><div><small>UBICACIÓN ACTUAL · \${lastUpdate}</small><strong>\${safeAddress}</strong><span>GPS \${driver.currentLocation.lat.toFixed(5)}, \${driver.currentLocation.lng.toFixed(5)}</span></div></div>
            \${activeTrip
              ? \`<div class="cg-map-popup__trip"><small>EN OPERACIÓN · \${safeTripCode}</small><strong>\${safeClient}</strong><span>Destino: \${safeDestination}</span></div>\`
              : '<div class="cg-map-popup__trip cg-map-popup__trip--available"><small>OPERACIÓN</small><strong>Sin carrera activa</strong><span>Disponible para despacho</span></div>'}
            <div class="cg-map-popup__actions"><button id="btn-dispatch-\${driver.id}" class="cg-map-popup__action cg-map-popup__action--dispatch">Despachar</button><button id="btn-vhf-\${driver.id}" class="cg-map-popup__action cg-map-popup__action--radio">Radio VHF</button></div>
          \`;
          return popupContent;
        };
        const popupContent = buildDriverPopup();
        marker.bindPopup(popupContent);
        marker.on('popupopen', () => {
          const btnDispatch = document.getElementById(\`btn-dispatch-\${driver.id}\`);
          if (btnDispatch) btnDispatch.onclick = () => { onSelectDriver?.(driver); setNewTripModalOpen(true); };
          const btnVhf = document.getElementById(\`btn-vhf-\${driver.id}\`);
          if (btnVhf) btnVhf.onclick = () => setVHFModalDriver(driver);
        });
        markersRef.current[driver.id] = marker;
        enableSmoothMarkerTransition(marker);
      }
    });
  }, [drivers, trips, filterStatus, tileMode]);

  useEffect(() => {
    if (focusDriverId || !mapInstanceRef.current) return;
    mapInstanceRef.current.closePopup();
  }, [focusDriverId]);

  useEffect(() => {
    if (!focusDriverId || !mapInstanceRef.current) return;
    const driver = drivers.find((item) => item.id === focusDriverId);
    if (!driver) return;
    const point = focusDriverPoint?.driverId === driver.id
      ? focusDriverPoint
      : driver.currentLocation;
    if (!isValidMapCoordinate(point.lat,point.lng)) return;
    mapInstanceRef.current.setView([point.lat, point.lng], Math.max(mapInstanceRef.current.getZoom(), 16), { animate: true });
    markersRef.current[driver.id]?.openPopup();
  }, [focusDriverId, focusDriverPoint, drivers]);

  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;
    const abortController = new AbortController();
    tripPolylineRef.current?.remove(); tripPolylineRef.current = null;
    approachPolylineRef.current?.remove(); approachPolylineRef.current = null;
    tripMarkersRef.current.forEach((marker) => marker.remove()); tripMarkersRef.current = [];
    if (!selectedTrip) return () => abortController.abort();

    const originValid = isValidMapCoordinate(selectedTrip.origin.lat,selectedTrip.origin.lng);
    if (!originValid) return () => abortController.abort();
    const flexibleDestination = isFlexibleDestinationAddress(selectedTrip.destination.address);
    const destinationValid = !flexibleDestination && isValidMapCoordinate(selectedTrip.destination.lat,selectedTrip.destination.lng);
    const origin: RoadPoint = { lat: selectedTrip.origin.lat, lng: selectedTrip.origin.lng };
    const destination: RoadPoint | null = destinationValid ? { lat: selectedTrip.destination.lat, lng: selectedTrip.destination.lng } : null;
    const originIcon = L.divIcon({ html: `<div class="p-1.5 bg-emerald-500 text-slate-950 font-bold text-xs rounded-full border-2 border-white shadow-xl">A</div>`, className: 'orig-pin', iconSize: [24, 24], iconAnchor: [12, 12] });
    const destinationIcon = L.divIcon({ html: `<div class="p-1.5 bg-rose-500 text-white font-bold text-xs rounded-full border-2 border-white shadow-xl">B</div>`, className: 'dest-pin', iconSize: [24, 24], iconAnchor: [12, 12] });
    tripMarkersRef.current.push(L.marker([origin.lat, origin.lng], { icon: originIcon }).addTo(map));
    if (destination) tripMarkersRef.current.push(L.marker([destination.lat, destination.lng], { icon: destinationIcon }).addTo(map));

    const selectedDriver = selectedTrip.driverId ? drivers.find((driver) => driver.id === selectedTrip.driverId) : undefined;
    const driverPointValid = Boolean(selectedDriver && isValidMapCoordinate(selectedDriver.currentLocation.lat,selectedDriver.currentLocation.lng));
    const renderStreetRoutes = async () => {
      const passengerRoutePromise = destination ? requestDrivingRoute(origin, destination, abortController.signal) : Promise.resolve<RoadPoint[]>([]);
      const approachRoutePromise = selectedDriver && driverPointValid && ['assigned','en_route'].includes(selectedTrip.status)
        ? requestDrivingRoute({ lat:selectedDriver.currentLocation.lat, lng:selectedDriver.currentLocation.lng }, origin, abortController.signal)
        : Promise.resolve<RoadPoint[]>([]);
      try {
        const [passengerRoute, approachRoute] = await Promise.all([passengerRoutePromise,approachRoutePromise]);
        if (abortController.signal.aborted) return;
        if (passengerRoute.length > 1) {
          tripPolylineRef.current = L.polyline(passengerRoute.map((point) => [point.lat,point.lng] as [number,number]), { color:'#3b82f6', weight:5, opacity:.9 }).addTo(map);
        }
        if (approachRoute.length > 1) {
          approachPolylineRef.current = L.polyline(approachRoute.map((point) => [point.lat,point.lng] as [number,number]), { color:'#f59e0b', weight:4, dashArray:'9, 7', opacity:.9 }).addTo(map);
        }
        const allPoints = [...passengerRoute,...approachRoute];
        if (allPoints.length > 1) map.fitBounds(L.latLngBounds(allPoints.map((point) => [point.lat,point.lng])), { padding:[48,48], maxZoom:16 });
        else map.setView([origin.lat,origin.lng],15,{animate:true});
      } catch (error) {
        if (!abortController.signal.aborted) {
          console.warn('No fue posible dibujar la ruta callejera:',error);
          map.setView([origin.lat,origin.lng],15,{animate:true});
        }
      }
    };
    void renderStreetRoutes();
    return () => abortController.abort();
  }, [selectedTrip?.id,selectedTrip?.status,selectedTrip?.driverId,selectedTrip?.origin.lat,selectedTrip?.origin.lng,selectedTrip?.destination.address,selectedTrip?.destination.lat,selectedTrip?.destination.lng,drivers]);

  const focusOnSOS = () => {
    if (activeSOSDriver && mapInstanceRef.current && isValidMapCoordinate(activeSOSDriver.currentLocation.lat,activeSOSDriver.currentLocation.lng)) {
      mapInstanceRef.current.setView([activeSOSDriver.currentLocation.lat, activeSOSDriver.currentLocation.lng], 16, { animate:true });
    }
  };

  const centerFleet = () => {
    const validDrivers = drivers.filter((d) => isValidMapCoordinate(d.currentLocation.lat,d.currentLocation.lng));
    if (mapInstanceRef.current && validDrivers.length) {
      const bounds = L.latLngBounds(validDrivers.map((d) => [d.currentLocation.lat,d.currentLocation.lng]));
      mapInstanceRef.current.fitBounds(bounds,{padding:[40,40]});
    }
  };

  return <div className={`cg-live-map relative w-full ${height} rounded-2xl overflow-hidden border border-slate-800 bg-slate-900 shadow-2xl`} data-map-theme={theme === 'light' ? 'light' : 'dark'}>
    <div ref={mapContainerRef} className="w-full h-full z-0"/>
    <div className="absolute top-3 inset-x-3 z-10 flex flex-wrap lg:flex-nowrap items-center justify-between gap-2.5 pointer-events-none">
      <div className="flex flex-wrap items-center gap-1 bg-slate-950/90 backdrop-blur-md p-1.5 rounded-xl border border-slate-800 shadow-xl pointer-events-auto">
        <button onClick={() => setFilterStatus('all')} className={`px-3 py-1.5 text-xs font-semibold rounded-lg ${filterStatus==='all'?'bg-amber-500 text-slate-950 font-bold':'text-slate-300 hover:bg-slate-800'}`}>Todos ({drivers.length})</button>
        <button onClick={() => setFilterStatus('available')} className={`px-3 py-1.5 text-xs font-semibold rounded-lg flex items-center gap-1.5 ${filterStatus==='available'?'bg-emerald-500 text-slate-950 font-bold':'text-slate-300 hover:bg-slate-800'}`}><span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"/>Libres ({drivers.filter((d) => d.status==='available').length})</button>
        <button onClick={() => setFilterStatus('en_route')} className={`px-3 py-1.5 text-xs font-semibold rounded-lg ${filterStatus==='en_route'?'bg-amber-500 text-slate-950 font-bold':'text-slate-300 hover:bg-slate-800'}`}>En Camino ({drivers.filter((d) => d.status==='en_route').length})</button>
        <button onClick={() => setFilterStatus('in_trip')} className={`px-3 py-1.5 text-xs font-semibold rounded-lg ${filterStatus==='in_trip'?'bg-blue-500 text-white font-bold':'text-slate-300 hover:bg-slate-800'}`}>En Viaje ({drivers.filter((d) => d.status==='in_trip').length})</button>
      </div>
      <div className="flex flex-wrap items-center gap-2 pointer-events-auto ml-auto">
        {gpsStatusMsg&&<div className="bg-blue-950/90 text-blue-200 border border-blue-500/40 px-3 py-1.5 rounded-xl text-xs shadow-xl flex items-center gap-1.5"><Navigation className={`w-3.5 h-3.5 text-blue-400 ${isLocatingGps?'animate-spin':''}`}/><span>{gpsStatusMsg}</span></div>}
        {activeSOSDriver&&<button onClick={focusOnSOS} className="px-3 py-1.5 bg-red-600 text-white font-bold text-xs rounded-xl shadow-lg flex items-center gap-1.5 animate-pulse border border-red-400"><ShieldAlert className="w-4 h-4"/>Centrar SOS ({activeSOSDriver.unitNumber})</button>}
        <button onClick={requestRealGPSLocation} className="p-2 bg-slate-900/90 hover:bg-slate-800 text-slate-200 rounded-xl border border-slate-700 shadow-md" title="Mi ubicación"><Navigation className="w-4 h-4"/></button>
        <button onClick={centerFleet} className="p-2 bg-slate-900/90 hover:bg-slate-800 text-slate-200 rounded-xl border border-slate-700 shadow-md" title="Centrar flota"><Crosshair className="w-4 h-4"/></button>
        <button onClick={() => setTileMode(tileMode==='dark'?'street':'dark')} className="p-2 bg-slate-900/90 hover:bg-slate-800 text-slate-200 rounded-xl border border-slate-700 shadow-md" title="Cambiar mapa"><Layers className="w-4 h-4"/></button>
      </div>
    </div>
    <div className="absolute bottom-4 left-4 z-10 hidden sm:flex items-center gap-4 bg-slate-950/80 backdrop-blur-md px-4 py-2 rounded-xl border border-slate-800 text-xs font-mono text-slate-300 shadow-lg"><div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500"/>Disponible</div><div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-amber-500"/>En Camino</div><div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-blue-500"/>En Viaje</div></div>
  </div>;
};
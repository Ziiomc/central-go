import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { maplibreGL } from '@maplibre/maplibre-gl-leaflet';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useApp } from '../../context/AppContext';
import { Driver, Trip, DriverStatus } from '../../types';
import { requestDrivingRoute, RoadPoint } from '../../lib/roadRouting';
import { isFlexibleDestinationAddress, isValidMapCoordinate } from '../../lib/flexibleDestination';
import { ShieldAlert, Navigation, Layers, Crosshair } from 'lucide-react';
import { sendDriverRadioMessage } from '../../lib/driverOperations';
import { useColorTheme } from '../../lib/theme';

const escapePopupText = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#039;' }[character] || character));

const OPENFREEMAP_STYLES = {
  dark: 'https://tiles.openfreemap.org/styles/dark',
  street: 'https://tiles.openfreemap.org/styles/liberty',
} as const;

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
  const baseLayerRef = useRef<L.Layer | null>(null);
  const markersRef = useRef<{ [key: string]: L.Marker }>({});
  const tripPolylineRef = useRef<L.Polyline | null>(null);
  const approachPolylineRef = useRef<L.Polyline | null>(null);
  const tripMarkersRef = useRef<L.Marker[]>([]);
  const userGpsMarkerRef = useRef<L.Marker | null>(null);

  const { drivers, trips, vehicles, activeSOSDriver, setNewTripModalOpen, currentCompany, addAuditLog } = useApp();
  const { theme } = useColorTheme();
  const [tileMode, setTileMode] = useState<'dark' | 'street'>(theme === 'light' ? 'street' : 'dark');
  type MapFilterStatus = DriverStatus | 'assigned' | 'arrived' | 'all';
  const [filterStatus, setFilterStatus] = useState<MapFilterStatus>('all');
  const [gpsStatusMsg, setGpsStatusMsg] = useState<string | null>(null);
  const [isLocatingGps, setIsLocatingGps] = useState<boolean>(false);

  const defaultCenter: [number, number] = [-35.8454, -71.5979];

  type MapDriverStatus = DriverStatus | 'assigned' | 'arrived';
  const getMapDriverStatus = (driver: Driver, activeTrip?: Trip): MapDriverStatus => {
    if (driver.sosActive || driver.status === 'sos') return 'sos';
    if (activeTrip?.status === 'in_progress') return 'in_trip';
    if (activeTrip?.status === 'en_route') return 'en_route';
    if (activeTrip?.status === 'arrived') return 'arrived';
    if (activeTrip?.status === 'assigned') return 'assigned';
    if (driver.status === 'paused' || driver.status === 'offline' || driver.status === 'available') return driver.status;
    // A stale driver status must not present an unassigned/idle mobile as “En camino”.
    return 'available';
  };

  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;
    const map = L.map(mapContainerRef.current, { center: defaultCenter, zoom: 14, zoomControl: false });
    L.control.zoom({ position: 'bottomright' }).addTo(map);
    map.attributionControl.addAttribution('OpenFreeMap © OpenMapTiles · Datos © OpenStreetMap contributors');
    mapInstanceRef.current = map;
    const clearDriverFocus = () => { map.closePopup(); onSelectDriver?.(null); };
    map.on('click', clearDriverFocus);
    setTimeout(() => map.invalidateSize(), 200);
    const resizeObserver = new ResizeObserver(() => mapInstanceRef.current?.invalidateSize());
    resizeObserver.observe(mapContainerRef.current);
    return () => {
      resizeObserver.disconnect();
      baseLayerRef.current = null;
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
    baseLayerRef.current?.remove();
    baseLayerRef.current = maplibreGL({
      style: OPENFREEMAP_STYLES[tileMode],
      attributionControl: false,
    }).addTo(map);
    return () => {
      baseLayerRef.current?.remove();
      baseLayerRef.current = null;
    };
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
    const filteredDrivers = drivers.filter((d) => {
      const activeTrip = trips.find((trip) => trip.driverId === d.id && !['completed', 'cancelled'].includes(trip.status));
      const mapStatus = getMapDriverStatus(d, activeTrip);
      if (!activeTrip && (mapStatus === 'offline' || mapStatus === 'paused')) return false;
      return filterStatus === 'all' || mapStatus === filterStatus;
    });
    const activeIds = new Set(filteredDrivers.map((d) => d.id));
    Object.keys(markersRef.current).forEach((id) => {
      if (!activeIds.has(id)) { markersRef.current[id].remove(); delete markersRef.current[id]; }
    });

    filteredDrivers.forEach((driver) => {
      const { lat, lng } = driver.currentLocation;
      if (!isValidMapCoordinate(lat,lng)) return;
      const activeTrip = trips.find((trip) => trip.driverId === driver.id && !['completed', 'cancelled'].includes(trip.status));
      const vehicle = driver.vehicleId ? vehicles.find((item) => item.id === driver.vehicleId) : undefined;
      const mapStatus = getMapDriverStatus(driver, activeTrip);
      let statusColor = '#10b981';
      let statusBadge = 'bg-emerald-500/95 text-slate-950 border-emerald-300 font-extrabold shadow-emerald-500/30';
      let haloGlow = 'rgba(16, 185, 129, 0.4)';
      let statusText = 'DISPONIBLE';
      let statusTone = 'available';
      if (mapStatus === 'sos') {
        statusColor = '#ef4444'; statusBadge = 'bg-red-600 text-white border-red-300 animate-bounce shadow-red-500/50'; haloGlow = 'rgba(239, 68, 68, 0.8)'; statusText = 'SOS ALERTA'; statusTone = 'alert';
      } else if (mapStatus === 'assigned') {
        statusColor = '#8b5cf6'; statusBadge = 'bg-violet-500/95 text-white border-violet-300 font-extrabold shadow-violet-500/30'; haloGlow = 'rgba(139, 92, 246, 0.38)'; statusText = 'ASIGNADO'; statusTone = 'assigned';
      } else if (mapStatus === 'en_route') {
        statusColor = '#f59e0b'; statusBadge = 'bg-amber-500/95 text-slate-950 border-amber-200 font-extrabold shadow-amber-500/30'; haloGlow = 'rgba(245, 158, 11, 0.5)'; statusText = 'EN CAMINO'; statusTone = 'en-route';
      } else if (mapStatus === 'arrived') {
        statusColor = '#06b6d4'; statusBadge = 'bg-cyan-500/95 text-slate-950 border-cyan-200 font-extrabold shadow-cyan-500/30'; haloGlow = 'rgba(6, 182, 212, 0.42)'; statusText = 'EN DOMICILIO'; statusTone = 'arrived';
      } else if (mapStatus === 'in_trip') {
        statusColor = '#3b82f6'; statusBadge = 'bg-blue-600 text-white border-blue-300 font-bold shadow-blue-500/30'; haloGlow = 'rgba(59, 130, 246, 0.5)'; statusText = 'EN VIAJE'; statusTone = 'in-trip';
      } else if (mapStatus === 'paused') {
        statusColor = '#64748b'; statusBadge = 'bg-slate-700 text-slate-300 border-slate-600'; haloGlow = 'rgba(100, 116, 139, 0.2)'; statusText = 'PAUSADO'; statusTone = 'paused';
      } else if (mapStatus === 'offline') {
        statusColor = '#ef4444'; statusBadge = 'bg-red-600 text-white border-red-300'; haloGlow = 'rgba(239, 68, 68, 0.38)'; statusText = 'DESCONECTADO'; statusTone = 'offline';
      }
      const heading = driver.currentLocation.heading || 0;
      const speed = driver.currentLocation.speed || 0;
      const customIcon = L.divIcon({
        html: `<div class="relative flex flex-col items-center justify-center group cursor-pointer pointer-events-auto" style="width:70px;height:70px"><div class="absolute -top-3 z-20 flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono border shadow-lg whitespace-nowrap ${statusBadge}"><span class="w-1.5 h-1.5 rounded-full" style="background-color:${statusColor}"></span><span>${escapePopupText(driver.unitNumber)}</span></div><div class="absolute inset-0 m-auto w-10 h-10 rounded-full" style="background:radial-gradient(circle,${haloGlow} 0%,transparent 70%)"></div><div class="relative z-10 w-10 h-10 flex items-center justify-center" style="transform:rotate(${heading}deg)"><svg viewBox="0 0 40 56" class="w-8 h-11 drop-shadow-[0_4px_8px_rgba(0,0,0,0.85)]"><rect x="5" y="8" width="4" height="9" rx="2" fill="#09090b"/><rect x="31" y="8" width="4" height="9" rx="2" fill="#09090b"/><rect x="5" y="38" width="4" height="9" rx="2" fill="#09090b"/><rect x="31" y="38" width="4" height="9" rx="2" fill="#09090b"/><rect x="8" y="4" width="24" height="48" rx="7" fill="#18181b" stroke="#27272a"/><path d="M 10 14 Q 20 12 30 14 L 29 42 Q 20 44 11 42 Z" fill="#eab308"/><path d="M 12 14 L 28 14 L 26 21 L 14 21 Z" fill="#0f172a"/><rect x="13" y="21" width="14" height="15" rx="2" fill="#facc15"/><rect x="14" y="26" width="12" height="5" rx="1" fill="#fff" stroke="#18181b"/><text x="20" y="29.8" font-size="3" font-weight="900" fill="#000" text-anchor="middle">TAXI</text><circle cx="11" cy="4" r="2" fill="#fef08a"/><circle cx="29" cy="4" r="2" fill="#fef08a"/><circle cx="11" cy="51" r="1.5" fill="#ef4444"/><circle cx="29" cy="51" r="1.5" fill="#ef4444"/></svg></div><div class="absolute top-12 z-30 hidden min-w-[190px] group-hover:flex flex-col items-start bg-slate-900/95 text-white border border-slate-700 px-2.5 py-2 rounded-lg text-[10px] font-mono shadow-2xl pointer-events-none"><span class="font-bold text-amber-400">Móvil ${escapePopupText(driver.unitNumber)} · ${escapePopupText(driver.name)}</span><span class="mt-0.5 text-slate-300">${escapePopupText(driver.phone || 'Sin teléfono')}</span><span class="mt-0.5 text-slate-400">${vehicle?.licensePlate ? `Patente ${escapePopupText(vehicle.licensePlate)} · ` : ''}${speed} km/h · ${statusText}</span></div></div>`,
        className: 'custom-taxi-pin', iconSize: [70, 70], iconAnchor: [35, 35],
      });
      const buildDriverPopup = () => {
        const popupContent = document.createElement('div');
        const canDispatch = !activeTrip && mapStatus === 'available';
        const canMessage = Boolean(driver.userId);
        popupContent.className = 'cg-map-popup cg-map-popup--quick';
        popupContent.innerHTML = `
          <div style="width:230px;max-width:68vw;padding:2px 1px;color:#e4e4e7">
            <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:8px">
              <strong style="font-size:13px;color:white">Móvil ${escapePopupText(driver.unitNumber)}</strong>
              <span style="font-size:9px;font-weight:900;color:${statusColor}">${statusText}</span>
            </div>
            <div style="display:flex;gap:6px;margin-bottom:${canMessage ? '7px' : '0'}">
              ${canDispatch ? `<button id="btn-dispatch-${driver.id}" type="button" style="height:34px;flex:1;border:0;border-radius:9px;background:#2563eb;color:white;font-size:10px;font-weight:900;cursor:pointer">Despachar</button>` : ''}
              ${!canDispatch && activeTrip ? `<span style="font-size:9px;color:#a1a1aa">${escapePopupText(activeTrip.code)} · en carrera</span>` : ''}
            </div>
            ${canMessage ? `<form id="form-message-${driver.id}" style="display:flex;gap:5px"><input id="msg-input-${driver.id}" maxlength="180" autocomplete="off" placeholder="Escribir mensaje…" style="height:34px;min-width:0;flex:1;border:1px solid #3f3f46;border-radius:9px;background:#09090b;color:white;padding:0 9px;font-size:10px;outline:none"/><button id="btn-message-${driver.id}" type="submit" style="height:34px;border:0;border-radius:9px;background:#22d3ee;color:#083344;padding:0 10px;font-size:10px;font-weight:900;cursor:pointer">Enviar</button></form><div id="msg-status-${driver.id}" style="min-height:13px;margin-top:4px;font-size:8px;color:#a1a1aa">Enter para enviar</div>` : '<div style="font-size:9px;color:#f59e0b">Este móvil no tiene cuenta vinculada para mensajes.</div>'}
          </div>`;
        const dispatchButton = popupContent.querySelector<HTMLButtonElement>(`#btn-dispatch-${driver.id}`);
        if (dispatchButton) dispatchButton.onclick = () => {
          onSelectDriver?.(driver);
          setNewTripModalOpen(true);
          map.closePopup();
        };
        const form = popupContent.querySelector<HTMLFormElement>(`#form-message-${driver.id}`);
        const input = popupContent.querySelector<HTMLInputElement>(`#msg-input-${driver.id}`);
        const sendButton = popupContent.querySelector<HTMLButtonElement>(`#btn-message-${driver.id}`);
        const messageStatus = popupContent.querySelector<HTMLDivElement>(`#msg-status-${driver.id}`);
        if (form && input && sendButton && messageStatus) form.addEventListener('submit', (event) => {
          event.preventDefault();
          const message = input.value.trim();
          if (!message || sendButton.disabled) return;
          sendButton.disabled = true;
          messageStatus.textContent = 'Enviando…';
          void sendDriverRadioMessage(currentCompany.id, driver, message)
            .then(() => {
              addAuditLog('MENSAJE_MAPA', `Mensaje enviado desde mapa a Móvil ${driver.unitNumber}: "${message}"`);
              input.value = '';
              messageStatus.textContent = 'Mensaje enviado';
              messageStatus.style.color = '#6ee7b7';
            })
            .catch((error) => {
              messageStatus.textContent = error instanceof Error ? error.message : 'No fue posible enviar el mensaje.';
              messageStatus.style.color = '#fda4af';
            })
            .finally(() => { sendButton.disabled = false; });
        });
        return popupContent;
      };
      const existing = markersRef.current[driver.id];
      if (existing) {
        existing.setIcon(customIcon); existing.setLatLng([lat, lng]); existing.bindPopup(buildDriverPopup(), { maxWidth: 250, minWidth: 220 }); enableSmoothMarkerTransition(existing);
      } else {
        const marker = L.marker([lat, lng], { icon: customIcon }).addTo(map);
        marker.bindPopup(buildDriverPopup(), { maxWidth: 250, minWidth: 220 });
        markersRef.current[driver.id] = marker;
        enableSmoothMarkerTransition(marker);
      }
    });
  }, [drivers, trips, vehicles, filterStatus, tileMode]);

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
        <button onClick={() => setFilterStatus('available')} className={`px-3 py-1.5 text-xs font-semibold rounded-lg flex items-center gap-1.5 ${filterStatus==='available'?'bg-emerald-500 text-slate-950 font-bold':'text-slate-300 hover:bg-slate-800'}`}><span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"/>Libres ({drivers.filter((d) => getMapDriverStatus(d, trips.find((trip) => trip.driverId === d.id && !['completed', 'cancelled'].includes(trip.status)))==='available').length})</button>
        <button onClick={() => setFilterStatus('assigned')} className={`px-3 py-1.5 text-xs font-semibold rounded-lg ${filterStatus==='assigned'?'bg-violet-500 text-white font-bold':'text-slate-300 hover:bg-slate-800'}`}>Asignados ({drivers.filter((d) => getMapDriverStatus(d, trips.find((trip) => trip.driverId === d.id && !['completed', 'cancelled'].includes(trip.status)))==='assigned').length})</button>
        <button onClick={() => setFilterStatus('en_route')} className={`px-3 py-1.5 text-xs font-semibold rounded-lg ${filterStatus==='en_route'?'bg-amber-500 text-slate-950 font-bold':'text-slate-300 hover:bg-slate-800'}`}>En Camino ({drivers.filter((d) => getMapDriverStatus(d, trips.find((trip) => trip.driverId === d.id && !['completed', 'cancelled'].includes(trip.status)))==='en_route').length})</button>
        <button onClick={() => setFilterStatus('in_trip')} className={`px-3 py-1.5 text-xs font-semibold rounded-lg ${filterStatus==='in_trip'?'bg-blue-500 text-white font-bold':'text-slate-300 hover:bg-slate-800'}`}>En Viaje ({drivers.filter((d) => getMapDriverStatus(d, trips.find((trip) => trip.driverId === d.id && !['completed', 'cancelled'].includes(trip.status)))==='in_trip').length})</button>
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

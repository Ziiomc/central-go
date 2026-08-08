import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { useApp } from '../../context/AppContext';
import { Driver, Trip, DriverStatus } from '../../types';
import { speakVHFDispatch } from '../../lib/audioService';
import { requestDrivingRoute, RoadPoint } from '../../lib/roadRouting';
import { Radio, ShieldAlert, Navigation, Compass, Layers, Crosshair, Plus } from 'lucide-react';

interface LiveMapProps {
  height?: string;
  onSelectDriver?: (driver: Driver | null) => void;
  selectedTrip?: Trip | null;
  focusDriverId?: string | null;
}

export const LiveMap: React.FC<LiveMapProps> = ({
  height = 'h-[500px]',
  onSelectDriver,
  selectedTrip,
  focusDriverId,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersRef = useRef<{ [key: string]: L.Marker }>({});
  const tripPolylineRef = useRef<L.Polyline | null>(null);
  const approachPolylineRef = useRef<L.Polyline | null>(null);
  const tripMarkersRef = useRef<L.Marker[]>([]);

  const userGpsMarkerRef = useRef<L.Marker | null>(null);

  const { drivers, trips, activeSOSDriver, setNewTripModalOpen, setVHFModalDriver } = useApp();
  const [tileMode, setTileMode] = useState<'dark' | 'street'>('dark');
  const [filterStatus, setFilterStatus] = useState<DriverStatus | 'all'>('all');
  const [gpsStatusMsg, setGpsStatusMsg] = useState<string | null>(null);
  const [isLocatingGps, setIsLocatingGps] = useState<boolean>(false);

  // Center on Linares, Maule, Chile
  const defaultCenter: [number, number] = [-35.8454, -71.5979];

  // Initialize Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: defaultCenter,
      zoom: 14,
      zoomControl: false,
    });

    L.control.zoom({ position: 'bottomright' }).addTo(map);

    const darkTileLayer = L.tileLayer(
      'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
      {
        attribution: '&copy; OpenStreetMap &copy; CARTO',
        maxZoom: 19,
        subdomains: 'abcd',
      }
    );

    darkTileLayer.addTo(map);
    mapInstanceRef.current = map;

    // Clicking an empty area returns the map to its neutral state.
    // Marker clicks do not bubble to the map in Leaflet, so selecting a taxi
    // still works normally while a background click safely deselects it.
    const clearDriverFocus = () => {
      map.closePopup();
      onSelectDriver?.(null);
    };
    map.on('click', clearDriverFocus);

    // Ensure map renders correctly without gray tiles
    setTimeout(() => {
      map.invalidateSize();
    }, 200);

    // Resize observer to handle map resize dynamically
    const resizeObserver = new ResizeObserver(() => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.invalidateSize();
      }
    });

    if (mapContainerRef.current) {
      resizeObserver.observe(mapContainerRef.current);
    }


    return () => {
      resizeObserver.disconnect();
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Real GPS Geolocation Request Function
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
        setGpsStatusMsg(`GPS Activo: ${latitude.toFixed(4)}, ${longitude.toFixed(4)} (Linares / Chile)`);

        if (mapInstanceRef.current) {
          const map = mapInstanceRef.current;
          map.setView([latitude, longitude], 16, { animate: true });

          // Add or update User GPS marker
          const gpsIconHtml = `
            <div class="relative flex items-center justify-center">
              <span class="animate-ping absolute inline-flex h-8 w-8 rounded-full bg-blue-400 opacity-75"></span>
              <div class="relative px-2 py-1 rounded-full text-[10px] font-bold font-mono bg-blue-600 text-white border-2 border-white shadow-xl flex items-center gap-1">
                <span class="w-2 h-2 rounded-full bg-white"></span>
                <span>MI GPS</span>
              </div>
            </div>
          `;

          const gpsIcon = L.divIcon({
            html: gpsIconHtml,
            className: 'custom-user-gps-pin',
            iconSize: [80, 32],
            iconAnchor: [40, 16],
          });

          if (userGpsMarkerRef.current) {
            userGpsMarkerRef.current.setLatLng([latitude, longitude]);
          } else {
            userGpsMarkerRef.current = L.marker([latitude, longitude], { icon: gpsIcon }).addTo(map);
          }
        }
      },
      (error) => {
        setIsLocatingGps(false);
        console.warn('Error obteniendo GPS real:', error);
        setGpsStatusMsg('Permiso GPS no concedido. Centrado en Linares, Chile.');
        if (mapInstanceRef.current) {
          mapInstanceRef.current.setView(defaultCenter, 14, { animate: true });
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  // Handle Tile Mode Switch
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const map = mapInstanceRef.current;

    map.eachLayer((layer) => {
      if (layer instanceof L.TileLayer) {
        map.removeLayer(layer);
      }
    });

    const url =
      tileMode === 'dark'
        ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
        : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';

    L.tileLayer(url, {
      maxZoom: 19,
      attribution: tileMode === 'dark' ? '&copy; CARTO' : '&copy; OpenStreetMap',
    }).addTo(map);
  }, [tileMode]);

  const enableSmoothMarkerTransition = (marker: L.Marker) => {
    window.requestAnimationFrame(() => {
      const element = marker.getElement();
      if (element) {
        element.style.transition = 'transform 850ms linear';
        element.style.willChange = 'transform';
      }
    });
  };

  // Update Driver Markers
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const map = mapInstanceRef.current;

    // Filter drivers
    const filteredDrivers = drivers.filter(
      (d) => filterStatus === 'all' || d.status === filterStatus
    );

    // Track active driver IDs for cleanup
    const activeIds = new Set(filteredDrivers.map((d) => d.id));

    // Remove markers not in active set
    Object.keys(markersRef.current).forEach((id) => {
      if (!activeIds.has(id)) {
        markersRef.current[id].remove();
        delete markersRef.current[id];
      }
    });

    filteredDrivers.forEach((driver) => {
      const { lat, lng } = driver.currentLocation;

      // Determine status styling
      let statusColor = '#10b981'; // available (emerald)
      let statusBadge = 'bg-emerald-500/95 text-slate-950 border-emerald-300 font-extrabold shadow-emerald-500/30';
      let haloGlow = 'rgba(16, 185, 129, 0.4)';
      let statusText = 'DISPONIBLE';

      if (driver.sosActive || driver.status === 'sos') {
        statusColor = '#ef4444';
        statusBadge = 'bg-red-600 text-white border-red-300 animate-bounce shadow-red-500/50';
        haloGlow = 'rgba(239, 68, 68, 0.8)';
        statusText = 'SOS ALERTA';
      } else if (driver.status === 'en_route') {
        statusColor = '#f59e0b';
        statusBadge = 'bg-amber-500/95 text-slate-950 border-amber-200 font-extrabold shadow-amber-500/30';
        haloGlow = 'rgba(245, 158, 11, 0.5)';
        statusText = 'EN CAMINO';
      } else if (driver.status === 'in_trip') {
        statusColor = '#3b82f6';
        statusBadge = 'bg-blue-600 text-white border-blue-300 font-bold shadow-blue-500/30';
        haloGlow = 'rgba(59, 130, 246, 0.5)';
        statusText = 'EN VIAJE';
      } else if (driver.status === 'paused' || driver.status === 'offline') {
        statusColor = '#64748b';
        statusBadge = 'bg-slate-700 text-slate-300 border-slate-600';
        haloGlow = 'rgba(100, 116, 139, 0.2)';
        statusText = 'PAUSADO';
      }

      const heading = driver.currentLocation.heading || 0;
      const speed = driver.currentLocation.speed || 0;

      const customIconHtml = `
        <div class="relative flex flex-col items-center justify-center group cursor-pointer pointer-events-auto" style="width: 70px; height: 70px;">
          <!-- Floating Unit Tag Badge -->
          <div class="absolute -top-3 z-20 flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono border shadow-lg whitespace-nowrap transition-transform duration-300 group-hover:scale-110 ${statusBadge}">
            <span class="w-1.5 h-1.5 rounded-full" style="background-color: ${statusColor}"></span>
            <span>${driver.unitNumber}</span>
          </div>

          <!-- Ground Pulse Halo -->
          <div class="absolute inset-0 m-auto w-10 h-10 rounded-full transition-all duration-500"
               style="background: radial-gradient(circle, ${haloGlow} 0%, transparent 70%);"></div>

          <!-- Mini Chilean Taxi Vehicle SVG with Heading Direction Rotation -->
          <div class="relative z-10 w-10 h-10 transition-transform duration-700 ease-out flex items-center justify-center"
               style="transform: rotate(${heading}deg);">
            
            <!-- Headlight Cone Beams -->
            <div class="absolute -top-3 left-1/2 -translate-x-1/2 w-8 h-6 pointer-events-none opacity-80 animate-headlights"
                 style="background: conic-gradient(from 150deg at 50% 100%, rgba(254, 240, 138, 0.7) 0deg, transparent 60deg); filter: blur(1px);"></div>

            <!-- Detailed Top-Down Mini Taxi SVG -->
            <svg viewBox="0 0 40 56" class="w-8 h-11 drop-shadow-[0_4px_8px_rgba(0,0,0,0.85)]">
              <!-- Side Mirrors -->
              <rect x="3" y="16" width="3" height="5" rx="1" fill="#18181b" />
              <rect x="34" y="16" width="3" height="5" rx="1" fill="#18181b" />

              <!-- Tires -->
              <rect x="5" y="8" width="4" height="9" rx="2" fill="#09090b" />
              <rect x="31" y="8" width="4" height="9" rx="2" fill="#09090b" />
              <rect x="5" y="38" width="4" height="9" rx="2" fill="#09090b" />
              <rect x="31" y="38" width="4" height="9" rx="2" fill="#09090b" />

              <!-- Main Chassis (Radio Taxi Linares Black Lower Body) -->
              <rect x="8" y="4" width="24" height="48" rx="7" fill="#18181b" stroke="#27272a" stroke-width="1" />

              <!-- Classic Chilean Taxi Yellow Roof & Hood Cover -->
              <path d="M 10 14 Q 20 12 30 14 L 29 42 Q 20 44 11 42 Z" fill="#eab308" />

              <!-- Hood Detailing -->
              <path d="M 12 6 L 28 6 L 27 12 L 13 12 Z" fill="#18181b" />

              <!-- Front Windshield -->
              <path d="M 12 14 L 28 14 L 26 21 L 14 21 Z" fill="#0f172a" stroke="#334155" stroke-width="0.5" />
              <line x1="15" y1="15" x2="21" y2="20" stroke="#94a3b8" stroke-width="1" stroke-linecap="round" opacity="0.6" />

              <!-- Rear Glass -->
              <path d="M 14 36 L 26 36 L 28 41 L 12 41 Z" fill="#0f172a" stroke="#334155" stroke-width="0.5" />

              <!-- Taxi Roof -->
              <rect x="13" y="21" width="14" height="15" rx="2" fill="#facc15" />

              <!-- TAXI Lightbox Box on Roof -->
              <g class="animate-taxi-sign">
                <rect x="14" y="26" width="12" height="5" rx="1" fill="#ffffff" stroke="#18181b" stroke-width="0.5" />
                <text x="20" y="29.8" font-size="3" font-weight="900" font-family="sans-serif" fill="#000000" text-anchor="middle">TAXI</text>
              </g>

              <!-- Front Headlights (Bright Yellow LED) -->
              <circle cx="11" cy="4" r="2" fill="#fef08a" />
              <circle cx="29" cy="4" r="2" fill="#fef08a" />

              <!-- Rear Taillights (Red LED) -->
              <circle cx="11" cy="51" r="1.5" fill="#ef4444" />
              <circle cx="29" cy="51" r="1.5" fill="#ef4444" />
            </svg>
          </div>

          <!-- Hover Tooltip -->
          <div class="absolute top-12 z-30 hidden group-hover:flex flex-col items-center bg-slate-900/95 text-white border border-slate-700 px-2.5 py-1 rounded-lg text-[10px] font-mono shadow-2xl pointer-events-none whitespace-nowrap">
            <span class="font-bold text-amber-400">${driver.unitNumber} - ${driver.name}</span>
            <span class="text-slate-300">${speed} km/h • ${statusText}</span>
          </div>
        </div>
      `;

      const customIcon = L.divIcon({
        html: customIconHtml,
        className: 'custom-taxi-pin',
        iconSize: [70, 70],
        iconAnchor: [35, 35],
      });

      if (markersRef.current[driver.id]) {
        // Update the icon first and then move the Leaflet element. The CSS
        // transition makes each GPS sample glide to the next road point.
        markersRef.current[driver.id].setIcon(customIcon);
        enableSmoothMarkerTransition(markersRef.current[driver.id]);
        markersRef.current[driver.id].setLatLng([lat, lng]);
      } else {
        // Create new marker
        const marker = L.marker([lat, lng], { icon: customIcon }).addTo(map);

        // Bind Popup
        const popupContent = document.createElement('div');
        popupContent.className = 'p-3 text-slate-100 bg-slate-900 rounded-lg min-w-[210px] border border-slate-700 font-sans';
        popupContent.innerHTML = `
          <div class="flex items-center gap-2 mb-2 pb-2 border-b border-slate-800">
            <img src="${driver.photoUrl}" class="w-9 h-9 rounded-full object-cover border border-amber-500/50" />
            <div>
              <div class="font-bold text-sm text-slate-100">${driver.unitNumber} - ${driver.name}</div>
              <div class="text-xs text-amber-400 font-mono">★ ${driver.rating.toFixed(2)} • Tel: ${driver.phone}</div>
            </div>
          </div>
          <div class="text-xs text-slate-300 mb-1 flex items-center justify-between">
            <span>Estado: <strong class="text-emerald-400 font-mono">${statusText}</strong></span>
            <span class="font-mono text-amber-400">${speed} km/h</span>
          </div>
          <div class="text-xs text-slate-400 mb-2">
            📍 ${driver.currentLocation.address || 'Ubicación GPS activada (Linares)'}
          </div>
          <div class="grid grid-cols-2 gap-1.5 mt-2">
            <button id="btn-dispatch-${driver.id}" class="py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded transition shadow text-center">
              + Despachar
            </button>
            <button id="btn-vhf-${driver.id}" class="py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded transition shadow text-center flex items-center justify-center gap-1">
              <span>📻 Radio VHF</span>
            </button>
          </div>
        `;

        marker.bindPopup(popupContent);

        marker.on('popupopen', () => {
          const btnDispatch = document.getElementById(`btn-dispatch-${driver.id}`);
          if (btnDispatch) {
            btnDispatch.onclick = () => {
              if (onSelectDriver) onSelectDriver(driver);
              setNewTripModalOpen(true);
            };
          }
          const btnVhf = document.getElementById(`btn-vhf-${driver.id}`);
          if (btnVhf) {
            btnVhf.onclick = () => {
              setVHFModalDriver(driver);
            };
          }
        });

        markersRef.current[driver.id] = marker;
        enableSmoothMarkerTransition(marker);
      }
    });
  }, [drivers, filterStatus, tileMode]);


  // When the dashboard clears its vehicle focus, close any popup that had
  // been reopened by the tracking effect.
  useEffect(() => {
    if (focusDriverId || !mapInstanceRef.current) return;
    mapInstanceRef.current.closePopup();
  }, [focusDriverId]);

  // Focus a driver selected from the operational dashboard.
  useEffect(() => {
    if (!focusDriverId || !mapInstanceRef.current) return;
    const driver = drivers.find((item) => item.id === focusDriverId);
    if (!driver) return;

    mapInstanceRef.current.setView(
      [driver.currentLocation.lat, driver.currentLocation.lng],
      Math.max(mapInstanceRef.current.getZoom(), 16),
      { animate: true }
    );

    const marker = markersRef.current[driver.id];
    if (marker) marker.openPopup();
  }, [focusDriverId, drivers]);

  // Draw the selected trip over real streets instead of a straight line.
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const map = mapInstanceRef.current;
    const abortController = new AbortController();

    if (tripPolylineRef.current) {
      tripPolylineRef.current.remove();
      tripPolylineRef.current = null;
    }
    if (approachPolylineRef.current) {
      approachPolylineRef.current.remove();
      approachPolylineRef.current = null;
    }
    tripMarkersRef.current.forEach((marker) => marker.remove());
    tripMarkersRef.current = [];

    if (!selectedTrip) return () => abortController.abort();

    const origin: RoadPoint = { lat: selectedTrip.origin.lat, lng: selectedTrip.origin.lng };
    const destination: RoadPoint = {
      lat: selectedTrip.destination.lat,
      lng: selectedTrip.destination.lng,
    };

    const originIcon = L.divIcon({
      html: `<div class="p-1.5 bg-emerald-500 text-slate-950 font-bold text-xs rounded-full border-2 border-white shadow-xl">A</div>`,
      className: 'orig-pin',
      iconSize: [24, 24],
      iconAnchor: [12, 12],
    });
    const destinationIcon = L.divIcon({
      html: `<div class="p-1.5 bg-rose-500 text-white font-bold text-xs rounded-full border-2 border-white shadow-xl">B</div>`,
      className: 'dest-pin',
      iconSize: [24, 24],
      iconAnchor: [12, 12],
    });

    tripMarkersRef.current = [
      L.marker([origin.lat, origin.lng], { icon: originIcon }).addTo(map),
      L.marker([destination.lat, destination.lng], { icon: destinationIcon }).addTo(map),
    ];

    const selectedDriver = selectedTrip.driverId
      ? drivers.find((driver) => driver.id === selectedTrip.driverId)
      : undefined;

    const renderStreetRoutes = async () => {
      const passengerRoutePromise = requestDrivingRoute(origin, destination, abortController.signal);
      const approachRoutePromise =
        selectedDriver && ['assigned', 'en_route'].includes(selectedTrip.status)
          ? requestDrivingRoute(
              {
                lat: selectedDriver.currentLocation.lat,
                lng: selectedDriver.currentLocation.lng,
              },
              origin,
              abortController.signal
            )
          : Promise.resolve<RoadPoint[]>([]);

      try {
        const [passengerRoute, approachRoute] = await Promise.all([
          passengerRoutePromise,
          approachRoutePromise,
        ]);
        if (abortController.signal.aborted) return;

        tripPolylineRef.current = L.polyline(
          passengerRoute.map((point) => [point.lat, point.lng] as [number, number]),
          {
            color: '#3b82f6',
            weight: 5,
            opacity: 0.9,
          }
        ).addTo(map);

        if (approachRoute.length > 1) {
          approachPolylineRef.current = L.polyline(
            approachRoute.map((point) => [point.lat, point.lng] as [number, number]),
            {
              color: '#f59e0b',
              weight: 4,
              dashArray: '9, 7',
              opacity: 0.9,
            }
          ).addTo(map);
        }

        const allPoints = [...passengerRoute, ...approachRoute];
        if (allPoints.length > 1) {
          map.fitBounds(
            L.latLngBounds(allPoints.map((point) => [point.lat, point.lng])),
            { padding: [48, 48], maxZoom: 16 }
          );
        }
      } catch (error) {
        if (!abortController.signal.aborted) {
          console.warn('No fue posible dibujar la ruta callejera:', error);
        }
      }
    };

    void renderStreetRoutes();
    return () => abortController.abort();
  }, [selectedTrip?.id, selectedTrip?.status, selectedTrip?.driverId]);

  // Center on active SOS if present
  const focusOnSOS = () => {
    if (activeSOSDriver && mapInstanceRef.current) {
      mapInstanceRef.current.setView(
        [activeSOSDriver.currentLocation.lat, activeSOSDriver.currentLocation.lng],
        16,
        { animate: true }
      );
    }
  };

  const centerFleet = () => {
    if (mapInstanceRef.current && drivers.length > 0) {
      const bounds = L.latLngBounds(drivers.map((d) => [d.currentLocation.lat, d.currentLocation.lng]));
      mapInstanceRef.current.fitBounds(bounds, { padding: [40, 40] });
    }
  };

  return (
    <div className={`relative w-full ${height} rounded-2xl overflow-hidden border border-slate-800 bg-slate-900 shadow-2xl`}>
      {/* Leaflet Map DOM Container */}
      <div ref={mapContainerRef} className="w-full h-full z-0" />

      {/* Floating Control Toolbar Wrapper (non-blocking pointer-events layout) */}
      <div className="absolute top-3 inset-x-3 z-10 flex flex-wrap lg:flex-nowrap items-center justify-between gap-2.5 pointer-events-none">
        {/* Left: Status Filter Buttons */}
        <div className="flex flex-wrap items-center gap-1 bg-slate-950/90 backdrop-blur-md p-1.5 rounded-xl border border-slate-800 shadow-xl pointer-events-auto">
          <button
            onClick={() => setFilterStatus('all')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition ${
              filterStatus === 'all'
                ? 'bg-amber-500 text-slate-950 font-bold shadow'
                : 'text-slate-300 hover:bg-slate-800'
            }`}
          >
            Todos ({drivers.length})
          </button>
          <button
            onClick={() => setFilterStatus('available')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition ${
              filterStatus === 'available'
                ? 'bg-emerald-500 text-slate-950 font-bold shadow'
                : 'text-slate-300 hover:bg-slate-800'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            Libres ({drivers.filter((d) => d.status === 'available').length})
          </button>
          <button
            onClick={() => setFilterStatus('en_route')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition ${
              filterStatus === 'en_route'
                ? 'bg-amber-500 text-slate-950 font-bold shadow'
                : 'text-slate-300 hover:bg-slate-800'
            }`}
          >
            En Camino ({drivers.filter((d) => d.status === 'en_route').length})
          </button>
          <button
            onClick={() => setFilterStatus('in_trip')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition ${
              filterStatus === 'in_trip'
                ? 'bg-blue-500 text-white font-bold shadow'
                : 'text-slate-300 hover:bg-slate-800'
            }`}
          >
            En Viaje ({drivers.filter((d) => d.status === 'in_trip').length})
          </button>
        </div>

        {/* Right: Action Buttons & GPS Tools */}
        <div className="flex flex-wrap items-center gap-2 pointer-events-auto ml-auto">
          {gpsStatusMsg && (
            <div className="bg-blue-950/90 text-blue-200 border border-blue-500/40 px-3 py-1.5 rounded-xl text-xs font-mono shadow-xl flex items-center gap-1.5 animate-fade-in max-w-xs truncate">
              <Navigation className="w-3.5 h-3.5 text-blue-400 animate-spin flex-shrink-0" />
              <span className="truncate">{gpsStatusMsg}</span>
            </div>
          )}

          {activeSOSDriver && (
            <button
              onClick={focusOnSOS}
              className="px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white font-bold text-xs rounded-xl shadow-lg flex items-center gap-1.5 animate-pulse border border-red-400"
            >
              <ShieldAlert className="w-4 h-4" />
              Centrar SOS ({activeSOSDriver.unitNumber})
            </button>
          )}

          <button
            onClick={() => {
              speakVHFDispatch('Atención todas las unidades en Linares, mantener la frecuencia libre para despachos de la central.');
            }}
            className="px-3 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 font-bold text-xs rounded-xl shadow-lg flex items-center gap-1.5 transition border border-amber-500/40 uppercase tracking-wider"
            title="Emitir mensaje por frecuencia de radio VHF"
          >
            <Radio className="w-4 h-4 text-amber-400 animate-pulse" />
            <span>VHF Voz</span>
          </button>

          <button
            onClick={centerFleet}
            className="p-2 bg-slate-900/90 hover:bg-slate-800 text-slate-200 rounded-xl border border-slate-700 shadow-md transition"
            title="Centrar toda la flota en Linares"
          >
            <Crosshair className="w-4 h-4" />
          </button>

          <button
            onClick={() => setTileMode(tileMode === 'dark' ? 'street' : 'dark')}
            className="p-2 bg-slate-900/90 hover:bg-slate-800 text-slate-200 rounded-xl border border-slate-700 shadow-md transition"
            title="Cambiar mapa Claro / Oscuro"
          >
            <Layers className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Bottom Map Status Legend Bar */}
      <div className="absolute bottom-4 left-4 z-10 hidden sm:flex items-center gap-4 bg-slate-950/80 backdrop-blur-md px-4 py-2 rounded-xl border border-slate-800 text-xs font-mono text-slate-300 shadow-lg">
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]"></span>
          <span>Disponible</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.8)]"></span>
          <span>En Camino</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.8)]"></span>
          <span>En Viaje</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-red-600 animate-ping"></span>
          <span className="text-red-400 font-bold">SOS Alarma</span>
        </div>
      </div>
    </div>
  );
};

import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import { DriverStatus, Trip } from '../../types';
import {
  Car,
  Navigation,
  MapPin,
  Clock,
  ShieldAlert,
  Phone,
  CheckCircle,
  XCircle,
  Play,
  DollarSign,
  AlertTriangle,
  User,
  Radio,
  Share2,
  ExternalLink,
  Award,
} from 'lucide-react';
import { soundManager } from '../../lib/audio';
import { playVHFRadioChirp, speakVHFDispatch } from '../../lib/audioService';
import centralGoLogo from '../../assets/images/central-go-logo.svg';
import { runtimeConfig } from '../../config/runtime';

export const DriverMobileView: React.FC = () => {
  const {
    drivers,
    trips,
    updateTripStatus,
    toggleDriverAvailability,
    updateDriverLocation,
    triggerDriverSOS,
    resolveDriverSOS,
    rejectTripOffer,
    createTrip,
    currentUser,
  } = useApp();

  // GPS state
  const [isGpsActive, setIsGpsActive] = useState<boolean>(false);
  const [gpsText, setGpsText] = useState<string>('GPS Linares Activo');
  const gpsWatchId = useRef<number | null>(null);
  const lastGpsSent = useRef<{ at: number; lat: number; lng: number } | null>(null);

  // Selected driver unit ID for driver mobile simulation
  const [myDriverId, setMyDriverId] = useState<string>('drv-2');
  const driver = runtimeConfig.isCommercial
    ? drivers.find((d) => d.userId === currentUser.id)
    : drivers.find((d) => d.id === myDriverId) || drivers[0];

  const stopGpsTracking = () => {
    if (gpsWatchId.current !== null && navigator.geolocation) navigator.geolocation.clearWatch(gpsWatchId.current);
    gpsWatchId.current = null;
    setIsGpsActive(false);
    setGpsText(runtimeConfig.isCommercial ? 'GPS detenido' : 'GPS Linares (Simulado)');
  };

  const toggleRealGpsTracking = () => {
    if (!navigator.geolocation || !driver) {
      setGpsText('GPS no disponible en navegador');
      return;
    }
    if (isGpsActive) { stopGpsTracking(); return; }

    setIsGpsActive(true);
    setGpsText('Solicitando GPS de alta precisión…');
    gpsWatchId.current = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude, longitude, accuracy } = pos.coords;
        const now = Date.now();
        const last = lastGpsSent.current;
        const metersApprox = last ? Math.hypot((latitude-last.lat)*111320, (longitude-last.lng)*111320*Math.cos(latitude*Math.PI/180)) : Infinity;
        const shouldSend = !last || now-last.at >= 8000 || metersApprox >= 15;
        setGpsText(`GPS EN VIVO · precisión ±${Math.round(accuracy)} m`);
        if (shouldSend) {
          lastGpsSent.current = { at: now, lat: latitude, lng: longitude };
          void Promise.resolve(updateDriverLocation(driver.id, latitude, longitude, `GPS ${latitude.toFixed(5)}, ${longitude.toFixed(5)}`)).catch(() => setGpsText('Error enviando GPS a la central'));
        }
      },
      (err) => {
        stopGpsTracking();
        setGpsText(err.code === 1 ? 'Permiso GPS denegado' : 'No fue posible obtener GPS');
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 }
    );
  };

  useEffect(() => () => {
    if (gpsWatchId.current !== null && navigator.geolocation) navigator.geolocation.clearWatch(gpsWatchId.current);
  }, []);

  // Active assigned or in-progress trip for this driver
  const activeTrip = trips.find(
    (t) =>
      t.driverId === driver?.id &&
      ['assigned', 'en_route', 'arrived', 'in_progress'].includes(t.status)
  );

  // Incoming trip offer simulation state (if assigned and pending driver accept)
  const [incomingOffer, setIncomingOffer] = useState<Trip | null>(null);
  const [offerTimer, setOfferTimer] = useState<number>(15);
  const [sosConfirmOpen, setSosConfirmOpen] = useState<boolean>(false);
  const [finishModalOpen, setFinishModalOpen] = useState<boolean>(false);
  const [selectedPayment, setSelectedPayment] = useState<string>('efectivo');

  // Trigger incoming offer chime if assigned trip is new
  useEffect(() => {
    if (activeTrip && activeTrip.status === 'assigned' && !incomingOffer) {
      setIncomingOffer(activeTrip);
      setOfferTimer(15);
      soundManager.playDispatchChime();
    }
  }, [activeTrip]);

  // Offer countdown timer
  useEffect(() => {
    let timer: ReturnType<typeof setInterval>;
    if (incomingOffer && offerTimer > 0) {
      timer = setInterval(() => setOfferTimer((t) => t - 1), 1000);
    } else if (incomingOffer && offerTimer === 0) {
      // Auto reject if expired
      setIncomingOffer(null);
      void Promise.resolve(rejectTripOffer(incomingOffer.id, 'Expiró tiempo de respuesta del conductor')).catch(() => undefined);
    }
    return () => clearInterval(timer);
  }, [incomingOffer, offerTimer]);

  if (!driver) return (
    <div className="max-w-md mx-auto rounded-2xl border border-amber-500/20 bg-zinc-950 p-6 text-zinc-100">
      <h2 className="font-black">Cuenta de conductor sin móvil vinculado</h2>
      <p className="mt-2 text-sm text-zinc-400">El administrador debe registrar este conductor usando el mismo correo de tu cuenta Central GO.</p>
    </div>
  );

  const handleAcceptOffer = () => {
    if (incomingOffer) {
      updateTripStatus(incomingOffer.id, 'en_route');
      setIncomingOffer(null);
    }
  };

  const handleRejectOffer = () => {
    if (incomingOffer) {
      void Promise.resolve(rejectTripOffer(incomingOffer.id, 'Rechazado por conductor')).catch(() => undefined);
      setIncomingOffer(null);
    }
  };

  const openGPSNavigation = (address: string, lat: number, lng: number) => {
    // Open Google Maps or Waze directly
    const url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&destination_place_id=${encodeURIComponent(
      address
    )}`;
    window.open(url, '_blank');
  };

  return (
    <div className="max-w-md mx-auto min-h-[calc(100vh-80px)] bg-[#0d0d0f] text-zinc-100 flex flex-col justify-between p-4 rounded-xl border border-zinc-800 shadow-2xl relative overflow-hidden font-sans">
      {/* Top Header Card */}
      <div className="space-y-3">
        {/* Central Go App Brand Bar */}
        <div className="flex items-center justify-between bg-gradient-to-r from-[#161a23] via-[#12141a] to-[#0f1117] p-3 rounded-xl border border-amber-500/30 shadow-lg shadow-amber-500/5">
          <div className="flex items-center gap-2.5">
            <img
              src={centralGoLogo}
              alt="Central Go Logo"
              className="w-8 h-8 rounded-lg border border-amber-400/80 object-cover bg-zinc-950 p-0.5"
              referrerPolicy="no-referrer"
            />
            <div>
              <div className="font-black text-sm tracking-wide text-white font-sans flex items-center gap-1">
                CENTRAL <span className="text-amber-400 font-extrabold px-1 py-0.2 bg-amber-500/20 border border-amber-400/40 rounded text-[10px]">GO</span>
              </div>
              <p className="text-[9px] text-amber-300/80 font-mono font-bold tracking-widest uppercase">App Conductor GPS</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 bg-emerald-500/15 px-2.5 py-1 rounded-lg border border-emerald-500/30">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span className="text-[10px] font-mono font-bold text-emerald-300 uppercase">EN LÍNEA</span>
          </div>
        </div>

        {/* Driver Unit Header & Selector */}
        <div className="bg-[#121215] p-3.5 rounded-xl border border-zinc-800 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img
                src={driver.photoUrl}
                alt={driver.name}
                className="w-12 h-12 rounded-full object-cover border-2 border-blue-500 shadow-md"
              />
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-extrabold text-base text-white font-mono">{driver.unitNumber}</span>
                  <span className="text-xs bg-blue-500/20 text-blue-300 font-mono font-bold px-2 py-0.5 rounded border border-blue-500/30">
                    ★ {driver.rating.toFixed(2)}
                  </span>
                </div>
                <p className="text-xs text-zinc-400 font-medium">{driver.name}</p>
              </div>
            </div>

            <div className="text-right font-mono">
              <div className="text-xs text-zinc-400 uppercase tracking-wider">Recaudado Hoy</div>
              <div className="text-sm font-bold text-emerald-400">${driver.todayEarnings.toLocaleString()}</div>
            </div>
          </div>

          {/* Unit Switcher Selector - solo demo */}
          {runtimeConfig.isDemo && (
          <div className="flex items-center justify-between pt-2 border-t border-zinc-800/80 text-xs font-mono">
            <span className="text-zinc-400 font-bold uppercase text-[10px]">Simular como Móvil:</span>
            <select
              value={myDriverId}
              onChange={(e) => setMyDriverId(e.target.value)}
              className="bg-[#0d0d0f] text-amber-400 font-bold border border-zinc-700 rounded-lg px-2.5 py-1 text-xs focus:outline-none focus:border-amber-500"
            >
              {drivers.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.unitNumber} - {d.name} ({d.status.toUpperCase()})
                </option>
              ))}
            </select>
          </div>
          )}
        </div>

        {/* GPS Sensor Active Bar */}
        <div className="bg-[#121215] border border-zinc-800 rounded-xl p-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Navigation className={`w-4 h-4 ${isGpsActive ? 'text-blue-400 animate-spin' : 'text-zinc-500'}`} />
            <div className="text-xs">
              <div className="font-bold text-zinc-200">{gpsText}</div>
              <div className="text-[10px] text-zinc-500 truncate max-w-[180px]">{driver.currentLocation.address}</div>
            </div>
          </div>

          <button
            onClick={toggleRealGpsTracking}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition flex items-center gap-1 uppercase tracking-wider border ${
              isGpsActive
                ? 'bg-blue-600/20 text-blue-300 border-blue-500/40 shadow-lg shadow-blue-900/30'
                : 'bg-zinc-800 text-zinc-300 border-zinc-700 hover:bg-zinc-700'
            }`}
          >
            <span>{isGpsActive ? 'GPS ON' : 'Activar GPS'}</span>
          </button>
        </div>

        {/* Radio PTT VHF Push To Talk Bar */}
        <div className="bg-[#121215] border border-zinc-800 rounded-xl p-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Radio className="w-4 h-4 text-amber-400 animate-pulse" />
            <div className="text-xs">
              <div className="font-bold text-zinc-200">VHF 148.525 MHz</div>
              <div className="text-[10px] text-amber-400 font-medium">Canal Directo Central Go Linares</div>
            </div>
          </div>

          <button
            onClick={() => {
              playVHFRadioChirp();
              speakVHFDispatch(`Copiado central, aquí ${driver.unitNumber} atento a la frecuencia.`);
            }}
            className="px-3 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 rounded-lg text-xs font-bold transition flex items-center gap-1.5 uppercase tracking-wider"
          >
            <Radio className="w-3.5 h-3.5" />
            <span>Transmitir PTT</span>
          </button>
        </div>

        {/* Giant Easy-Touch Availability Switch */}
        <div className="bg-[#121215] p-2 rounded-xl border border-zinc-800 grid grid-cols-3 gap-2">
          <button
            onClick={() => toggleDriverAvailability(driver.id, 'available')}
            className={`py-3 px-2 rounded-lg text-xs font-bold transition flex flex-col items-center gap-1 uppercase tracking-wider ${
              driver.status === 'available'
                ? 'bg-emerald-500 text-zinc-950 shadow-[0_0_15px_rgba(16,185,129,0.5)] border border-emerald-300'
                : 'text-zinc-400 hover:bg-zinc-800'
            }`}
          >
            <span className="w-2.5 h-2.5 rounded-full bg-zinc-950 animate-pulse"></span>
            <span>DISPONIBLE</span>
          </button>

          <button
            onClick={() => toggleDriverAvailability(driver.id, 'paused')}
            className={`py-3 px-2 rounded-lg text-xs font-bold transition flex flex-col items-center gap-1 uppercase tracking-wider ${
              driver.status === 'paused'
                ? 'bg-amber-500 text-zinc-950 shadow-[0_0_15px_rgba(245,158,11,0.5)] border border-amber-300'
                : 'text-zinc-400 hover:bg-zinc-800'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>EN PAUSA</span>
          </button>

          <button
            onClick={() => toggleDriverAvailability(driver.id, 'offline')}
            className={`py-3 px-2 rounded-lg text-xs font-bold transition flex flex-col items-center gap-1 uppercase tracking-wider ${
              driver.status === 'offline'
                ? 'bg-zinc-700 text-white shadow border border-zinc-600'
                : 'text-zinc-400 hover:bg-zinc-800'
            }`}
          >
            <XCircle className="w-3.5 h-3.5" />
            <span>DESCONECTADO</span>
          </button>
        </div>

        {/* Incoming Offer Modal Overlay */}
        {incomingOffer && (
          <div className="bg-gradient-to-b from-blue-600/20 via-[#0d0d0f] to-[#09090b] border-2 border-blue-500 rounded-xl p-5 shadow-2xl space-y-4 animate-pulse">
            <div className="flex items-center justify-between">
              <span className="bg-blue-600 text-white text-xs font-extrabold uppercase px-3 py-1 rounded font-mono tracking-wider">
                ¡NUEVO VIAJE OFRECIDO!
              </span>
              <span className="text-xl font-extrabold font-mono text-blue-400 animate-ping">
                ⏱ {offerTimer}s
              </span>
            </div>

            <div className="space-y-2">
              <div className="text-xs text-zinc-400 uppercase tracking-wider">Origen Pasajero:</div>
              <div className="text-sm font-bold text-white flex items-center gap-2">
                <MapPin className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{incomingOffer.origin.address}</span>
              </div>
              {incomingOffer.origin.notes && (
                <p className="text-xs text-blue-300 bg-blue-500/10 p-2 rounded border border-blue-500/20">
                  Nota: {incomingOffer.origin.notes}
                </p>
              )}
            </div>

            <div className="flex justify-between items-center bg-[#121215] p-3 rounded-lg border border-zinc-800 font-mono text-xs">
              <div>
                <span className="text-zinc-400">Tarifa Estimada: </span>
                <span className="font-bold text-emerald-400 text-base">${incomingOffer.estimatedFare}</span>
              </div>
              <div>
                <span className="text-zinc-400">Distancia: </span>
                <span className="font-bold text-zinc-200">{incomingOffer.estimatedDistanceKm} km</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                onClick={handleRejectOffer}
                className="py-3 bg-zinc-800 hover:bg-zinc-700 text-rose-400 font-bold text-sm rounded-lg border border-zinc-700 transition uppercase tracking-wider"
              >
                Rechazar
              </button>
              <button
                onClick={handleAcceptOffer}
                className="py-3 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-extrabold text-sm rounded-lg border border-emerald-300 shadow-lg shadow-emerald-500/30 transition uppercase tracking-wider"
              >
                ACEPTAR VIAJE
              </button>
            </div>
          </div>
        )}

        {/* Active Trip Workflow View */}
        {activeTrip && !incomingOffer && (
          <div className="bg-[#121215] border border-zinc-800 rounded-xl p-4 space-y-4 shadow-xl">
            {/* Header with Code & Status Badge */}
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div>
                <span className="text-xs font-mono font-bold text-blue-400 uppercase tracking-wide block">
                  DESPACHO #{activeTrip.code}
                </span>
                {activeTrip.isFixedFare && (
                  <span className="text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/40 px-2 py-0.5 rounded font-mono font-extrabold flex items-center gap-1 mt-0.5">
                    📌 TARIFA FIJA PACTADA
                  </span>
                )}
              </div>
              <span className="text-xs font-bold px-2.5 py-1 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30 uppercase tracking-wider">
                {activeTrip.status === 'assigned' || activeTrip.status === 'en_route'
                  ? 'EN CAMINO A CLIENTE'
                  : activeTrip.status === 'arrived'
                  ? 'EN DOMICILIO'
                  : 'EN VIAJE CON PASAJERO'}
              </span>
            </div>

            {/* Client Info */}
            <div className="flex items-center justify-between bg-[#0d0d0f] p-3 rounded-lg border border-zinc-800">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center text-blue-400 font-bold">
                  <User className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-bold text-xs text-white">{activeTrip.clientName}</div>
                  <div className="text-[11px] text-zinc-400 font-mono">{activeTrip.clientPhone}</div>
                </div>
              </div>
              <a
                href={`tel:${activeTrip.clientPhone}`}
                className="p-2.5 bg-blue-600 text-white rounded-lg font-bold transition hover:bg-blue-500 shadow-md shadow-blue-900/20"
                title="Llamar Cliente"
              >
                <Phone className="w-4 h-4" />
              </a>
            </div>

            {/* Route Addresses */}
            <div className="space-y-3 font-sans">
              <div className="flex items-start gap-2.5">
                <span className="w-3 h-3 rounded-full bg-emerald-500 mt-1 shrink-0 shadow-[0_0_8px_rgba(16,185,129,0.8)]"></span>
                <div className="text-xs">
                  <span className="text-zinc-400 text-[10px] font-mono uppercase block">Punto de Retiro:</span>
                  <span className="font-semibold text-zinc-100">{activeTrip.origin.address}</span>
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <span className="w-3 h-3 rounded-full bg-rose-500 mt-1 shrink-0 shadow-[0_0_8px_rgba(244,63,94,0.8)]"></span>
                <div className="text-xs">
                  <span className="text-zinc-400 text-[10px] font-mono uppercase block">Destino:</span>
                  <span className="font-semibold text-zinc-100">{activeTrip.destination.address}</span>
                </div>
              </div>
            </div>

            {/* Fare Summary Box */}
            <div className="flex justify-between items-center bg-[#0d0d0f] p-3 rounded-lg border border-zinc-800 font-mono text-xs">
              <div>
                <span className="text-zinc-400 text-[10px] uppercase block">
                  {activeTrip.isFixedFare ? 'Monto Acordado (Fijo)' : 'Tarifa Estimada'}
                </span>
                <span className="font-extrabold text-emerald-400 text-base">
                  ${activeTrip.estimatedFare.toLocaleString()}
                </span>
              </div>
              <div className="text-right">
                <span className="text-zinc-400 text-[10px] uppercase block">Pago</span>
                <span className="font-bold text-zinc-200 uppercase">{activeTrip.paymentMethod}</span>
              </div>
            </div>

            {/* GPS Navigation Quick Button */}
            <button
              onClick={() =>
                openGPSNavigation(
                  activeTrip.status === 'in_progress'
                    ? activeTrip.destination.address
                    : activeTrip.origin.address,
                  activeTrip.status === 'in_progress'
                    ? activeTrip.destination.lat
                    : activeTrip.origin.lat,
                  activeTrip.status === 'in_progress'
                    ? activeTrip.destination.lng
                    : activeTrip.origin.lng
                )
              }
              className="w-full py-2.5 bg-zinc-800 hover:bg-zinc-700 text-blue-400 font-bold text-xs rounded-lg border border-zinc-700 flex items-center justify-center gap-2 transition uppercase tracking-wider"
            >
              <Navigation className="w-4 h-4 text-blue-400" />
              <span>ABRIR EN NAVEGADOR GPS (Maps / Waze)</span>
            </button>

            {/* Workflow Action Buttons Header */}
            <div className="pt-2 border-t border-zinc-800/80 space-y-2">
              <span className="text-[10px] font-mono font-bold text-zinc-400 uppercase tracking-wider block">
                Acciones del Viaje para el Conductor:
              </span>

              {/* Step 1: Inform Arrival */}
              <button
                onClick={() => updateTripStatus(activeTrip.id, 'arrived')}
                disabled={activeTrip.status === 'in_progress'}
                className={`w-full py-3 px-3 rounded-xl font-extrabold text-xs transition flex items-center justify-between border uppercase tracking-wider ${
                  activeTrip.status === 'arrived'
                    ? 'bg-blue-600 text-white border-blue-400 shadow-lg shadow-blue-900/40'
                    : activeTrip.status === 'assigned' || activeTrip.status === 'en_route'
                    ? 'bg-blue-600/20 hover:bg-blue-600 text-blue-300 hover:text-white border-blue-500/40'
                    : 'bg-zinc-900 text-zinc-600 border-zinc-800 cursor-not-allowed opacity-50'
                }`}
              >
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4" />
                  <span>1. LLEGUÉ A CARRERA (EN DOMICILIO)</span>
                </div>
                {activeTrip.status === 'arrived' && (
                  <span className="text-[10px] bg-white text-blue-900 px-2 py-0.5 rounded font-black">
                    ACTIVO
                  </span>
                )}
              </button>

              {/* Step 2: Start Trip (Passenger On Board) */}
              <button
                onClick={() => updateTripStatus(activeTrip.id, 'in_progress')}
                className={`w-full py-3 px-3 rounded-xl font-extrabold text-xs transition flex items-center justify-between border uppercase tracking-wider ${
                  activeTrip.status === 'in_progress'
                    ? 'bg-emerald-500 text-zinc-950 border-emerald-300 shadow-lg shadow-emerald-500/30 font-black'
                    : 'bg-emerald-500/20 hover:bg-emerald-500 text-emerald-300 hover:text-zinc-950 border-emerald-500/40'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Play className="w-4 h-4" />
                  <span>2. PASAJERO A BORDO - INICIAR VIAJE</span>
                </div>
                {activeTrip.status === 'in_progress' && (
                  <span className="text-[10px] bg-zinc-950 text-emerald-400 px-2 py-0.5 rounded font-black">
                    EN VIAJE
                  </span>
                )}
              </button>

              {/* Step 3: Finish & Charge */}
              <button
                onClick={() => setFinishModalOpen(true)}
                className="w-full py-3.5 px-3 bg-rose-600 hover:bg-rose-500 text-white font-black text-xs rounded-xl border border-rose-400 shadow-lg shadow-rose-600/40 transition flex items-center justify-between uppercase tracking-wider"
              >
                <div className="flex items-center gap-2">
                  <DollarSign className="w-4 h-4" />
                  <span>3. FINALIZAR CARRERA Y COBRAR</span>
                </div>
                <span className="bg-white/20 px-2 py-0.5 rounded text-xs">
                  ${activeTrip.estimatedFare.toLocaleString()}
                </span>
              </button>
            </div>
          </div>
        )}

        {/* Idle Driver Standby Box */}
        {!activeTrip && !incomingOffer && (
          <div className="bg-[#121215] border border-zinc-800 rounded-xl p-5 text-center space-y-4 shadow-lg">
            <div className="w-12 h-12 rounded-full bg-blue-600/10 border border-blue-500/20 text-blue-400 flex items-center justify-center mx-auto">
              <Radio className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-zinc-100 uppercase tracking-tight">Esperando Asignación de la Central</h3>
              <p className="text-xs text-zinc-400 mt-1">
                Tu GPS está transmitiendo en tiempo real a la operadora.
              </p>
            </div>

            {/* Simulator Button - exclusivamente demo */}
            {runtimeConfig.isDemo && (
            <div className="pt-2 border-t border-zinc-800/80">
              <button
                onClick={() => {
                  createTrip({
                    clientName: 'Camila Soto (Pasajero Prueba)',
                    clientPhone: '+56 9 8765 4321',
                    origin: { lat: -35.8454, lng: -71.5979, address: 'Plaza de Armas Linares, Independencia 500' },
                    destination: { lat: -35.8510, lng: -71.6030, address: 'Hospital Base Linares, Calle Max Jara' },
                    vehicleTypeRequested: 'standard',
                    estimatedDistanceKm: 4.2,
                    estimatedDurationMins: 12,
                    estimatedFare: 4500,
                    isFixedFare: false,
                    paymentMethod: 'efectivo',
                    driverId: driver.id,
                    driverUnitNumber: driver.unitNumber,
                    driverName: driver.name,
                  });
                }}
                className="w-full py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs rounded-xl shadow-lg shadow-amber-500/20 transition uppercase tracking-wider flex items-center justify-center gap-2 border border-amber-300"
              >
                <Car className="w-4 h-4" />
                <span>⚡ ASIGNAR CARRERA DE PRUEBA A ESTE MÓVIL</span>
              </button>
            </div>
            )}
          </div>
        )}
      </div>

      {/* Bottom Emergency SOS Panic Trigger Button */}
      <div className="pt-4 border-t border-zinc-800">
        {driver.sosActive ? (
          <button
            onClick={() => resolveDriverSOS(driver.id)}
            className="w-full py-3.5 bg-zinc-800 text-emerald-400 font-bold text-xs rounded-lg border border-emerald-500/40 flex items-center justify-center gap-2 animate-pulse uppercase tracking-wider"
          >
            <ShieldAlert className="w-4 h-4" />
            <span>ALERTA SOS ACTIVA - DESACTIVAR EMERGENCIA</span>
          </button>
        ) : (
          <button
            onClick={() => setSosConfirmOpen(true)}
            className="w-full py-4 bg-red-600 hover:bg-red-500 text-white font-extrabold text-xs rounded-lg border border-red-400/30 shadow-[0_0_20px_rgba(239,68,68,0.3)] flex items-center justify-center gap-2 transition tracking-wider uppercase"
          >
            <ShieldAlert className="w-5 h-5 animate-ping" />
            <span>🚨 BOTÓN SOS DE EMERGENCIA</span>
          </button>
        )}
      </div>

      {/* SOS Confirm Dialog */}
      {sosConfirmOpen && (
        <div className="fixed inset-0 bg-zinc-950/90 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-[#0d0d0f] border border-red-600 rounded-xl max-w-xs w-full p-6 text-center space-y-4 shadow-2xl">
            <ShieldAlert className="w-12 h-12 text-red-500 mx-auto animate-bounce" />
            <div>
              <h3 className="font-bold text-base text-white uppercase tracking-tight">¿Confirmar Emergencia SOS?</h3>
              <p className="text-xs text-zinc-300 mt-2">
                Se enviará una alarma sonora de máxima prioridad a la central operadora con tus coordenadas GPS actuales.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                onClick={() => setSosConfirmOpen(false)}
                className="py-2.5 bg-zinc-800 text-zinc-300 font-bold text-xs rounded-lg uppercase tracking-wider"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  triggerDriverSOS(driver.id);
                  setSosConfirmOpen(false);
                }}
                className="py-2.5 bg-red-600 text-white font-extrabold text-xs rounded-lg shadow-lg shadow-red-600/50 uppercase tracking-wider"
              >
                ¡ACTIVAR SOS!
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Finish Trip & Collect Payment Modal */}
      {finishModalOpen && activeTrip && (
        <div className="fixed inset-0 bg-zinc-950/90 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-[#0d0d0f] border border-zinc-800 rounded-xl max-w-sm w-full p-6 space-y-5 shadow-2xl">
            <div className="text-center">
              <h3 className="font-bold text-base text-white uppercase tracking-tight">Finalizar Despacho #{activeTrip.code}</h3>
              <p className="text-xs text-zinc-400 mt-1">Selecciona el método de cobro realizado al pasajero</p>
            </div>

            <div className="bg-[#121215] p-4 rounded-lg border border-zinc-800 text-center font-mono">
              <span className="text-xs text-zinc-400 uppercase block tracking-wider">Monto Total a Cobrar</span>
              <span className="text-3xl font-extrabold text-emerald-400">${activeTrip.estimatedFare}</span>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-mono text-zinc-400 uppercase tracking-wider">Medio de Pago:</label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: 'efectivo', label: 'Efectivo' },
                  { id: 'transferencia', label: 'Transferencia' },
                  { id: 'posnet_tarjeta', label: 'Tarjeta / MP' },
                  { id: 'cuenta_corriente', label: 'Cta Corriente' },
                ].map((pm) => (
                  <button
                    key={pm.id}
                    onClick={() => setSelectedPayment(pm.id)}
                    className={`py-2.5 px-3 rounded-lg text-xs font-bold border transition uppercase tracking-wider ${
                      selectedPayment === pm.id
                        ? 'bg-blue-600 text-white border-blue-400 shadow-md shadow-blue-900/20'
                        : 'bg-[#121215] text-zinc-300 border-zinc-800'
                    }`}
                  >
                    {pm.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                onClick={() => setFinishModalOpen(false)}
                className="py-3 bg-zinc-800 text-zinc-300 font-bold text-xs rounded-lg uppercase tracking-wider"
              >
                Volver
              </button>
              <button
                onClick={() => {
                  updateTripStatus(activeTrip.id, 'completed');
                  setFinishModalOpen(false);
                }}
                className="py-3 bg-emerald-500 text-zinc-950 font-extrabold text-xs rounded-lg shadow-lg shadow-emerald-500/30 uppercase tracking-wider"
              >
                COBRADO Y COMPLETADO
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

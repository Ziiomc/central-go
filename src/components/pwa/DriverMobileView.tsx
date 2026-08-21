import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity, BarChart3, BellRing,Camera, CheckCircle, Clock, DollarSign, Download, ExternalLink,
  Gauge, MapPin, Moon, Navigation, Phone, Play, Radio, Route, ShieldAlert, Smartphone, Sun, User,
  UserCircle2, Wifi, X, XCircle,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import type { FareDestination, Trip } from '../../types';
import { soundManager } from '../../lib/audio';
import { primeRadioAudio, speakVHFDispatch } from '../../lib/audioService';
import { isPWAStandalone, promptPWAInstall } from '../../lib/pwa';
import { endDriverPresence, loadDriverAnalytics, pingDriverPresence, type DriverAnalytics } from '../../lib/driverOperations';
import { loadFareDestinations } from '../../lib/operationalIntelligenceRepository';
import { isFlexibleDestinationAddress, isValidMapCoordinate } from '../../lib/flexibleDestination';
import { useColorTheme } from '../../lib/theme';
import centralGoLogo from '../../assets/images/central-go-logo.svg';
import{uploadOwnAvatar}from'../../lib/profileMediaRepository';

const GPS_WANTED_KEY = 'centralgo-driver-gps-wanted';

const formatDuration = (seconds: number) => {
  const totalMinutes = Math.max(0, Math.round(seconds / 60));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return hours ? `${hours}h ${minutes.toString().padStart(2, '0')}m` : `${minutes} min`;
};

const todayRange = () => {
  const from = new Date();
  from.setHours(0, 0, 0, 0);
  return { from, to: new Date() };
};

const isIOSDevice = () => {
  const ua = navigator.userAgent || '';
  return /iPad|iPhone|iPod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
};

export const DriverMobileView: React.FC = () => {
  const {
    drivers, trips, notifications, markNotificationAsRead, updateTripStatus, toggleDriverAvailability,
    updateDriverLocation, triggerDriverSOS, resolveDriverSOS, rejectTripOffer, currentUser, currentCompany,
  } = useApp();
  const { signOut,refreshIdentity } = useAuth();
  const { theme, setTheme } = useColorTheme();

  const driver = drivers.find((item) => item.userId === currentUser.id);
  const [isGpsActive, setIsGpsActive] = useState(false);
  const [gpsText, setGpsText] = useState('GPS iniciando…');
  const [installHint, setInstallHint] = useState('');
  const [standalone, setStandalone] = useState(() => isPWAStandalone());
  const [radioReady, setRadioReady] = useState(() => localStorage.getItem('centralgo-driver-radio-ready') === '1');
  const [radioBanner, setRadioBanner] = useState<string | null>(null);
  const [radioHistoryOpen, setRadioHistoryOpen] = useState(false);
  const [analytics, setAnalytics] = useState<DriverAnalytics | null>(null);
  const [analyticsError, setAnalyticsError] = useState('');
  const [profileOpen, setProfileOpen] = useState(false);
  const [tariffs, setTariffs] = useState<FareDestination[]>([]);
  const [incomingOffer, setIncomingOffer] = useState<Trip | null>(null);
  const [offerTimer, setOfferTimer] = useState(15);
  const [sosConfirmOpen, setSosConfirmOpen] = useState(false);
  const [finishModalOpen, setFinishModalOpen] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState('efectivo');
  const[photoBusy,setPhotoBusy]=useState(false);

  const gpsWatchId = useRef<number | null>(null);
  const gpsPollId = useRef<number | null>(null);
  const lastGpsSent = useRef<{ at: number; lat: number; lng: number } | null>(null);
  const lastRadioNotificationId = useRef<string | null>(null);
  const radioHistoryTimerRef = useRef<number | null>(null);
  const radioToastTimerRef = useRef<number | null>(null);

  const activeTrip = trips.find(
    (trip) => trip.driverId === driver?.id && ['assigned', 'en_route', 'arrived', 'in_progress'].includes(trip.status),
  );
  const activeTripHasFlexibleDestination = Boolean(activeTrip && isFlexibleDestinationAddress(activeTrip.destination.address));

  const radioMessages = useMemo(
    () => driver
      ? notifications.filter((item) => item.relatedId === driver.id && item.title.startsWith('RADIO CENTRAL'))
          .slice().sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      : [],
    [driver?.id, notifications],
  );
  const newestRadioMessage = radioMessages[0];

  const enableRadioAlerts = async () => {
    const [audioReady, chimeReady] = await Promise.all([primeRadioAudio(), soundManager.prime()]);
    if ('Notification' in window && Notification.permission === 'default') {
      try { await Notification.requestPermission(); } catch {}
    }
    setRadioReady(audioReady || chimeReady || 'speechSynthesis' in window);
    localStorage.setItem('centralgo-driver-radio-ready', '1');
    setRadioBanner('Radio digital activada.');
    if (radioToastTimerRef.current !== null) window.clearTimeout(radioToastTimerRef.current);
    radioToastTimerRef.current = window.setTimeout(() => setRadioBanner(null), 3000);
  };

  useEffect(() => {
    if (!radioReady) return;
    void primeRadioAudio();
  }, [radioReady]);

  useEffect(() => {
    if (!driver || !newestRadioMessage || lastRadioNotificationId.current === newestRadioMessage.id) return;
    lastRadioNotificationId.current = newestRadioMessage.id;
    const ageMs = Date.now() - new Date(newestRadioMessage.timestamp).getTime();
    if (newestRadioMessage.read || ageMs > 5 * 60 * 1000) return;
    setRadioBanner(newestRadioMessage.message);
    setRadioHistoryOpen(true);
    if (radioToastTimerRef.current !== null) window.clearTimeout(radioToastTimerRef.current);
    radioToastTimerRef.current = window.setTimeout(() => setRadioBanner(null), 4500);
    if (radioHistoryTimerRef.current !== null) window.clearTimeout(radioHistoryTimerRef.current);
    radioHistoryTimerRef.current = window.setTimeout(() => setRadioHistoryOpen(false), 5000);
    if (radioReady) {
      void speakVHFDispatch(newestRadioMessage.message);
      if ('vibrate' in navigator) navigator.vibrate([240, 100, 380]);
    }
    void Promise.resolve(markNotificationAsRead(newestRadioMessage.id)).catch(() => undefined);
  }, [driver?.id, markNotificationAsRead, newestRadioMessage?.id, radioReady]);

  const refreshAnalytics = async () => {
    if (!driver || !currentCompany.id || currentCompany.id === 'network') return;
    try {
      const { from, to } = todayRange();
      setAnalytics(await loadDriverAnalytics(currentCompany.id, from, to));
      setAnalyticsError('');
    } catch (error) {
      setAnalyticsError(error instanceof Error ? error.message : 'No pudimos actualizar tus métricas.');
    }
  };

  useEffect(() => {
    if (!driver || !currentCompany.id || currentCompany.id === 'network') return;
    let cancelled = false;
    const heartbeat = async () => {
      try {
        await pingDriverPresence(currentCompany.id);
        if (!cancelled) await refreshAnalytics();
      } catch (error) {
        if (!cancelled) setAnalyticsError(error instanceof Error ? error.message : 'Sincronización pendiente.');
      }
    };
    void heartbeat();
    const interval = window.setInterval(() => void heartbeat(), 60000);
    const visible = () => { if (document.visibilityState === 'visible') void heartbeat(); };
    document.addEventListener('visibilitychange', visible);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', visible);
    };
  }, [driver?.id, currentCompany.id]);

  useEffect(() => {
    if (driver) void refreshAnalytics();
  }, [driver?.todayEarnings, driver?.totalTripsCompleted, activeTrip?.status]);

  useEffect(() => {
    if (!profileOpen || currentCompany.id === 'network') return;
    void loadFareDestinations(currentCompany.id).then((items) => setTariffs(items.filter((item) => item.active))).catch(() => setTariffs([]));
  }, [profileOpen, currentCompany.id]);

  const sendGpsPosition = (position: GeolocationPosition, force = false) => {
    if (!driver) return;
    const { latitude, longitude, accuracy, speed } = position.coords;
    const now = Date.now();
    const last = lastGpsSent.current;
    const metersApprox = last
      ? Math.hypot(
          (latitude - last.lat) * 111320,
          (longitude - last.lng) * 111320 * Math.cos(latitude * Math.PI / 180),
        )
      : Infinity;
    const shouldSend = force || !last || now - last.at >= 7000 || metersApprox >= 10;

    setIsGpsActive(true);
    setGpsText(`GPS EN VIVO · ±${Math.round(accuracy)} m${speed != null ? ` · ${Math.round(speed * 3.6)} km/h` : ''}`);

    if (!shouldSend) return;
    lastGpsSent.current = { at: now, lat: latitude, lng: longitude };
    void Promise.resolve(
      updateDriverLocation(driver.id, latitude, longitude, `GPS ${latitude.toFixed(5)}, ${longitude.toFixed(5)}`),
    ).catch(() => setGpsText('GPS activo · sincronización pendiente'));
  };

  const requestFreshPosition = (force = true) => {
    if (!navigator.geolocation || !driver || document.visibilityState !== 'visible') return;
    navigator.geolocation.getCurrentPosition(
      (position) => sendGpsPosition(position, force),
      (error) => {
        if (error.code === 1) {
          setIsGpsActive(false);
          setGpsText('Permite ubicación precisa para Central GO');
          localStorage.setItem(GPS_WANTED_KEY, '0');
        } else if (!isGpsActive) {
          setGpsText('Buscando señal GPS…');
        }
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 12000 },
    );
  };

  const stopGpsTracking = (rememberOff = true) => {
    if (gpsWatchId.current !== null && navigator.geolocation) navigator.geolocation.clearWatch(gpsWatchId.current);
    if (gpsPollId.current !== null) window.clearInterval(gpsPollId.current);
    gpsWatchId.current = null;
    gpsPollId.current = null;
    setIsGpsActive(false);
    setGpsText('GPS detenido');
    if (rememberOff) localStorage.setItem(GPS_WANTED_KEY, '0');
  };

  const startGpsTracking = async () => {
    if (!navigator.geolocation || !driver) return;
    localStorage.setItem(GPS_WANTED_KEY, '1');
    if (!radioReady) void enableRadioAlerts();
    setGpsText('Solicitando ubicación precisa…');

    if (gpsWatchId.current === null) {
      gpsWatchId.current = navigator.geolocation.watchPosition(
        (position) => sendGpsPosition(position),
        (error) => {
          if (error.code === 1) {
            stopGpsTracking(false);
            localStorage.setItem(GPS_WANTED_KEY, '0');
            setGpsText('Permiso de ubicación denegado');
          } else {
            setGpsText('Reconectando GPS…');
          }
        },
        { enableHighAccuracy: true, maximumAge: 2000, timeout: 20000 },
      );
    }

    requestFreshPosition(true);
    if (gpsPollId.current === null) {
      gpsPollId.current = window.setInterval(() => {
        if (document.visibilityState === 'visible' && localStorage.getItem(GPS_WANTED_KEY) === '1') requestFreshPosition(false);
      }, 10000);
    }
  };

  const toggleGpsTracking = async () => {
    if (!navigator.geolocation || !driver) return setGpsText('GPS no disponible');
    if (localStorage.getItem(GPS_WANTED_KEY) === '1' && (isGpsActive || gpsWatchId.current !== null)) stopGpsTracking(true);
    else await startGpsTracking();
  };

  useEffect(() => {
    if (!driver) return;
    if (localStorage.getItem(GPS_WANTED_KEY) !== '0') localStorage.setItem(GPS_WANTED_KEY, '1');
    if (localStorage.getItem(GPS_WANTED_KEY) === '1') void startGpsTracking();

    const resume = () => {
      if (localStorage.getItem(GPS_WANTED_KEY) !== '1') return;
      if (document.visibilityState === 'visible') {
        void startGpsTracking();
        requestFreshPosition(true);
      }
    };
    document.addEventListener('visibilitychange', resume);
    window.addEventListener('focus', resume);
    window.addEventListener('pageshow', resume);
    return () => {
      document.removeEventListener('visibilitychange', resume);
      window.removeEventListener('focus', resume);
      window.removeEventListener('pageshow', resume);
    };
  }, [driver?.id]);

  useEffect(() => {
    const installed = () => { setStandalone(true); setInstallHint('App instalada.'); };
    const installable = () => setInstallHint('Lista para instalar.');
    window.addEventListener('appinstalled', installed);
    window.addEventListener('pwa-installable', installable);
    return () => {
      window.removeEventListener('appinstalled', installed);
      window.removeEventListener('pwa-installable', installable);
      if (gpsWatchId.current !== null && navigator.geolocation) navigator.geolocation.clearWatch(gpsWatchId.current);
      if (gpsPollId.current !== null) window.clearInterval(gpsPollId.current);
      if (radioHistoryTimerRef.current !== null) window.clearTimeout(radioHistoryTimerRef.current);
      if (radioToastTimerRef.current !== null) window.clearTimeout(radioToastTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (activeTrip?.status === 'assigned' && incomingOffer?.id !== activeTrip.id) {
      setIncomingOffer(activeTrip);
      setOfferTimer(15);
      soundManager.playDispatchChime();
      if ('vibrate' in navigator) navigator.vibrate([90, 60, 150, 80, 260]);
    }
    if (activeTrip?.status && activeTrip.status !== 'assigned' && incomingOffer?.id === activeTrip.id) setIncomingOffer(null);
  }, [activeTrip?.id, activeTrip?.status, incomingOffer?.id]);

  useEffect(() => {
    if (!incomingOffer) return;
    if (offerTimer <= 0) {
      const expiredOffer = incomingOffer;
      setIncomingOffer(null);
      void Promise.resolve(
        rejectTripOffer(expiredOffer.id, 'Oferta no aceptada dentro de 15 segundos')
      ).catch(() => undefined);
      return;
    }
    const timer = window.setTimeout(() => setOfferTimer((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearTimeout(timer);
  }, [incomingOffer?.id, offerTimer]);

  const installDriverApp = async () => {
    if (isPWAStandalone()) return setInstallHint('Ya está instalada.');
    if (await promptPWAInstall()) return setInstallHint('Instalación aceptada.');
    setInstallHint(isIOSDevice() ? 'iPhone: Compartir → Agregar a pantalla de inicio.' : 'Menú ⋮ → Instalar aplicación.');
  };

  const handleSignOut = async () => {
    if (currentCompany.id !== 'network') await endDriverPresence(currentCompany.id).catch(() => undefined);
    await signOut();
  };

  if (!driver) {
    return (
      <main className="min-h-screen bg-[#09090b] p-5 text-zinc-100">
        <section className="mx-auto mt-10 max-w-md rounded-3xl border border-amber-500/25 bg-[#0d0d0f] p-7 text-center">
          <Smartphone className="mx-auto h-10 w-10 text-amber-300" />
          <h1 className="mt-4 text-xl font-black">Cuenta sin móvil vinculado</h1>
          <p className="mt-2 text-sm text-zinc-400">El administrador debe asociar este acceso a un conductor.</p>
          <button onClick={() => void handleSignOut()} className="mt-5 rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-2.5 text-xs font-bold">Cerrar sesión</button>
        </section>
      </main>
    );
  }

  const acceptOffer = () => {
    if (!incomingOffer) return;
    if (!radioReady) void enableRadioAlerts();
    void Promise.resolve(updateTripStatus(incomingOffer.id, 'en_route'));
    setIncomingOffer(null);
  };

  const rejectOffer = () => {
    if (!incomingOffer) return;
    const rejected = incomingOffer;
    setIncomingOffer(null);
    void Promise.resolve(rejectTripOffer(rejected.id, 'Rechazado por conductor')).catch(() => undefined);
  };

  const openGpsNavigation = (address: string, lat: number, lng: number) => {
    if (isFlexibleDestinationAddress(address)) {
      setRadioBanner('Destino a convenir: no existe una dirección fija para abrir en GPS.');
      if (radioToastTimerRef.current !== null) window.clearTimeout(radioToastTimerRef.current);
      radioToastTimerRef.current = window.setTimeout(() => setRadioBanner(null), 4000);
      return;
    }
    if (!isValidMapCoordinate(lat,lng)) {
      setRadioBanner('La dirección todavía no tiene coordenadas GPS válidas.');
      if (radioToastTimerRef.current !== null) window.clearTimeout(radioToastTimerRef.current);
      radioToastTimerRef.current = window.setTimeout(() => setRadioBanner(null), 4000);
      return;
    }
    const label = encodeURIComponent(address);
    if (/Android/i.test(navigator.userAgent || '')) {
      window.location.href = `geo:${lat},${lng}?q=${lat},${lng}(${label})`;
    } else if (isIOSDevice()) {
      window.location.href = `https://maps.apple.com/?daddr=${lat},${lng}&q=${label}&dirflg=d`;
    } else {
      window.open(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving&dir_action=navigate`, '_blank', 'noopener,noreferrer');
    }
  };

  const setStatus = (status: 'available' | 'paused' | 'offline') => {
    if (!radioReady) void enableRadioAlerts();
    void Promise.resolve(toggleDriverAvailability(driver.id, status));
  };

  const arrivedAtPassenger = async () => {
    await Promise.resolve(updateTripStatus(activeTrip!.id, 'arrived'));
    requestFreshPosition(true);
  };

  const destinationIsNext = activeTrip?.status === 'arrived' || activeTrip?.status === 'in_progress';
  const navAddress = activeTrip ? (destinationIsNext ? activeTrip.destination.address : activeTrip.origin.address) : '';
  const navLat = activeTrip ? (destinationIsNext ? activeTrip.destination.lat : activeTrip.origin.lat) : 0;
  const navLng = activeTrip ? (destinationIsNext ? activeTrip.destination.lng : activeTrip.origin.lng) : 0;
  const canNavigateCurrentLeg = Boolean(activeTrip && (!destinationIsNext || (!activeTripHasFlexibleDestination && isValidMapCoordinate(navLat,navLng))));
  const changePhoto=async(file?:File)=>{if(!file)return;setPhotoBusy(true);try{await uploadOwnAvatar(currentUser.id,file);await refreshIdentity();}catch(error){setAnalyticsError(error instanceof Error?error.message:'No fue posible guardar tu fotografía.');}finally{setPhotoBusy(false);}};

  return (
    <main className="cg-driver-app min-h-screen bg-[#08090c] px-2.5 py-2.5 text-zinc-100 sm:px-3">
      {radioBanner && (
        <div className="fixed left-1/2 top-3 z-[160] w-[min(410px,calc(100vw-1rem))] -translate-x-1/2 rounded-2xl border border-amber-400/50 bg-[#111014]/95 px-3 py-2.5 shadow-2xl backdrop-blur-xl">
          <div className="flex gap-2.5"><Radio className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" /><p className="text-xs font-bold text-white">{radioBanner}</p></div>
        </div>
      )}

      <div className="relative mx-auto max-w-md space-y-2 pb-5">
        <header className="flex items-center justify-between rounded-xl border border-blue-500/25 bg-[#111114] px-2.5 py-2 shadow-lg shadow-blue-950/20">
          <div className="flex min-w-0 items-center gap-2">
            <img src={centralGoLogo} alt="Central GO" className="h-8 w-8 rounded-lg border border-blue-400/35 bg-zinc-950 p-0.5" />
            <div className="min-w-0">
              <p className="truncate text-[12px] font-black text-white">Central <span className="text-blue-300">GO</span></p>
              <div className="flex items-center gap-1.5 text-[8px]">
                <span className={driver.status === 'available' ? 'text-emerald-300' : 'text-zinc-500'}>{driver.status === 'available' ? '● DISPONIBLE' : driver.status.toUpperCase()}</span>
                <span className="text-blue-300"><Wifi className="mr-0.5 inline h-2.5 w-2.5" />Sincronizado</span>
              </div>
            </div>
          </div>
          <button onClick={() => setProfileOpen(true)} className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border border-zinc-700 bg-zinc-950 text-zinc-300" aria-label="Perfil y analíticas">
            {driver.photoUrl||currentUser.avatarUrl?<img src={driver.photoUrl||currentUser.avatarUrl} alt="Mi perfil" className="h-full w-full object-cover"/>:<UserCircle2 className="h-5 w-5" />}
          </button>
        </header>

        {!radioReady && (
          <section className="rounded-xl border border-blue-500/25 bg-blue-500/[0.05] px-3 py-2.5">
            <div className="flex items-center justify-between gap-3">
              <div className="flex gap-2"><Radio className="h-4 w-4 text-blue-300" /><div><p className="text-[10px] font-black">Activar Radio Central</p><p className="text-[8px] text-zinc-500">Voz, vibración y alertas</p></div></div>
              <button onClick={() => void enableRadioAlerts()} className="rounded-lg bg-blue-600 px-2.5 py-1.5 text-[9px] font-black"><BellRing className="mr-1 inline h-3 w-3" />Activar</button>
            </div>
          </section>
        )}

        {newestRadioMessage && (
          <section className="overflow-hidden rounded-xl border border-zinc-800 bg-[#121215]">
            <button onClick={() => setRadioHistoryOpen((v) => !v)} className="flex w-full items-center justify-between px-3 py-2.5 text-left">
              <div className="flex items-center gap-2"><Radio className="h-4 w-4 text-amber-300" /><div><p className="text-[10px] font-black">Último mensaje de central</p><p className="text-[8px] text-zinc-600">Toca para ver</p></div></div>
              <span className="text-zinc-600">⌄</span>
            </button>
            {radioHistoryOpen && <div className="border-t border-zinc-800 px-3 py-2 text-[11px] text-zinc-200">{newestRadioMessage.message}</div>}
          </section>
        )}

        <section className="rounded-xl border border-zinc-800 bg-[#121215] p-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2"><Navigation className={`h-4 w-4 ${isGpsActive ? 'text-blue-400' : 'text-zinc-600'}`} /><div className="min-w-0"><p className="truncate text-[11px] font-bold">{gpsText}</p><p className="truncate text-[8px] text-zinc-600">{driver.currentLocation.address || 'Ubicación pendiente'}</p></div></div>
            <button onClick={() => void toggleGpsTracking()} className={`shrink-0 rounded-lg border px-2.5 py-1.5 text-[9px] font-black ${isGpsActive ? 'border-blue-500/40 bg-blue-500/15 text-blue-300' : 'border-zinc-700 bg-zinc-900'}`}>{isGpsActive ? 'GPS ON' : 'Activar GPS'}</button>
          </div>
          {isIOSDevice() && <p className="mt-2 text-[8px] leading-relaxed text-zinc-600">iPhone: mantén Ubicación Precisa habilitada. Al volver desde Mapas, Central GO fuerza una nueva lectura automáticamente.</p>}
        </section>

        <section className="grid grid-cols-3 gap-1.5 rounded-xl border border-zinc-800 bg-[#121215] p-1.5">
          <StatusButton active={driver.status === 'available'} label="Disponible" tone="emerald" onClick={() => setStatus('available')} />
          <StatusButton active={driver.status === 'paused'} label="Pausa" tone="amber" icon={<Clock className="h-3.5 w-3.5" />} onClick={() => setStatus('paused')} />
          <StatusButton active={driver.status === 'offline'} label="Fuera" tone="zinc" icon={<XCircle className="h-3.5 w-3.5" />} onClick={() => setStatus('offline')} />
        </section>

        {incomingOffer && (
          <section className="rounded-2xl border-2 border-blue-500 bg-blue-500/[0.06] p-4 shadow-2xl">
            <div className="flex items-center justify-between"><span className="rounded-lg bg-blue-600 px-3 py-1 text-[9px] font-black uppercase">Nueva carrera</span><span className="text-sm font-black text-blue-300">{offerTimer > 0 ? `${offerTimer}s` : 'Pendiente'}</span></div>
            <div className="mt-3"><p className="text-[8px] uppercase text-zinc-600">Retiro</p><p className="mt-1 flex gap-2 text-xs font-bold"><MapPin className="h-4 w-4 text-emerald-400" />{incomingOffer.origin.address}</p></div>
            <div className="mt-3 grid grid-cols-2 gap-2"><MiniValue label="Tarifa estimada" value={`$${incomingOffer.estimatedFare.toLocaleString('es-CL')}`} accent /><MiniValue label="Distancia" value={isFlexibleDestinationAddress(incomingOffer.destination.address)?'A convenir':`${incomingOffer.estimatedDistanceKm} km`} /></div>
            <div className="mt-3 grid grid-cols-2 gap-2"><button onClick={rejectOffer} className="rounded-xl bg-zinc-800 py-2.5 text-[10px] font-black text-rose-300">Rechazar</button><button onClick={acceptOffer} className="rounded-xl bg-emerald-400 py-2.5 text-[10px] font-black text-zinc-950">Aceptar carrera</button></div>
          </section>
        )}

        {activeTrip && !incomingOffer && (
          <section className="space-y-3 rounded-2xl border border-zinc-800 bg-[#121215] p-3 shadow-xl">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-2.5"><div><p className="text-[8px] font-black uppercase tracking-widest text-blue-400">Carrera {activeTrip.code}</p><p className="mt-0.5 text-[11px] font-bold">{activeTrip.status === 'in_progress' ? 'Pasajero a bordo' : activeTrip.status === 'arrived' ? 'En domicilio' : 'En camino al pasajero'}</p></div><span className="rounded-full border border-blue-500/25 bg-blue-500/10 px-2 py-1 text-[8px] font-black uppercase text-blue-300">Activa</span></div>
            <div className="flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-950 p-2.5"><div className="flex items-center gap-2.5"><User className="h-4 w-4 text-blue-400" /><div><p className="text-[11px] font-black">{activeTrip.clientName}</p><p className="text-[9px] text-zinc-500">{activeTrip.clientPhone || 'Sin teléfono'}</p></div></div>{activeTrip.clientPhone && <a href={`tel:${activeTrip.clientPhone}`} className="rounded-lg bg-blue-600 p-2"><Phone className="h-4 w-4" /></a>}</div>
            <div className="space-y-2.5"><RoutePoint label="Retiro" text={activeTrip.origin.address} /><RoutePoint label="Destino" text={activeTrip.destination.address} destination /></div>
            <div className="flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-950 p-2.5"><div><p className="text-[8px] uppercase text-zinc-600">Tarifa</p><p className="text-sm font-black text-emerald-400">${activeTrip.estimatedFare.toLocaleString('es-CL')}</p></div><div className="text-right"><p className="text-[8px] uppercase text-zinc-600">Pago</p><p className="text-[9px] font-black uppercase">{activeTrip.paymentMethod}</p></div></div>
            {canNavigateCurrentLeg?<button onClick={() => openGpsNavigation(navAddress, navLat, navLng)} className="flex w-full items-center justify-center gap-2 rounded-xl border border-blue-500/25 bg-blue-500/10 py-2.5 text-[10px] font-black text-blue-300"><ExternalLink className="h-4 w-4" />{destinationIsNext ? 'Abrir GPS al destino' : 'Abrir GPS al pasajero'}</button>:<div className="rounded-xl border border-amber-500/25 bg-amber-500/10 px-3 py-2.5 text-center"><p className="text-[10px] font-black text-amber-300">Destino a convenir / Taxímetro</p><p className="mt-0.5 text-[9px] text-zinc-500">No se abrirá un GPS de destino hasta que exista una dirección real.</p></div>}
            <div className="space-y-1.5 border-t border-zinc-800 pt-2.5">
              <button onClick={() => void arrivedAtPassenger()} disabled={activeTrip.status === 'arrived' || activeTrip.status === 'in_progress'} className="flex w-full items-center justify-center gap-2 rounded-xl border border-blue-500/30 bg-blue-500/10 py-2.5 text-[10px] font-black text-blue-300 disabled:opacity-30"><CheckCircle className="h-4 w-4" />Llegué al pasajero</button>
              <button onClick={() => { void Promise.resolve(updateTripStatus(activeTrip.id, 'in_progress')); requestFreshPosition(true); }} className="flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 py-2.5 text-[10px] font-black text-emerald-300"><Play className="h-4 w-4" />Pasajero a bordo</button>
              <button onClick={() => setFinishModalOpen(true)} className="flex w-full items-center justify-center gap-2 rounded-xl bg-rose-600 py-3 text-[10px] font-black"><DollarSign className="h-4 w-4" />Finalizar y cobrar</button>
            </div>
          </section>
        )}

        {!activeTrip && !incomingOffer && <section className="rounded-xl border border-zinc-800 bg-[#121215] px-4 py-4 text-center"><Navigation className="mx-auto h-7 w-7 text-blue-400" /><h3 className="mt-2 text-[12px] font-black">Esperando asignación</h3><p className="mt-1 text-[10px] text-zinc-500">{isGpsActive ? 'Ubicación sincronizada con la central.' : 'Activa GPS para aparecer en el mapa.'}</p></section>}

        <section className="border-t border-zinc-800 pt-2">{driver.sosActive ? <button onClick={() => void Promise.resolve(resolveDriverSOS(driver.id))} className="flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-500/40 bg-zinc-800 py-3 text-[10px] font-black text-emerald-300"><ShieldAlert className="h-4 w-4" />SOS activo · cerrar emergencia</button> : <button onClick={() => setSosConfirmOpen(true)} className="flex w-full items-center justify-center gap-2 rounded-xl bg-red-600 py-3.5 text-[11px] font-black shadow-lg"><ShieldAlert className="h-5 w-5" />SOS DE EMERGENCIA</button>}</section>
      </div>

      {profileOpen && (
        <div className="fixed inset-0 z-[190] overflow-y-auto bg-black/80 p-3 backdrop-blur-md">
          <section className="mx-auto my-4 w-full max-w-sm rounded-3xl border border-zinc-700 bg-[#0d0d0f] p-5 shadow-2xl">
            <div className="flex items-start justify-between"><div className="flex items-center gap-3"><div className="grid h-16 w-16 place-items-center overflow-hidden rounded-2xl border border-zinc-700 bg-zinc-950">{driver.photoUrl||currentUser.avatarUrl?<img src={driver.photoUrl||currentUser.avatarUrl} alt="Mi perfil" className="h-full w-full object-cover"/>:<UserCircle2 className="h-8 w-8 text-zinc-500"/>}</div><div><p className="text-[9px] font-black uppercase tracking-widest text-zinc-400">Conductor</p><h2 className="mt-1 text-xl font-black">{driver.name}</h2><p className="text-xs text-zinc-500">Móvil {driver.unitNumber}</p></div></div><button onClick={() => setProfileOpen(false)} className="rounded-xl border border-zinc-800 bg-zinc-950 p-2"><X className="h-4 w-4" /></button></div>
            <label className="mt-3 flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-zinc-700 bg-zinc-900 py-2.5 text-[10px] font-black"><Camera className="h-4 w-4"/>{photoBusy?'Subiendo foto…':'Cambiar mi foto'}<input type="file" accept="image/jpeg,image/png,image/webp" capture="user" disabled={photoBusy} className="hidden" onChange={e=>void changePhoto(e.target.files?.[0])}/></label>
            <div className="mt-3 rounded-2xl border border-zinc-800 bg-zinc-950/60 p-3">
              <div className="flex items-center justify-between gap-3"><div><p className="text-xs font-black">Apariencia</p><p className="mt-0.5 text-[8px] text-zinc-500">Elige cómo quieres ver tu aplicación.</p></div><span className="text-[8px] font-black uppercase text-blue-300">Personal</span></div>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <button type="button" onClick={() => setTheme('light')} aria-pressed={theme === 'light'} className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-[10px] font-black transition ${theme === 'light' ? 'border-blue-400 bg-blue-500/15 text-blue-300' : 'border-zinc-800 bg-zinc-900 text-zinc-400'}`}><Sun className="h-4 w-4" />Claro</button>
                <button type="button" onClick={() => setTheme('dark')} aria-pressed={theme === 'dark'} className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-[10px] font-black transition ${theme === 'dark' ? 'border-blue-400 bg-blue-500/15 text-blue-300' : 'border-zinc-800 bg-zinc-900 text-zinc-400'}`}><Moon className="h-4 w-4" />Oscuro</button>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2"><MiniValue label="Ganancias hoy" value={`$${(analytics?.earnings ?? driver.todayEarnings).toLocaleString('es-CL')}`} accent /><MiniValue label="Viajes hoy" value={String(analytics?.tripsCompleted ?? 0)} /></div>
            <div className="mt-3 rounded-2xl border border-zinc-800 bg-zinc-950/60 p-3">
              <div className="mb-3 flex items-center justify-between"><p className="flex items-center gap-2 text-xs font-black"><BarChart3 className="h-4 w-4 text-violet-400" />Mi jornada</p><button onClick={() => void refreshAnalytics()} className="rounded-lg border border-zinc-700 px-2 py-1 text-[8px]">Actualizar</button></div>
              <div className="grid grid-cols-2 gap-1.5"><Metric icon={<Activity className="h-3.5 w-3.5" />} label="Conectado" value={analytics ? formatDuration(analytics.connectedSeconds) : '—'} /><Metric icon={<Gauge className="h-3.5 w-3.5" />} label="Conduciendo" value={analytics ? formatDuration(analytics.drivingSeconds) : '—'} /><Metric icon={<Route className="h-3.5 w-3.5" />} label="Km servicio" value={analytics ? `${analytics.serviceKm.toFixed(1)} km` : '—'} /><Metric icon={<CheckCircle className="h-3.5 w-3.5" />} label="Viajes" value={String(analytics?.tripsCompleted ?? 0)} /></div>
              {analyticsError && <p className="mt-2 text-[8px] text-amber-300">{analyticsError}</p>}
            </div>
            <div className="mt-3 rounded-2xl border border-amber-500/20 bg-amber-500/[0.04] p-3">
              <div className="flex items-center justify-between"><p className="text-xs font-black text-white">Tarifario de destinos</p><span className="text-[8px] font-black uppercase text-amber-300">Oficial</span></div>
              <div className="mt-2 max-h-48 space-y-1.5 overflow-y-auto">{tariffs.map((item)=><div key={item.id} className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-950/70 px-3 py-2"><span className="text-[10px] font-semibold text-zinc-300">{item.name}</span><span className="text-[10px] font-black text-emerald-300">${Math.round(item.fareAmount).toLocaleString('es-CL')}</span></div>)}{!tariffs.length&&<p className="py-3 text-center text-[9px] text-zinc-600">La central aún no ha cargado tarifas fijas por destino.</p>}</div>
            </div>
            {!standalone && <button onClick={() => void installDriverApp()} className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-amber-500/25 bg-amber-500/10 py-3 text-xs font-black text-amber-200"><Download className="h-4 w-4" />Instalar app del conductor</button>}
            {installHint && <p className="mt-2 text-center text-[9px] text-zinc-500">{installHint}</p>}
            <button onClick={() => void handleSignOut()} className="mt-3 w-full rounded-xl border border-zinc-700 bg-zinc-900 py-3 text-xs font-black text-zinc-300">Cerrar sesión</button>
          </section>
        </div>
      )}

      {sosConfirmOpen && <ModalShell><ShieldAlert className="mx-auto h-10 w-10 text-red-500" /><h3 className="mt-3 text-center text-base font-black">¿Activar SOS?</h3><p className="mt-2 text-center text-xs text-zinc-400">La central recibirá una alerta prioritaria con tu última ubicación.</p><div className="mt-5 grid grid-cols-2 gap-3"><button onClick={() => setSosConfirmOpen(false)} className="rounded-xl bg-zinc-800 py-3 text-xs font-bold">Cancelar</button><button onClick={() => { requestFreshPosition(true); void Promise.resolve(triggerDriverSOS(driver.id)); setSosConfirmOpen(false); }} className="rounded-xl bg-red-600 py-3 text-xs font-black">Activar SOS</button></div></ModalShell>}

      {finishModalOpen && activeTrip && <ModalShell><h3 className="text-center text-base font-black">Finalizar {activeTrip.code}</h3><p className="mt-1 text-center text-xs text-zinc-500">Confirma el medio de pago recibido.</p><div className="mt-4 rounded-xl border border-zinc-800 bg-zinc-950 p-4 text-center"><p className="text-[9px] uppercase text-zinc-600">Monto</p><p className="mt-1 text-3xl font-black text-emerald-400">${activeTrip.estimatedFare.toLocaleString('es-CL')}</p></div><div className="mt-4 grid grid-cols-2 gap-2">{[['efectivo', 'Efectivo'], ['transferencia', 'Transferencia'], ['posnet_tarjeta', 'Tarjeta'], ['cuenta_corriente', 'Cta. corriente']].map(([id, label]) => <button key={id} onClick={() => setSelectedPayment(id)} className={`rounded-xl border px-3 py-3 text-xs font-bold ${selectedPayment === id ? 'border-blue-500 bg-blue-600' : 'border-zinc-800 bg-zinc-900'}`}>{label}</button>)}</div><div className="mt-5 grid grid-cols-2 gap-3"><button onClick={() => setFinishModalOpen(false)} className="rounded-xl bg-zinc-800 py-3 text-xs font-bold">Volver</button><button onClick={() => { requestFreshPosition(true); void Promise.resolve(updateTripStatus(activeTrip.id, 'completed', `Pago: ${selectedPayment}`)).then(() => void refreshAnalytics()); setFinishModalOpen(false); }} className="rounded-xl bg-emerald-400 py-3 text-xs font-black text-zinc-950">Cobrado y completado</button></div></ModalShell>}
    </main>
  );
};

const Metric: React.FC<{ icon: React.ReactNode; label: string; value: string }> = ({ icon, label, value }) => <div className="rounded-lg border border-zinc-800 bg-zinc-950/70 p-2.5"><div className="flex items-center gap-1.5 text-violet-300">{icon}<span className="text-[8px] font-bold uppercase text-zinc-600">{label}</span></div><p className="mt-1.5 text-sm font-black">{value}</p></div>;
const MiniValue: React.FC<{ label: string; value: string; accent?: boolean }> = ({ label, value, accent }) => <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-2.5"><p className="text-[8px] text-zinc-600">{label}</p><p className={`mt-1 text-sm font-black ${accent ? 'text-emerald-400' : 'text-white'}`}>{value}</p></div>;
const StatusButton: React.FC<{ active: boolean; label: string; tone: 'emerald' | 'amber' | 'zinc'; icon?: React.ReactNode; onClick: () => void }> = ({ active, label, tone, icon, onClick }) => {
  const activeClass = tone === 'emerald' ? 'bg-emerald-400 text-zinc-950 border-emerald-300' : tone === 'amber' ? 'bg-amber-400 text-zinc-950 border-amber-300' : 'bg-zinc-700 text-white border-zinc-600';
  return <button onClick={onClick} className={`flex min-h-12 flex-col items-center justify-center gap-1 rounded-lg border px-2 text-[9px] font-black uppercase ${active ? activeClass : 'border-zinc-800 bg-zinc-950 text-zinc-500'}`}>{icon ?? <span className={`h-2 w-2 rounded-full ${active ? 'bg-current' : 'bg-zinc-700'}`} />}{label}</button>;
};
const RoutePoint: React.FC<{ label: string; text: string; destination?: boolean }> = ({ label, text, destination }) => <div className="flex items-start gap-2.5"><span className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${destination ? 'bg-rose-500' : 'bg-emerald-500'}`} /><div><p className="text-[8px] font-black uppercase tracking-wider text-zinc-600">{label}</p><p className="mt-0.5 text-[11px] font-semibold text-zinc-200">{text}</p></div></div>;
const ModalShell: React.FC<React.PropsWithChildren> = ({ children }) => <div className="fixed inset-0 z-[180] flex items-center justify-center bg-black/85 p-4 backdrop-blur-md"><section className="w-full max-w-sm rounded-3xl border border-zinc-700 bg-[#0d0d0f] p-6 shadow-2xl">{children}</section></div>;

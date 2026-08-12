import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  BarChart3,
  BellRing,
  CheckCircle,
  ChevronDown,
  Clock,
  DollarSign,
  Download,
  ExternalLink,
  Gauge,
  MapPin,
  Navigation,
  Phone,
  Play,
  Radio,
  Route,
  ShieldAlert,
  Smartphone,
  User,
  Wifi,
  X,
  XCircle,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import type { Trip } from '../../types';
import { soundManager } from '../../lib/audio';
import { primeRadioAudio, speakVHFDispatch } from '../../lib/audioService';
import { isPWAStandalone, promptPWAInstall } from '../../lib/pwa';
import {
  endDriverPresence,
  loadDriverAnalytics,
  pingDriverPresence,
  type DriverAnalytics,
} from '../../lib/driverOperations';
import centralGoLogo from '../../assets/images/central-go-logo.svg';

const formatDuration = (seconds: number) => {
  const totalMinutes = Math.max(0, Math.round(seconds / 60));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (!hours) return `${minutes} min`;
  return `${hours}h ${minutes.toString().padStart(2, '0')}m`;
};

const todayRange = () => {
  const from = new Date();
  from.setHours(0, 0, 0, 0);
  return { from, to: new Date() };
};

type NavigationTarget = {
  address: string;
  lat: number;
  lng: number;
};

export const DriverMobileView: React.FC = () => {
  const {
    drivers,
    trips,
    notifications,
    markNotificationAsRead,
    updateTripStatus,
    toggleDriverAvailability,
    updateDriverLocation,
    triggerDriverSOS,
    resolveDriverSOS,
    rejectTripOffer,
    currentUser,
    currentCompany,
  } = useApp();
  const { signOut } = useAuth();

  const driver = drivers.find((item) => item.userId === currentUser.id);
  const [isGpsActive, setIsGpsActive] = useState(false);
  const [gpsText, setGpsText] = useState('GPS detenido');
  const [installHint, setInstallHint] = useState('');
  const [standalone, setStandalone] = useState(() => isPWAStandalone());
  const [radioReady, setRadioReady] = useState(() => localStorage.getItem('centralgo-driver-radio-ready') === '1');
  const [radioBanner, setRadioBanner] = useState<string | null>(null);
  const [radioHistoryOpen, setRadioHistoryOpen] = useState(false);
  const [analytics, setAnalytics] = useState<DriverAnalytics | null>(null);
  const [analyticsError, setAnalyticsError] = useState('');
  const [analyticsOpen, setAnalyticsOpen] = useState(false);
  const [navigationTarget, setNavigationTarget] = useState<NavigationTarget | null>(null);
  const [incomingOffer, setIncomingOffer] = useState<Trip | null>(null);
  const [offerTimer, setOfferTimer] = useState(15);
  const [sosConfirmOpen, setSosConfirmOpen] = useState(false);
  const [finishModalOpen, setFinishModalOpen] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState('efectivo');

  const gpsWatchId = useRef<number | null>(null);
  const lastGpsSent = useRef<{ at: number; lat: number; lng: number } | null>(null);
  const lastRadioNotificationId = useRef<string | null>(null);
  const radioHistoryTimerRef = useRef<number | null>(null);
  const radioToastTimerRef = useRef<number | null>(null);

  const activeTrip = trips.find(
    (trip) => trip.driverId === driver?.id && ['assigned', 'en_route', 'arrived', 'in_progress'].includes(trip.status),
  );

  const radioMessages = useMemo(
    () => driver
      ? notifications
          .filter((item) => item.relatedId === driver.id && item.title === 'RADIO CENTRAL')
          .slice()
          .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      : [],
    [driver?.id, notifications],
  );

  const newestRadioMessage = radioMessages[0];

  const enableRadioAlerts = async () => {
    const audioReady = await primeRadioAudio();
    if ('Notification' in window && Notification.permission === 'default') {
      try { await Notification.requestPermission(); } catch { /* browser may deny silently */ }
    }
    setRadioReady(audioReady || 'speechSynthesis' in window);
    localStorage.setItem('centralgo-driver-radio-ready', '1');
    setRadioBanner('Radio digital activada. Los mensajes de la central se leerán por voz.');
    if (radioToastTimerRef.current !== null) window.clearTimeout(radioToastTimerRef.current);
    radioToastTimerRef.current = window.setTimeout(() => setRadioBanner(null), 3500);
  };

  useEffect(() => {
    if (!radioReady) return;
    void primeRadioAudio();
  }, [radioReady]);

  useEffect(() => {
    if (!driver || !newestRadioMessage) return;
    if (lastRadioNotificationId.current === newestRadioMessage.id) return;
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
      if ('Notification' in window && Notification.permission === 'granted' && document.visibilityState !== 'visible') {
        try {
          new Notification('Central GO · Radio Central', {
            body: newestRadioMessage.message,
            icon: '/icon.svg',
            tag: `radio-${newestRadioMessage.id}`,
          });
        } catch { /* native notification is best effort */ }
      }
    }
    void Promise.resolve(markNotificationAsRead(newestRadioMessage.id)).catch(() => undefined);
  }, [driver?.id, markNotificationAsRead, newestRadioMessage?.id, radioReady]);

  const refreshAnalytics = async () => {
    if (!driver || !currentCompany.id || currentCompany.id === 'network') return;
    try {
      const { from, to } = todayRange();
      const next = await loadDriverAnalytics(currentCompany.id, from, to);
      setAnalytics(next);
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
        if (!cancelled) setAnalyticsError(error instanceof Error ? error.message : 'Sincronización de jornada pendiente.');
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
      void endDriverPresence(currentCompany.id).catch(() => undefined);
    };
  }, [driver?.id, currentCompany.id]);

  useEffect(() => {
    if (!driver) return;
    void refreshAnalytics();
  }, [driver?.todayEarnings, driver?.totalTripsCompleted, activeTrip?.status]);

  const stopGpsTracking = () => {
    if (gpsWatchId.current !== null && navigator.geolocation) navigator.geolocation.clearWatch(gpsWatchId.current);
    gpsWatchId.current = null;
    setIsGpsActive(false);
    setGpsText('GPS detenido');
  };

  const toggleGpsTracking = async () => {
    if (!radioReady) void enableRadioAlerts();
    if (!navigator.geolocation || !driver) {
      setGpsText('GPS no disponible en este dispositivo');
      return;
    }
    if (isGpsActive) {
      stopGpsTracking();
      return;
    }

    setIsGpsActive(true);
    setGpsText('Solicitando GPS de alta precisión…');

    gpsWatchId.current = navigator.geolocation.watchPosition(
      (position) => {
        const { latitude, longitude, accuracy, speed } = position.coords;
        const now = Date.now();
        const last = lastGpsSent.current;
        const metersApprox = last
          ? Math.hypot(
              (latitude - last.lat) * 111320,
              (longitude - last.lng) * 111320 * Math.cos(latitude * Math.PI / 180),
            )
          : Infinity;
        const shouldSend = !last || now - last.at >= 8000 || metersApprox >= 15;

        setGpsText(`GPS EN VIVO · ±${Math.round(accuracy)} m${speed != null ? ` · ${Math.round(speed * 3.6)} km/h` : ''}`);

        if (shouldSend) {
          lastGpsSent.current = { at: now, lat: latitude, lng: longitude };
          void Promise.resolve(
            updateDriverLocation(driver.id, latitude, longitude, `GPS ${latitude.toFixed(5)}, ${longitude.toFixed(5)}`),
          ).catch(() => setGpsText('Error sincronizando GPS con la central'));
        }
      },
      (error) => {
        stopGpsTracking();
        setGpsText(error.code === 1 ? 'Permiso de ubicación denegado' : 'No fue posible obtener ubicación');
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 },
    );
  };

  useEffect(() => {
    const installed = () => {
      setStandalone(true);
      setInstallHint('App instalada.');
    };
    const installable = () => setInstallHint('Lista para instalar.');

    window.addEventListener('appinstalled', installed);
    window.addEventListener('pwa-installable', installable);

    return () => {
      window.removeEventListener('appinstalled', installed);
      window.removeEventListener('pwa-installable', installable);
      if (gpsWatchId.current !== null && navigator.geolocation) navigator.geolocation.clearWatch(gpsWatchId.current);
      if (radioHistoryTimerRef.current !== null) window.clearTimeout(radioHistoryTimerRef.current);
      if (radioToastTimerRef.current !== null) window.clearTimeout(radioToastTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (activeTrip?.status === 'assigned' && incomingOffer?.id !== activeTrip.id) {
      setIncomingOffer(activeTrip);
      setOfferTimer(15);
      soundManager.playDispatchChime();
      if ('vibrate' in navigator) navigator.vibrate([300, 120, 300]);
    }
  }, [activeTrip?.id, activeTrip?.status]);

  useEffect(() => {
    if (!incomingOffer) return;
    if (offerTimer <= 0) {
      const expired = incomingOffer;
      setIncomingOffer(null);
      void Promise.resolve(rejectTripOffer(expired.id, 'Expiró tiempo de respuesta del conductor')).catch(() => undefined);
      return;
    }
    const timer = window.setTimeout(() => setOfferTimer((value) => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [incomingOffer, offerTimer, rejectTripOffer]);

  const installDriverApp = async () => {
    if (isPWAStandalone()) {
      setStandalone(true);
      setInstallHint('Ya está instalada.');
      return;
    }

    const installed = await promptPWAInstall();
    if (installed) {
      setInstallHint('Instalación aceptada.');
      return;
    }

    const ua = navigator.userAgent || '';
    const isIOS = /iPad|iPhone|iPod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    setInstallHint(
      isIOS
        ? 'iPhone: Compartir → Agregar a pantalla de inicio.'
        : 'Menú ⋮ → Instalar aplicación / Agregar a pantalla principal.',
    );
  };

  if (!driver) {
    return (
      <main className="min-h-screen bg-[#09090b] p-5 text-zinc-100">
        <section className="mx-auto mt-10 max-w-md rounded-3xl border border-amber-500/25 bg-[#0d0d0f] p-7 text-center">
          <Smartphone className="mx-auto h-10 w-10 text-amber-300" />
          <h1 className="mt-4 text-xl font-black">Cuenta sin móvil vinculado</h1>
          <p className="mt-2 text-sm leading-relaxed text-zinc-400">
            Tu acceso de conductor existe, pero el administrador todavía debe asociarlo a un conductor y móvil.
          </p>
          <button onClick={() => void signOut()} className="mt-5 rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-2.5 text-xs font-bold text-zinc-300">
            Cerrar sesión
          </button>
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
    setNavigationTarget({ address, lat, lng });
  };

  const setStatus = (status: 'available' | 'paused' | 'offline') => {
    if (!radioReady) void enableRadioAlerts();
    void Promise.resolve(toggleDriverAvailability(driver.id, status));
  };

  return (
    <main className="min-h-screen bg-[#08090c] px-2.5 py-2.5 text-zinc-100 sm:px-3">
      <div className="pointer-events-none fixed inset-x-0 top-0 h-52 bg-[radial-gradient(circle_at_50%_-20%,rgba(245,158,11,0.14),transparent_65%)]" />

      {radioBanner && (
        <div className="fixed left-1/2 top-3 z-[160] w-[min(410px,calc(100vw-1rem))] -translate-x-1/2 rounded-2xl border border-amber-400/50 bg-[#111014]/95 px-3 py-2.5 shadow-2xl shadow-black/60 backdrop-blur-xl">
          <div className="flex items-start gap-2.5">
            <Radio className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
            <div className="min-w-0">
              <p className="text-[8px] font-black uppercase tracking-[0.18em] text-amber-300">Radio Central</p>
              <p className="mt-0.5 text-xs font-bold leading-relaxed text-white">{radioBanner}</p>
            </div>
          </div>
        </div>
      )}

      <div className="relative mx-auto max-w-md space-y-2 pb-5">
        <header className="rounded-2xl border border-amber-500/25 bg-gradient-to-br from-[#17171b] to-[#0d0d10] p-3 shadow-xl shadow-black/35">
          <div className="flex items-center justify-between gap-2.5">
            <div className="flex min-w-0 items-center gap-2.5">
              <img src={centralGoLogo} alt="Central GO" className="h-10 w-10 rounded-xl border border-amber-400/70 bg-zinc-950 p-0.5" />
              <div className="min-w-0">
                <p className="truncate text-sm font-black text-white">Central <span className="text-amber-400">GO</span> Conductor</p>
                <p className="text-[8px] font-bold uppercase tracking-[0.16em] text-zinc-500">Operación en vivo</p>
              </div>
            </div>
            <button onClick={() => void signOut()} className="shrink-0 rounded-lg border border-zinc-800 bg-zinc-950 px-2.5 py-2 text-[9px] font-black text-zinc-500">
              Salir
            </button>
          </div>
          <div className="mt-2 flex items-center gap-1.5 text-[9px] font-bold">
            <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-1 ${driver.status === 'available' ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300' : 'border-zinc-700 bg-zinc-900 text-zinc-400'}`}>
              <span className="h-1.5 w-1.5 rounded-full bg-current" />
              {driver.status === 'available' ? 'DISPONIBLE' : driver.status.toUpperCase()}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full border border-blue-500/20 bg-blue-500/10 px-2 py-1 text-blue-300">
              <Wifi className="h-3 w-3" /> Sincronizado
            </span>
          </div>
        </header>

        {!standalone && (
          <section className="rounded-xl border border-amber-500/20 bg-amber-500/[0.045] px-3 py-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2">
                <Download className="h-4 w-4 shrink-0 text-amber-300" />
                <div className="min-w-0">
                  <p className="text-[10px] font-black text-zinc-200">App del conductor</p>
                  <p className="truncate text-[8px] text-zinc-600">{installHint || 'Acceso rápido desde inicio'}</p>
                </div>
              </div>
              <button
                onClick={() => void installDriverApp()}
                className="shrink-0 rounded-lg border border-amber-500/30 bg-amber-400/10 px-2.5 py-1.5 text-[9px] font-black text-amber-200"
              >
                Instalar
              </button>
            </div>
          </section>
        )}

        {!radioReady && (
          <section className="rounded-xl border border-blue-500/25 bg-blue-500/[0.05] px-3 py-2.5">
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2">
                <Radio className="h-4 w-4 shrink-0 text-blue-300" />
                <div className="min-w-0">
                  <p className="text-[10px] font-black text-white">Activar Radio Central</p>
                  <p className="truncate text-[8px] text-zinc-500">Voz alta, vibración y alertas</p>
                </div>
              </div>
              <button onClick={() => void enableRadioAlerts()} className="shrink-0 rounded-lg bg-blue-600 px-2.5 py-1.5 text-[9px] font-black text-white">
                <BellRing className="mr-1 inline h-3 w-3" />Activar
              </button>
            </div>
          </section>
        )}

        <section className="rounded-2xl border border-zinc-800 bg-[#121215] p-3">
          <div className="flex items-center gap-2">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-base font-black text-white">{driver.unitNumber}</span>
                <span className="rounded-full border border-blue-500/25 bg-blue-500/10 px-2 py-0.5 text-[9px] font-black text-blue-300">★ {driver.rating.toFixed(2)}</span>
              </div>
              <p className="truncate text-[11px] text-zinc-400">{driver.name}</p>
            </div>
          </div>
          <div className="mt-2.5 grid grid-cols-2 gap-2">
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.05] p-2.5">
              <p className="text-[8px] font-bold uppercase text-zinc-600">Ganancias hoy</p>
              <p className="mt-1 text-lg font-black text-emerald-400">${(analytics?.earnings ?? driver.todayEarnings).toLocaleString('es-CL')}</p>
            </div>
            <div className="rounded-xl border border-blue-500/20 bg-blue-500/[0.05] p-2.5">
              <p className="text-[8px] font-bold uppercase text-zinc-600">Viajes hoy</p>
              <p className="mt-1 text-lg font-black text-blue-300">{analytics?.tripsCompleted ?? 0}</p>
            </div>
          </div>
        </section>

        <section className="overflow-hidden rounded-xl border border-zinc-800 bg-gradient-to-br from-[#13151a] to-[#0e0f12]">
          <button
            type="button"
            onClick={() => setAnalyticsOpen((value) => !value)}
            aria-expanded={analyticsOpen}
            className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left"
          >
            <div className="min-w-0">
              <p className="flex items-center gap-2 text-[11px] font-black text-white"><BarChart3 className="h-4 w-4 text-violet-400" />Mi jornada</p>
              <p className="mt-0.5 truncate text-[8px] text-zinc-600">
                {analytics ? `${formatDuration(analytics.connectedSeconds)} · ${analytics.serviceKm.toFixed(1)} km · ${analytics.tripsCompleted} viajes` : 'Tiempo, kilómetros y actividad'}
              </p>
            </div>
            <span className="flex shrink-0 items-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-[8px] font-black text-zinc-400">
              {analyticsOpen ? 'Ocultar' : 'Analíticas'}
              <ChevronDown className={`h-3.5 w-3.5 transition-transform ${analyticsOpen ? 'rotate-180' : ''}`} />
            </span>
          </button>

          {analyticsOpen && (
            <div className="border-t border-zinc-800 px-3 pb-3 pt-2.5">
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-[8px] text-zinc-600">Sesiones, GPS y carreras reales</p>
                <button onClick={() => void refreshAnalytics()} className="rounded-lg border border-zinc-700 px-2 py-1 text-[8px] font-bold text-zinc-400">Actualizar</button>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                <Metric icon={<Activity className="h-3.5 w-3.5" />} label="Conectado" value={analytics ? formatDuration(analytics.connectedSeconds) : '—'} />
                <Metric icon={<Gauge className="h-3.5 w-3.5" />} label="Conduciendo" value={analytics ? formatDuration(analytics.drivingSeconds) : '—'} />
                <Metric icon={<Route className="h-3.5 w-3.5" />} label="Km servicio" value={analytics ? `${analytics.serviceKm.toFixed(1)} km` : '—'} />
                <Metric icon={<CheckCircle className="h-3.5 w-3.5" />} label="Viajes hoy" value={String(analytics?.tripsCompleted ?? 0)} />
              </div>
              <div className="mt-1.5 flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-950/70 px-2.5 py-2 text-[9px]">
                <span className="text-zinc-500">Promedio viaje</span>
                <span className="font-black text-zinc-200">{analytics?.avgTripSeconds ? formatDuration(analytics.avgTripSeconds) : '—'}</span>
              </div>
              {analyticsError && <p className="mt-1.5 text-[8px] text-amber-300">{analyticsError}</p>}
            </div>
          )}
        </section>

        {newestRadioMessage && (
          <section className="overflow-hidden rounded-xl border border-zinc-800 bg-[#121215]">
            <button
              type="button"
              onClick={() => {
                if (radioHistoryTimerRef.current !== null) window.clearTimeout(radioHistoryTimerRef.current);
                setRadioHistoryOpen((value) => !value);
              }}
              className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left"
            >
              <div className="flex min-w-0 items-center gap-2">
                <Radio className="h-4 w-4 shrink-0 text-amber-300" />
                <div className="min-w-0">
                  <p className="text-[10px] font-black text-white">Último mensaje de central</p>
                  {!radioHistoryOpen && <p className="truncate text-[8px] text-zinc-600">{new Date(newestRadioMessage.timestamp).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })} · Toca para ver</p>}
                </div>
              </div>
              <ChevronDown className={`h-4 w-4 shrink-0 text-zinc-500 transition-transform ${radioHistoryOpen ? 'rotate-180' : ''}`} />
            </button>

            {radioHistoryOpen && (
              <div className="border-t border-zinc-800 px-3 pb-3 pt-2">
                <p className="text-[8px] text-zinc-600">{new Date(newestRadioMessage.timestamp).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}</p>
                <p className="mt-1 text-[11px] font-semibold leading-relaxed text-zinc-200">{newestRadioMessage.message}</p>
              </div>
            )}
          </section>
        )}

        <section className="rounded-xl border border-zinc-800 bg-[#121215] p-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
              <Navigation className={`h-4 w-4 shrink-0 ${isGpsActive ? 'text-blue-400' : 'text-zinc-600'}`} />
              <div className="min-w-0">
                <p className="truncate text-[11px] font-bold text-zinc-200">{gpsText}</p>
                <p className="truncate text-[8px] text-zinc-600">{driver.currentLocation.address || 'Ubicación pendiente'}</p>
              </div>
            </div>
            <button onClick={() => void toggleGpsTracking()} className={`shrink-0 rounded-lg border px-2.5 py-1.5 text-[9px] font-black ${isGpsActive ? 'border-blue-500/40 bg-blue-500/15 text-blue-300' : 'border-zinc-700 bg-zinc-900 text-zinc-300'}`}>
              {isGpsActive ? 'GPS ON' : 'Activar GPS'}
            </button>
          </div>
        </section>

        <section className="grid grid-cols-3 gap-1.5 rounded-xl border border-zinc-800 bg-[#121215] p-1.5">
          <StatusButton active={driver.status === 'available'} label="Disponible" tone="emerald" onClick={() => setStatus('available')} />
          <StatusButton active={driver.status === 'paused'} label="Pausa" tone="amber" icon={<Clock className="h-3.5 w-3.5" />} onClick={() => setStatus('paused')} />
          <StatusButton active={driver.status === 'offline'} label="Fuera" tone="zinc" icon={<XCircle className="h-3.5 w-3.5" />} onClick={() => setStatus('offline')} />
        </section>

        {incomingOffer && (
          <section className="rounded-2xl border-2 border-blue-500 bg-blue-500/[0.06] p-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <span className="rounded-lg bg-blue-600 px-3 py-1 text-[9px] font-black uppercase text-white">Nueva carrera</span>
              <span className="text-lg font-black text-blue-300">{offerTimer}s</span>
            </div>
            <div className="mt-3">
              <p className="text-[8px] font-black uppercase tracking-wider text-zinc-600">Retiro</p>
              <p className="mt-1 flex items-start gap-2 text-xs font-bold text-white"><MapPin className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />{incomingOffer.origin.address}</p>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <MiniValue label="Tarifa estimada" value={`$${incomingOffer.estimatedFare.toLocaleString('es-CL')}`} accent />
              <MiniValue label="Distancia" value={`${incomingOffer.estimatedDistanceKm} km`} />
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button onClick={rejectOffer} className="rounded-xl border border-zinc-700 bg-zinc-800 py-2.5 text-[10px] font-black text-rose-300">Rechazar</button>
              <button onClick={acceptOffer} className="rounded-xl bg-emerald-400 py-2.5 text-[10px] font-black text-zinc-950">Aceptar carrera</button>
            </div>
          </section>
        )}

        {activeTrip && !incomingOffer && (
          <section className="space-y-3 rounded-2xl border border-zinc-800 bg-[#121215] p-3 shadow-xl">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-2.5">
              <div>
                <p className="text-[8px] font-black uppercase tracking-widest text-blue-400">Carrera {activeTrip.code}</p>
                <p className="mt-0.5 text-[11px] font-bold text-white">
                  {activeTrip.status === 'in_progress' ? 'Pasajero a bordo' : activeTrip.status === 'arrived' ? 'En domicilio' : 'En camino al pasajero'}
                </p>
              </div>
              <span className="rounded-full border border-blue-500/25 bg-blue-500/10 px-2 py-1 text-[8px] font-black uppercase text-blue-300">Activa</span>
            </div>

            <div className="flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-950 p-2.5">
              <div className="flex items-center gap-2.5">
                <User className="h-4 w-4 text-blue-400" />
                <div>
                  <p className="text-[11px] font-black text-white">{activeTrip.clientName}</p>
                  <p className="text-[9px] text-zinc-500">{activeTrip.clientPhone}</p>
                </div>
              </div>
              <a href={`tel:${activeTrip.clientPhone}`} className="rounded-lg bg-blue-600 p-2 text-white"><Phone className="h-4 w-4" /></a>
            </div>

            <div className="space-y-2.5">
              <RoutePoint label="Retiro" text={activeTrip.origin.address} />
              <RoutePoint label="Destino" text={activeTrip.destination.address} destination />
            </div>

            <div className="flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-950 p-2.5">
              <div><p className="text-[8px] uppercase text-zinc-600">Tarifa</p><p className="text-sm font-black text-emerald-400">${activeTrip.estimatedFare.toLocaleString('es-CL')}</p></div>
              <div className="text-right"><p className="text-[8px] uppercase text-zinc-600">Pago</p><p className="text-[9px] font-black uppercase text-zinc-300">{activeTrip.paymentMethod}</p></div>
            </div>

            <button
              onClick={() => openGpsNavigation(
                activeTrip.status === 'in_progress' ? activeTrip.destination.address : activeTrip.origin.address,
                activeTrip.status === 'in_progress' ? activeTrip.destination.lat : activeTrip.origin.lat,
                activeTrip.status === 'in_progress' ? activeTrip.destination.lng : activeTrip.origin.lng,
              )}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-blue-500/25 bg-blue-500/10 py-2.5 text-[10px] font-black text-blue-300"
            >
              <ExternalLink className="h-4 w-4" />Abrir GPS
            </button>

            <div className="space-y-1.5 border-t border-zinc-800 pt-2.5">
              <button onClick={() => void Promise.resolve(updateTripStatus(activeTrip.id, 'arrived'))} disabled={activeTrip.status === 'in_progress'} className="flex w-full items-center justify-center gap-2 rounded-xl border border-blue-500/30 bg-blue-500/10 py-2.5 text-[10px] font-black text-blue-300 disabled:opacity-30">
                <CheckCircle className="h-4 w-4" />Llegué al pasajero
              </button>
              <button onClick={() => void Promise.resolve(updateTripStatus(activeTrip.id, 'in_progress'))} className="flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 py-2.5 text-[10px] font-black text-emerald-300">
                <Play className="h-4 w-4" />Pasajero a bordo
              </button>
              <button onClick={() => setFinishModalOpen(true)} className="flex w-full items-center justify-center gap-2 rounded-xl bg-rose-600 py-3 text-[10px] font-black text-white">
                <DollarSign className="h-4 w-4" />Finalizar y cobrar
              </button>
            </div>
          </section>
        )}

        {!activeTrip && !incomingOffer && (
          <section className="rounded-xl border border-zinc-800 bg-[#121215] px-4 py-4 text-center">
            <Navigation className="mx-auto h-7 w-7 text-blue-400" />
            <h3 className="mt-2 text-[12px] font-black text-white">Esperando asignación</h3>
            <p className="mt-1 text-[10px] leading-relaxed text-zinc-500">
              {isGpsActive ? 'Ubicación sincronizada con la central.' : 'Activa GPS para aparecer en el mapa en tiempo real.'}
            </p>
          </section>
        )}

        <section className="border-t border-zinc-800 pt-2">
          {driver.sosActive ? (
            <button onClick={() => void Promise.resolve(resolveDriverSOS(driver.id))} className="flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-500/40 bg-zinc-800 py-3 text-[10px] font-black text-emerald-300">
              <ShieldAlert className="h-4 w-4" />SOS activo · cerrar emergencia
            </button>
          ) : (
            <button onClick={() => setSosConfirmOpen(true)} className="flex w-full items-center justify-center gap-2 rounded-xl bg-red-600 py-3.5 text-[11px] font-black text-white shadow-lg shadow-red-950/40">
              <ShieldAlert className="h-5 w-5" />SOS DE EMERGENCIA
            </button>
          )}
        </section>
      </div>

      {navigationTarget && (
        <NavigationChooser target={navigationTarget} onClose={() => setNavigationTarget(null)} />
      )}

      {sosConfirmOpen && (
        <ModalShell>
          <ShieldAlert className="mx-auto h-10 w-10 text-red-500" />
          <h3 className="mt-3 text-center text-base font-black text-white">¿Activar SOS?</h3>
          <p className="mt-2 text-center text-xs leading-relaxed text-zinc-400">
            La central recibirá una alerta prioritaria asociada a tu móvil y última ubicación GPS.
          </p>
          <div className="mt-5 grid grid-cols-2 gap-3">
            <button onClick={() => setSosConfirmOpen(false)} className="rounded-xl bg-zinc-800 py-3 text-xs font-bold text-zinc-300">Cancelar</button>
            <button onClick={() => { void Promise.resolve(triggerDriverSOS(driver.id)); setSosConfirmOpen(false); }} className="rounded-xl bg-red-600 py-3 text-xs font-black text-white">Activar SOS</button>
          </div>
        </ModalShell>
      )}

      {finishModalOpen && activeTrip && (
        <ModalShell>
          <h3 className="text-center text-base font-black text-white">Finalizar {activeTrip.code}</h3>
          <p className="mt-1 text-center text-xs text-zinc-500">Confirma el medio de pago recibido.</p>
          <div className="mt-4 rounded-xl border border-zinc-800 bg-zinc-950 p-4 text-center">
            <p className="text-[9px] uppercase text-zinc-600">Monto</p>
            <p className="mt-1 text-3xl font-black text-emerald-400">${activeTrip.estimatedFare.toLocaleString('es-CL')}</p>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2">
            {[['efectivo', 'Efectivo'], ['transferencia', 'Transferencia'], ['posnet_tarjeta', 'Tarjeta'], ['cuenta_corriente', 'Cta. corriente']].map(([id, label]) => (
              <button key={id} onClick={() => setSelectedPayment(id)} className={`rounded-xl border px-3 py-3 text-xs font-bold ${selectedPayment === id ? 'border-blue-500 bg-blue-600 text-white' : 'border-zinc-800 bg-zinc-900 text-zinc-300'}`}>{label}</button>
            ))}
          </div>
          <div className="mt-5 grid grid-cols-2 gap-3">
            <button onClick={() => setFinishModalOpen(false)} className="rounded-xl bg-zinc-800 py-3 text-xs font-bold text-zinc-300">Volver</button>
            <button
              onClick={() => {
                void Promise.resolve(updateTripStatus(activeTrip.id, 'completed', `Pago: ${selectedPayment}`)).then(() => void refreshAnalytics());
                setFinishModalOpen(false);
              }}
              className="rounded-xl bg-emerald-400 py-3 text-xs font-black text-zinc-950"
            >
              Cobrado y completado
            </button>
          </div>
        </ModalShell>
      )}
    </main>
  );
};

const NavigationChooser: React.FC<{ target: NavigationTarget; onClose: () => void }> = ({ target, onClose }) => {
  const encodedDestination = encodeURIComponent(`${target.lat},${target.lng}`);
  const encodedLabel = encodeURIComponent(target.address);
  const isAndroid = /Android/i.test(navigator.userAgent || '');

  const open = (url: string) => {
    onClose();
    window.location.href = url;
  };

  return (
    <div className="fixed inset-0 z-[190] flex items-end bg-black/85 p-3 backdrop-blur-md sm:items-center sm:justify-center">
      <section className="w-full max-w-sm rounded-3xl border border-zinc-700 bg-[#0d0d0f] p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[9px] font-black uppercase tracking-[0.18em] text-blue-300">Navegación</p>
            <h3 className="mt-1 text-base font-black text-white">¿Qué GPS quieres usar?</h3>
            <p className="mt-1 text-[10px] leading-relaxed text-zinc-500">{target.address}</p>
          </div>
          <button onClick={onClose} className="rounded-xl border border-zinc-800 bg-zinc-950 p-2 text-zinc-500" aria-label="Cerrar">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4 space-y-2">
          {isAndroid && (
            <button
              onClick={() => open(`geo:${target.lat},${target.lng}?q=${encodeURIComponent(`${target.lat},${target.lng}(${target.address})`)}`)}
              className="flex w-full items-center justify-between rounded-xl border border-blue-500/30 bg-blue-500/10 px-4 py-3 text-left"
            >
              <span><strong className="block text-xs text-white">Elegir app del teléfono</strong><span className="text-[9px] text-zinc-500">Android mostrará las apps de mapas compatibles</span></span>
              <Navigation className="h-5 w-5 text-blue-300" />
            </button>
          )}

          <button
            onClick={() => open(`https://www.google.com/maps/dir/?api=1&destination=${encodedDestination}&travelmode=driving&dir_action=navigate`)}
            className="flex w-full items-center justify-between rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-left"
          >
            <span><strong className="block text-xs text-white">Google Maps</strong><span className="text-[9px] text-zinc-500">Navegación giro a giro</span></span>
            <ExternalLink className="h-4 w-4 text-zinc-500" />
          </button>

          <button
            onClick={() => open(`https://waze.com/ul?ll=${target.lat}%2C${target.lng}&navigate=yes&utm_source=centralgo`)}
            className="flex w-full items-center justify-between rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-left"
          >
            <span><strong className="block text-xs text-white">Waze</strong><span className="text-[9px] text-zinc-500">Tráfico y navegación</span></span>
            <ExternalLink className="h-4 w-4 text-zinc-500" />
          </button>

          <button
            onClick={() => open(`https://maps.apple.com/?daddr=${encodedDestination}&q=${encodedLabel}&dirflg=d`)}
            className="flex w-full items-center justify-between rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-left"
          >
            <span><strong className="block text-xs text-white">Apple Maps</strong><span className="text-[9px] text-zinc-500">Disponible en iPhone/iPad</span></span>
            <ExternalLink className="h-4 w-4 text-zinc-500" />
          </button>
        </div>
      </section>
    </div>
  );
};

const Metric: React.FC<{ icon: React.ReactNode; label: string; value: string }> = ({ icon, label, value }) => (
  <div className="rounded-lg border border-zinc-800 bg-zinc-950/70 p-2.5">
    <div className="flex items-center gap-1.5 text-violet-300">
      {icon}
      <span className="text-[8px] font-bold uppercase tracking-wider text-zinc-600">{label}</span>
    </div>
    <p className="mt-1.5 text-sm font-black text-white">{value}</p>
  </div>
);

const MiniValue: React.FC<{ label: string; value: string; accent?: boolean }> = ({ label, value, accent }) => (
  <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-2.5">
    <p className="text-[8px] text-zinc-600">{label}</p>
    <p className={`mt-1 text-sm font-black ${accent ? 'text-emerald-400' : 'text-white'}`}>{value}</p>
  </div>
);

const StatusButton: React.FC<{
  active: boolean;
  label: string;
  tone: 'emerald' | 'amber' | 'zinc';
  icon?: React.ReactNode;
  onClick: () => void;
}> = ({ active, label, tone, icon, onClick }) => {
  const activeClass = tone === 'emerald'
    ? 'bg-emerald-400 text-zinc-950 border-emerald-300'
    : tone === 'amber'
      ? 'bg-amber-400 text-zinc-950 border-amber-300'
      : 'bg-zinc-700 text-white border-zinc-600';

  return (
    <button onClick={onClick} className={`flex min-h-12 flex-col items-center justify-center gap-1 rounded-lg border px-2 text-[9px] font-black uppercase ${active ? activeClass : 'border-zinc-800 bg-zinc-950 text-zinc-500'}`}>
      {icon ?? <span className={`h-2 w-2 rounded-full ${active ? 'bg-current' : 'bg-zinc-700'}`} />}
      {label}
    </button>
  );
};

const RoutePoint: React.FC<{ label: string; text: string; destination?: boolean }> = ({ label, text, destination }) => (
  <div className="flex items-start gap-2.5">
    <span className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${destination ? 'bg-rose-500' : 'bg-emerald-500'}`} />
    <div>
      <p className="text-[8px] font-black uppercase tracking-wider text-zinc-600">{label}</p>
      <p className="mt-0.5 text-[11px] font-semibold text-zinc-200">{text}</p>
    </div>
  </div>
);

const ModalShell: React.FC<React.PropsWithChildren> = ({ children }) => (
  <div className="fixed inset-0 z-[180] flex items-center justify-center bg-black/85 p-4 backdrop-blur-md">
    <section className="w-full max-w-sm rounded-3xl border border-zinc-700 bg-[#0d0d0f] p-6 shadow-2xl">{children}</section>
  </div>
);

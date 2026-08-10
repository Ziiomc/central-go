import React, { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle,
  Clock,
  DollarSign,
  Download,
  ExternalLink,
  MapPin,
  Navigation,
  Phone,
  Play,
  ShieldAlert,
  Smartphone,
  User,
  XCircle,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import type { Trip } from '../../types';
import { soundManager } from '../../lib/audio';
import { isPWAStandalone, promptPWAInstall } from '../../lib/pwa';
import centralGoLogo from '../../assets/images/central-go-logo.svg';

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
    currentUser,
  } = useApp();
  const { signOut } = useAuth();

  const driver = drivers.find((item) => item.userId === currentUser.id);
  const [isGpsActive, setIsGpsActive] = useState(false);
  const [gpsText, setGpsText] = useState('GPS detenido');
  const [installHint, setInstallHint] = useState('');
  const [standalone, setStandalone] = useState(() => isPWAStandalone());
  const gpsWatchId = useRef<number | null>(null);
  const lastGpsSent = useRef<{ at: number; lat: number; lng: number } | null>(null);
  const [incomingOffer, setIncomingOffer] = useState<Trip | null>(null);
  const [offerTimer, setOfferTimer] = useState(15);
  const [sosConfirmOpen, setSosConfirmOpen] = useState(false);
  const [finishModalOpen, setFinishModalOpen] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState('efectivo');

  const activeTrip = trips.find((trip) => trip.driverId === driver?.id && ['assigned', 'en_route', 'arrived', 'in_progress'].includes(trip.status));

  const stopGpsTracking = () => {
    if (gpsWatchId.current !== null && navigator.geolocation) navigator.geolocation.clearWatch(gpsWatchId.current);
    gpsWatchId.current = null;
    setIsGpsActive(false);
    setGpsText('GPS detenido');
  };

  const toggleGpsTracking = () => {
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
        const { latitude, longitude, accuracy } = position.coords;
        const now = Date.now();
        const last = lastGpsSent.current;
        const metersApprox = last
          ? Math.hypot((latitude - last.lat) * 111320, (longitude - last.lng) * 111320 * Math.cos(latitude * Math.PI / 180))
          : Infinity;
        const shouldSend = !last || now - last.at >= 8000 || metersApprox >= 15;
        setGpsText(`GPS EN VIVO · precisión ±${Math.round(accuracy)} m`);
        if (shouldSend) {
          lastGpsSent.current = { at: now, lat: latitude, lng: longitude };
          void Promise.resolve(updateDriverLocation(driver.id, latitude, longitude, `GPS ${latitude.toFixed(5)}, ${longitude.toFixed(5)}`))
            .catch(() => setGpsText('Error sincronizando GPS con la central'));
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
    const installed = () => setStandalone(true);
    const installable = () => setInstallHint('Lista para instalar en este dispositivo.');
    window.addEventListener('appinstalled', installed);
    window.addEventListener('pwa-installable', installable);
    return () => {
      window.removeEventListener('appinstalled', installed);
      window.removeEventListener('pwa-installable', installable);
      if (gpsWatchId.current !== null && navigator.geolocation) navigator.geolocation.clearWatch(gpsWatchId.current);
    };
  }, []);

  useEffect(() => {
    if (activeTrip?.status === 'assigned' && incomingOffer?.id !== activeTrip.id) {
      setIncomingOffer(activeTrip);
      setOfferTimer(15);
      soundManager.playDispatchChime();
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
    const installed = await promptPWAInstall();
    if (installed) {
      setStandalone(true);
      setInstallHint('Central GO Conductor quedó instalado.');
      return;
    }
    setInstallHint('Si no aparece la instalación automática, abre el menú del navegador y elige “Instalar aplicación” o “Agregar a pantalla principal”.');
  };

  if (!driver) {
    return (
      <main className="min-h-screen bg-[#09090b] p-5 text-zinc-100">
        <section className="mx-auto mt-10 max-w-md rounded-3xl border border-amber-500/25 bg-[#0d0d0f] p-7 text-center">
          <Smartphone className="mx-auto h-10 w-10 text-amber-300" />
          <h1 className="mt-4 text-xl font-black">Cuenta sin móvil vinculado</h1>
          <p className="mt-2 text-sm leading-relaxed text-zinc-400">Tu acceso de conductor existe, pero el administrador de la central todavía debe asociar esta cuenta a un conductor y a un número de móvil.</p>
          <button onClick={() => void signOut()} className="mt-5 rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-2.5 text-xs font-bold text-zinc-300">Cerrar sesión</button>
        </section>
      </main>
    );
  }

  const acceptOffer = () => {
    if (!incomingOffer) return;
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
    const url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&destination_place_id=${encodeURIComponent(address)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <main className="min-h-screen bg-[#09090b] px-3 py-3 text-zinc-100 sm:px-4">
      <div className="mx-auto max-w-md space-y-3 pb-5">
        <header className="rounded-2xl border border-amber-500/25 bg-[#111216] p-3.5 shadow-xl">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <img src={centralGoLogo} alt="Central GO" className="h-10 w-10 rounded-xl border border-amber-400/70 bg-zinc-950 p-0.5" />
              <div><p className="text-sm font-black text-white">Central <span className="text-amber-400">GO</span> Conductor</p><p className="text-[9px] font-bold uppercase tracking-widest text-zinc-500">GPS · Carreras · SOS</p></div>
            </div>
            <button onClick={() => void signOut()} className="rounded-lg border border-zinc-800 bg-zinc-950 px-2.5 py-2 text-[9px] font-black text-zinc-500">Salir</button>
          </div>
        </header>

        {!standalone && (
          <section className="rounded-2xl border border-amber-500/30 bg-amber-500/[0.07] p-4">
            <div className="flex items-start gap-3"><div className="rounded-xl bg-amber-400 p-2 text-zinc-950"><Download className="h-5 w-5" /></div><div className="min-w-0 flex-1"><h2 className="text-sm font-black text-white">Instala la app del conductor</h2><p className="mt-1 text-[10px] leading-relaxed text-zinc-400">Quedará como una aplicación independiente en tu pantalla de inicio y abrirá directamente este panel.</p></div></div>
            <button onClick={() => void installDriverApp()} className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-amber-400 px-4 py-3 text-xs font-black text-zinc-950"><Smartphone className="h-4 w-4" />Instalar Central GO Conductor</button>
            {installHint && <p className="mt-2 text-[10px] leading-relaxed text-amber-200/80">{installHint}</p>}
          </section>
        )}

        <section className="rounded-2xl border border-zinc-800 bg-[#121215] p-4">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0"><div className="flex items-center gap-2"><span className="text-lg font-black text-white">{driver.unitNumber}</span><span className="rounded-full border border-blue-500/25 bg-blue-500/10 px-2 py-0.5 text-[9px] font-black text-blue-300">★ {driver.rating.toFixed(2)}</span></div><p className="truncate text-xs text-zinc-400">{driver.name}</p></div>
            <div className="text-right"><p className="text-[9px] font-bold uppercase text-zinc-600">Recaudado hoy</p><p className="text-sm font-black text-emerald-400">${driver.todayEarnings.toLocaleString('es-CL')}</p></div>
          </div>
        </section>

        <section className="rounded-2xl border border-zinc-800 bg-[#121215] p-3.5">
          <div className="flex items-center justify-between gap-3"><div className="flex min-w-0 items-center gap-2.5"><Navigation className={`h-4 w-4 shrink-0 ${isGpsActive ? 'text-blue-400' : 'text-zinc-600'}`} /><div className="min-w-0"><p className="truncate text-xs font-bold text-zinc-200">{gpsText}</p><p className="truncate text-[9px] text-zinc-600">{driver.currentLocation.address || 'Ubicación pendiente'}</p></div></div><button onClick={toggleGpsTracking} className={`shrink-0 rounded-xl border px-3 py-2 text-[10px] font-black ${isGpsActive ? 'border-blue-500/40 bg-blue-500/15 text-blue-300' : 'border-zinc-700 bg-zinc-900 text-zinc-300'}`}>{isGpsActive ? 'GPS ON' : 'Activar GPS'}</button></div>
        </section>

        <section className="grid grid-cols-3 gap-2 rounded-2xl border border-zinc-800 bg-[#121215] p-2">
          <StatusButton active={driver.status === 'available'} label="Disponible" tone="emerald" onClick={() => void Promise.resolve(toggleDriverAvailability(driver.id, 'available'))} />
          <StatusButton active={driver.status === 'paused'} label="Pausa" tone="amber" icon={<Clock className="h-3.5 w-3.5" />} onClick={() => void Promise.resolve(toggleDriverAvailability(driver.id, 'paused'))} />
          <StatusButton active={driver.status === 'offline'} label="Fuera" tone="zinc" icon={<XCircle className="h-3.5 w-3.5" />} onClick={() => void Promise.resolve(toggleDriverAvailability(driver.id, 'offline'))} />
        </section>

        {incomingOffer && (
          <section className="rounded-2xl border-2 border-blue-500 bg-blue-500/[0.06] p-5 shadow-2xl">
            <div className="flex items-center justify-between"><span className="rounded-lg bg-blue-600 px-3 py-1 text-[10px] font-black uppercase text-white">Nueva carrera</span><span className="text-lg font-black text-blue-300">{offerTimer}s</span></div>
            <div className="mt-4"><p className="text-[9px] font-black uppercase tracking-wider text-zinc-600">Retiro</p><p className="mt-1 flex items-start gap-2 text-sm font-bold text-white"><MapPin className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />{incomingOffer.origin.address}</p></div>
            <div className="mt-3 grid grid-cols-2 gap-2"><div className="rounded-xl border border-zinc-800 bg-zinc-950 p-3"><p className="text-[9px] text-zinc-600">Tarifa estimada</p><p className="mt-1 text-sm font-black text-emerald-400">${incomingOffer.estimatedFare.toLocaleString('es-CL')}</p></div><div className="rounded-xl border border-zinc-800 bg-zinc-950 p-3"><p className="text-[9px] text-zinc-600">Distancia</p><p className="mt-1 text-sm font-black text-white">{incomingOffer.estimatedDistanceKm} km</p></div></div>
            <div className="mt-4 grid grid-cols-2 gap-3"><button onClick={rejectOffer} className="rounded-xl border border-zinc-700 bg-zinc-800 py-3 text-xs font-black text-rose-300">Rechazar</button><button onClick={acceptOffer} className="rounded-xl bg-emerald-400 py-3 text-xs font-black text-zinc-950">Aceptar carrera</button></div>
          </section>
        )}

        {activeTrip && !incomingOffer && (
          <section className="space-y-4 rounded-2xl border border-zinc-800 bg-[#121215] p-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3"><div><p className="text-[9px] font-black uppercase tracking-widest text-blue-400">Carrera {activeTrip.code}</p><p className="mt-1 text-xs font-bold text-white">{activeTrip.status === 'in_progress' ? 'Pasajero a bordo' : activeTrip.status === 'arrived' ? 'En domicilio' : 'En camino al pasajero'}</p></div><span className="rounded-full border border-blue-500/25 bg-blue-500/10 px-2.5 py-1 text-[9px] font-black uppercase text-blue-300">Activa</span></div>
            <div className="flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-950 p-3"><div className="flex items-center gap-2.5"><User className="h-4 w-4 text-blue-400" /><div><p className="text-xs font-black text-white">{activeTrip.clientName}</p><p className="text-[10px] text-zinc-500">{activeTrip.clientPhone}</p></div></div><a href={`tel:${activeTrip.clientPhone}`} className="rounded-lg bg-blue-600 p-2.5 text-white"><Phone className="h-4 w-4" /></a></div>
            <div className="space-y-3"><RoutePoint label="Retiro" text={activeTrip.origin.address} /><RoutePoint label="Destino" text={activeTrip.destination.address} destination /></div>
            <div className="flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-950 p-3"><div><p className="text-[9px] uppercase text-zinc-600">Tarifa</p><p className="text-base font-black text-emerald-400">${activeTrip.estimatedFare.toLocaleString('es-CL')}</p></div><div className="text-right"><p className="text-[9px] uppercase text-zinc-600">Pago</p><p className="text-[10px] font-black uppercase text-zinc-300">{activeTrip.paymentMethod}</p></div></div>
            <button onClick={() => openGpsNavigation(activeTrip.status === 'in_progress' ? activeTrip.destination.address : activeTrip.origin.address, activeTrip.status === 'in_progress' ? activeTrip.destination.lat : activeTrip.origin.lat, activeTrip.status === 'in_progress' ? activeTrip.destination.lng : activeTrip.origin.lng)} className="flex w-full items-center justify-center gap-2 rounded-xl border border-blue-500/25 bg-blue-500/10 py-3 text-xs font-black text-blue-300"><ExternalLink className="h-4 w-4" />Abrir navegación</button>
            <div className="space-y-2 border-t border-zinc-800 pt-3">
              <button onClick={() => void Promise.resolve(updateTripStatus(activeTrip.id, 'arrived'))} disabled={activeTrip.status === 'in_progress'} className="flex w-full items-center justify-center gap-2 rounded-xl border border-blue-500/30 bg-blue-500/10 py-3 text-xs font-black text-blue-300 disabled:opacity-30"><CheckCircle className="h-4 w-4" />Llegué al pasajero</button>
              <button onClick={() => void Promise.resolve(updateTripStatus(activeTrip.id, 'in_progress'))} className="flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 py-3 text-xs font-black text-emerald-300"><Play className="h-4 w-4" />Pasajero a bordo · iniciar viaje</button>
              <button onClick={() => setFinishModalOpen(true)} className="flex w-full items-center justify-center gap-2 rounded-xl bg-rose-600 py-3.5 text-xs font-black text-white"><DollarSign className="h-4 w-4" />Finalizar y cobrar</button>
            </div>
          </section>
        )}

        {!activeTrip && !incomingOffer && (
          <section className="rounded-2xl border border-zinc-800 bg-[#121215] p-6 text-center"><Navigation className="mx-auto h-8 w-8 text-blue-400" /><h3 className="mt-3 text-sm font-black text-white">Esperando asignación</h3><p className="mt-1 text-xs leading-relaxed text-zinc-500">{isGpsActive ? 'Tu ubicación está sincronizándose con la central.' : 'Activa el GPS para que la operadora pueda ubicarte en tiempo real.'}</p></section>
        )}

        <section className="border-t border-zinc-800 pt-3">
          {driver.sosActive ? <button onClick={() => void Promise.resolve(resolveDriverSOS(driver.id))} className="flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-500/40 bg-zinc-800 py-3.5 text-xs font-black text-emerald-300"><ShieldAlert className="h-4 w-4" />SOS activo · cerrar emergencia</button> : <button onClick={() => setSosConfirmOpen(true)} className="flex w-full items-center justify-center gap-2 rounded-xl bg-red-600 py-4 text-xs font-black text-white shadow-lg shadow-red-950/40"><ShieldAlert className="h-5 w-5" />SOS DE EMERGENCIA</button>}
        </section>
      </div>

      {sosConfirmOpen && <ModalShell><ShieldAlert className="mx-auto h-10 w-10 text-red-500" /><h3 className="mt-3 text-center text-base font-black text-white">¿Activar SOS?</h3><p className="mt-2 text-center text-xs leading-relaxed text-zinc-400">La central recibirá una alerta prioritaria asociada a tu móvil y a la última ubicación GPS disponible.</p><div className="mt-5 grid grid-cols-2 gap-3"><button onClick={() => setSosConfirmOpen(false)} className="rounded-xl bg-zinc-800 py-3 text-xs font-bold text-zinc-300">Cancelar</button><button onClick={() => { void Promise.resolve(triggerDriverSOS(driver.id)); setSosConfirmOpen(false); }} className="rounded-xl bg-red-600 py-3 text-xs font-black text-white">Activar SOS</button></div></ModalShell>}

      {finishModalOpen && activeTrip && <ModalShell><h3 className="text-center text-base font-black text-white">Finalizar {activeTrip.code}</h3><p className="mt-1 text-center text-xs text-zinc-500">Confirma el medio de pago recibido.</p><div className="mt-4 rounded-xl border border-zinc-800 bg-zinc-950 p-4 text-center"><p className="text-[9px] uppercase text-zinc-600">Monto</p><p className="mt-1 text-3xl font-black text-emerald-400">${activeTrip.estimatedFare.toLocaleString('es-CL')}</p></div><div className="mt-4 grid grid-cols-2 gap-2">{[['efectivo','Efectivo'],['transferencia','Transferencia'],['posnet_tarjeta','Tarjeta'],['cuenta_corriente','Cta. corriente']].map(([id,label]) => <button key={id} onClick={() => setSelectedPayment(id)} className={`rounded-xl border px-3 py-3 text-xs font-bold ${selectedPayment===id?'border-blue-500 bg-blue-600 text-white':'border-zinc-800 bg-zinc-900 text-zinc-300'}`}>{label}</button>)}</div><div className="mt-5 grid grid-cols-2 gap-3"><button onClick={() => setFinishModalOpen(false)} className="rounded-xl bg-zinc-800 py-3 text-xs font-bold text-zinc-300">Volver</button><button onClick={() => { void Promise.resolve(updateTripStatus(activeTrip.id, 'completed', `Pago: ${selectedPayment}`)); setFinishModalOpen(false); }} className="rounded-xl bg-emerald-400 py-3 text-xs font-black text-zinc-950">Cobrado y completado</button></div></ModalShell>}
    </main>
  );
};

const StatusButton: React.FC<{ active: boolean; label: string; tone: 'emerald' | 'amber' | 'zinc'; icon?: React.ReactNode; onClick: () => void }> = ({ active, label, tone, icon, onClick }) => {
  const activeClass = tone === 'emerald' ? 'bg-emerald-400 text-zinc-950 border-emerald-300' : tone === 'amber' ? 'bg-amber-400 text-zinc-950 border-amber-300' : 'bg-zinc-700 text-white border-zinc-600';
  return <button onClick={onClick} className={`flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl border px-2 text-[10px] font-black uppercase ${active ? activeClass : 'border-zinc-800 bg-zinc-950 text-zinc-500'}`}>{icon ?? <span className={`h-2.5 w-2.5 rounded-full ${active ? 'bg-current' : 'bg-zinc-700'}`} />}{label}</button>;
};

const RoutePoint: React.FC<{ label: string; text: string; destination?: boolean }> = ({ label, text, destination }) => <div className="flex items-start gap-2.5"><span className={`mt-1 h-3 w-3 shrink-0 rounded-full ${destination ? 'bg-rose-500' : 'bg-emerald-500'}`} /><div><p className="text-[9px] font-black uppercase tracking-wider text-zinc-600">{label}</p><p className="mt-0.5 text-xs font-semibold text-zinc-200">{text}</p></div></div>;

const ModalShell: React.FC<React.PropsWithChildren> = ({ children }) => <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 p-4 backdrop-blur-md"><section className="w-full max-w-sm rounded-3xl border border-zinc-700 bg-[#0d0d0f] p-6 shadow-2xl">{children}</section></div>;

import React, { useEffect, useMemo, useState } from 'react';
import { useApp } from '../../context/AppContext';
import {
  CheckCircle2,
  Clock3,
  ExternalLink,
  MapPin,
  Navigation,
  Phone,
  Radio,
  ShieldAlert,
  Signal,
  Siren,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { startSOSAlarm, stopSOSAlarm } from '../../lib/audioService';

const formatElapsed = (seconds: number) => {
  const safe = Math.max(0, seconds);
  const minutes = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

export const SOSAlertModal: React.FC = () => {
  const {
    activeSOSDriver,
    drivers,
    currentCompany,
    soundMuted,
    resolveDriverSOS,
    setActiveModule,
  } = useApp();
  const activeDriver = activeSOSDriver ?? drivers.find((driver) => driver.sosActive) ?? null;
  const [acknowledged, setAcknowledged] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [now, setNow] = useState(Date.now());

  const startedAt = useMemo(() => {
    const source = activeDriver?.sosTimestamp ?? activeDriver?.currentLocation.lastUpdated;
    const value = source ? new Date(source).getTime() : Date.now();
    return Number.isFinite(value) ? value : Date.now();
  }, [activeDriver?.id, activeDriver?.sosTimestamp, activeDriver?.currentLocation.lastUpdated]);
  const elapsed = Math.max(0, Math.floor((now - startedAt) / 1000));

  useEffect(() => {
    setAcknowledged(false);
    setMinimized(false);
    setResolving(false);
  }, [activeDriver?.id]);

  useEffect(() => {
    if (!activeDriver) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [activeDriver?.id]);

  useEffect(() => {
    if (!activeDriver || acknowledged || soundMuted) {
      stopSOSAlarm();
      return;
    }
    startSOSAlarm();
    return () => stopSOSAlarm();
  }, [activeDriver?.id, acknowledged, soundMuted]);

  if (!activeDriver) return null;

  const lat = Number(activeDriver.currentLocation.lat || 0);
  const lng = Number(activeDriver.currentLocation.lng || 0);
  const hasGps = Boolean(lat && lng);
  const gpsAgeSeconds = Math.max(0, Math.round((Date.now() - new Date(activeDriver.currentLocation.lastUpdated).getTime()) / 1000));
  const gpsFresh = gpsAgeSeconds <= 90;
  const mapsUrl = hasGps ? `https://www.google.com/maps/search/?api=1&query=${lat},${lng}` : '#';

  const acknowledge = () => {
    setAcknowledged(true);
    stopSOSAlarm();
  };

  const openLiveMap = () => {
    acknowledge();
    setActiveModule('live_map');
    setMinimized(true);
  };

  const resolve = async () => {
    setResolving(true);
    try {
      await Promise.resolve(resolveDriverSOS(activeDriver.id));
      stopSOSAlarm();
      setMinimized(false);
      setAcknowledged(false);
    } finally {
      setResolving(false);
    }
  };

  if (minimized) {
    return (
      <div className="fixed left-1/2 top-2 z-[150] w-[min(760px,calc(100vw-1rem))] -translate-x-1/2 rounded-2xl border border-red-500/50 bg-[#11090b]/95 px-3 py-2.5 shadow-2xl shadow-red-950/50 backdrop-blur-xl">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-red-600 text-white"><Siren className="h-5 w-5" /></span>
            <div><p className="text-[9px] font-black uppercase tracking-[0.18em] text-red-300">SOS activo · incidente atendido</p><p className="text-xs font-black text-white">{activeDriver.unitNumber} · {activeDriver.name} · {formatElapsed(elapsed)}</p></div>
          </div>
          <button onClick={() => setMinimized(false)} className="rounded-xl bg-red-600 px-3 py-2 text-[10px] font-black text-white">Abrir incidente</button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[140] flex items-center justify-center overflow-y-auto bg-black/88 p-3 backdrop-blur-xl">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(220,38,38,0.26),transparent_48%)]" />
      <section className="relative my-4 w-full max-w-3xl overflow-hidden rounded-[28px] border border-red-500/45 bg-[#0a0a0d] shadow-[0_28px_90px_rgba(0,0,0,0.75),0_0_45px_rgba(220,38,38,0.18)]">
        <header className="border-b border-red-500/25 bg-gradient-to-r from-red-600/22 via-red-950/10 to-transparent p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <div className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-red-400/40 bg-red-600 text-white shadow-lg shadow-red-950/40">
                <ShieldAlert className="h-7 w-7" />
                <span className="absolute -right-1 -top-1 h-3.5 w-3.5 animate-ping rounded-full bg-red-400" />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full border border-red-400/40 bg-red-500/15 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.18em] text-red-200">Incidente crítico</span>
                  <span className="rounded-full border border-zinc-700 bg-zinc-950 px-2.5 py-1 text-[9px] font-black uppercase tracking-wider text-zinc-400">Prioridad máxima</span>
                </div>
                <h2 className="mt-2 text-2xl font-black tracking-tight text-white sm:text-3xl">SOS · {activeDriver.unitNumber}</h2>
                <p className="mt-1 text-xs text-zinc-400">Botón de pánico activado por {activeDriver.name}</p>
              </div>
            </div>
            <div className="rounded-2xl border border-red-500/30 bg-black/35 px-4 py-3 text-right">
              <p className="flex items-center justify-end gap-1.5 text-[9px] font-black uppercase tracking-[0.18em] text-red-300"><Clock3 className="h-3.5 w-3.5" />Tiempo de incidente</p>
              <p className="mt-1 font-mono text-3xl font-black tabular-nums text-white">{formatElapsed(elapsed)}</p>
            </div>
          </div>
        </header>

        <div className="grid gap-4 p-4 sm:p-6 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-4">
            <section className="rounded-2xl border border-zinc-800 bg-[#111114] p-4">
              <div className="flex items-center gap-3.5">
                {activeDriver.photoUrl ? (
                  <img src={activeDriver.photoUrl} alt={activeDriver.name} className="h-16 w-16 rounded-2xl border border-red-500/40 object-cover" />
                ) : (
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-red-500/35 bg-red-500/10 text-red-300"><ShieldAlert className="h-7 w-7" /></div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-[9px] font-black uppercase tracking-widest text-zinc-600">Conductor</p>
                  <p className="truncate text-lg font-black text-white">{activeDriver.name}</p>
                  <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-zinc-400">
                    <span className="font-bold text-amber-300">{activeDriver.unitNumber}</span>
                    <span>{activeDriver.phone || 'Sin teléfono registrado'}</span>
                    <span className="flex items-center gap-1"><Radio className="h-3 w-3" />{currentCompany.vhfFrequency || 'Radio digital'}</span>
                  </div>
                </div>
              </div>
            </section>

            <section className="rounded-2xl border border-zinc-800 bg-[#111114] p-4">
              <div className="flex items-center justify-between gap-3">
                <div><p className="text-[9px] font-black uppercase tracking-widest text-zinc-600">Ubicación transmitida</p><p className="mt-1 text-sm font-black text-white">{activeDriver.currentLocation.address || 'Dirección no disponible'}</p></div>
                <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[9px] font-black ${gpsFresh ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-300' : 'border-amber-500/25 bg-amber-500/10 text-amber-300'}`}><Signal className="h-3 w-3" />{gpsFresh ? 'GPS reciente' : 'Revisar señal'}</span>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                <Metric label="Latitud" value={hasGps ? lat.toFixed(5) : '—'} />
                <Metric label="Longitud" value={hasGps ? lng.toFixed(5) : '—'} />
                <Metric label="Velocidad" value={`${Math.round(activeDriver.currentLocation.speed || 0)} km/h`} />
                <Metric label="Última señal" value={gpsAgeSeconds < 60 ? `${gpsAgeSeconds}s` : `${Math.round(gpsAgeSeconds / 60)} min`} />
              </div>
            </section>

            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
              <a href={`tel:${activeDriver.phone}`} className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-amber-400 px-3 text-[10px] font-black uppercase text-zinc-950"><Phone className="h-4 w-4" />Llamar conductor</a>
              <button onClick={openLiveMap} className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-blue-600 px-3 text-[10px] font-black uppercase text-white"><Navigation className="h-4 w-4" />Mapa en vivo</button>
              <a href={mapsUrl} target="_blank" rel="noreferrer" aria-disabled={!hasGps} className={`flex min-h-12 items-center justify-center gap-2 rounded-xl border px-3 text-[10px] font-black uppercase ${hasGps ? 'border-zinc-700 bg-zinc-900 text-white' : 'pointer-events-none border-zinc-800 bg-zinc-950 text-zinc-700'}`}><ExternalLink className="h-4 w-4" />Abrir GPS</a>
            </div>
          </div>

          <div className="space-y-4">
            <section className="rounded-2xl border border-red-500/25 bg-red-500/[0.045] p-4">
              <p className="text-[9px] font-black uppercase tracking-[0.18em] text-red-300">Protocolo sugerido</p>
              <div className="mt-3 space-y-3">
                <Protocol number="1" title="Confirmar contacto" detail="Llama al conductor y determina si puede responder." />
                <Protocol number="2" title="Validar ubicación" detail="Revisa GPS, dirección, velocidad y última señal recibida." />
                <Protocol number="3" title="Escalar si corresponde" detail="Aplica el protocolo de seguridad definido por la empresa." />
              </div>
            </section>

            <button onClick={acknowledge} disabled={acknowledged} className={`flex w-full items-center justify-center gap-2 rounded-xl border py-3.5 text-xs font-black ${acknowledged ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300' : 'border-amber-500/35 bg-amber-500/10 text-amber-300'}`}>
              {acknowledged ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
              {acknowledged ? 'Alarma silenciada · incidente en atención' : 'Tomar control y silenciar alarma'}
            </button>

            <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-3 text-[10px] leading-relaxed text-zinc-500">
              <div className="flex gap-2"><MapPin className="mt-0.5 h-4 w-4 shrink-0 text-red-400" /><span>Silenciar la alarma <strong className="text-zinc-300">no cierra el SOS</strong>. La emergencia seguirá activa hasta que la central la marque como resuelta.</span></div>
            </div>

            <button disabled={resolving} onClick={() => void resolve()} className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 py-3.5 text-xs font-black text-zinc-950 disabled:opacity-50">
              <CheckCircle2 className="h-4 w-4" />{resolving ? 'Cerrando incidente…' : 'Marcar emergencia como resuelta'}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};

const Metric: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-2.5">
    <p className="text-[8px] font-black uppercase tracking-wider text-zinc-600">{label}</p>
    <p className="mt-1 truncate font-mono text-[10px] font-bold text-zinc-300">{value}</p>
  </div>
);

const Protocol: React.FC<{ number: string; title: string; detail: string }> = ({ number, title, detail }) => (
  <div className="flex gap-2.5">
    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border border-red-500/30 bg-red-500/10 text-[9px] font-black text-red-300">{number}</span>
    <div><p className="text-[10px] font-black text-white">{title}</p><p className="mt-0.5 text-[9px] leading-relaxed text-zinc-500">{detail}</p></div>
  </div>
);

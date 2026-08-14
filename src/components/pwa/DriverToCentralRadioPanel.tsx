import React, { useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Loader2, MapPin, Navigation, Radio, RadioTower, Route, Send, X } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { playVHFRadioChirp, primeRadioAudio } from '../../lib/audioService';
import { sendDriverRadioToCentral } from '../../lib/driverOperations';
import { geocodeCommercialAddress } from '../../lib/geocoding';
import { estimateDrivingDistanceKm } from '../../lib/tripDistance';

const presets = [
  { code: 'available', label: 'Estoy libre', message: 'Libre y disponible para la siguiente carrera.' },
  { code: 'arrived_pickup', label: 'Llegué al retiro', message: 'Llegué al punto de retiro.' },
  { code: 'client_no_show', label: 'Cliente no aparece', message: 'Cliente no aparece. Solicito indicaciones de la central.' },
  { code: 'traffic_delay', label: 'Voy con demora', message: 'Tráfico intenso. Voy con demora.' },
  { code: 'returning_central', label: 'Voy a la central', message: 'Voy de regreso a la central.' },
  { code: 'call_me', label: 'Llámeme central', message: 'Solicito que la central me llame cuando pueda.' },
  { code: 'support', label: 'Solicito apoyo', message: 'Solicito apoyo e indicaciones de la central.' },
];

const getPrecisePosition = () => new Promise<GeolocationPosition>((resolve, reject) => {
  if (!navigator.geolocation) {
    reject(new Error('Este teléfono no tiene GPS disponible para Central GO.'));
    return;
  }
  navigator.geolocation.getCurrentPosition(resolve, reject, {
    enableHighAccuracy: true,
    maximumAge: 0,
    timeout: 15000,
  });
});

const gpsErrorMessage = (error: unknown) => {
  if (typeof error === 'object' && error && 'code' in error) {
    const code = Number((error as GeolocationPositionError).code);
    if (code === 1) return 'Activa la ubicación precisa para informar a la central dónde se encuentra el móvil.';
    if (code === 2) return 'No pudimos obtener tu ubicación. Revisa que el GPS esté encendido e inténtalo otra vez.';
    if (code === 3) return 'El GPS tardó demasiado. Inténtalo nuevamente en un lugar con mejor señal.';
  }
  return error instanceof Error ? error.message : 'No fue posible enviar la solicitud a la central.';
};

export const DriverToCentralRadioPanel: React.FC = () => {
  const { currentRole, currentCompany, currentUser, drivers, updateDriverLocation } = useApp();
  const [open, setOpen] = useState(false);
  const [sending, setSending] = useState<string | null>(null);
  const [sent, setSent] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [followupOpen, setFollowupOpen] = useState(false);
  const [followupDestination, setFollowupDestination] = useState('');
  const [followupBusy, setFollowupBusy] = useState(false);
  const [followupError, setFollowupError] = useState('');
  const [followupSuccess, setFollowupSuccess] = useState('');

  const driver = useMemo(() => drivers.find((item) => item.userId === currentUser.id), [drivers, currentUser.id]);
  if (currentRole !== 'driver' || currentCompany.id === 'network' || !driver) return null;

  const transmit = async (code: string, message: string) => {
    if (sending) return;
    setSending(code);
    setSent(null);
    setError('');
    try {
      await primeRadioAudio();
      await sendDriverRadioToCentral(currentCompany.id, code, message);
      playVHFRadioChirp();
      setSent(code);
      window.setTimeout(() => setSent((current) => current === code ? null : current), 2400);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No fue posible enviar el mensaje a la central.');
    } finally {
      setSending(null);
    }
  };

  const openFollowup = () => {
    setFollowupDestination('');
    setFollowupError('');
    setFollowupSuccess('');
    setFollowupOpen(true);
  };

  const submitFollowup = async (event: React.FormEvent) => {
    event.preventDefault();
    const cleanDestination = followupDestination.trim();
    if (cleanDestination.length < 3) {
      setFollowupError('Escribe la dirección a la que solicita ir el cliente.');
      return;
    }

    setFollowupBusy(true);
    setFollowupError('');
    setFollowupSuccess('');
    try {
      const position = await getPrecisePosition();
      const start = { lat: position.coords.latitude, lng: position.coords.longitude };
      const gpsLabel = `GPS ${start.lat.toFixed(5)}, ${start.lng.toFixed(5)}`;
      await updateDriverLocation(driver.id, start.lat, start.lng, gpsLabel);

      let distanceKm = 0;
      try {
        const destinationPoint = await geocodeCommercialAddress(currentCompany.id, cleanDestination);
        distanceKm = estimateDrivingDistanceKm(start, destinationPoint);
      } catch {
        // La ubicación del móvil y el destino deben llegar a la central incluso
        // si el geocodificador no puede estimar los kilómetros en ese momento.
      }

      const knownAddress = driver.currentLocation.address?.trim();
      const originText = knownAddress && !/^GPS\s/i.test(knownAddress) ? `${knownAddress} (${gpsLabel})` : gpsLabel;
      const distanceText = distanceKm > 0 ? ` · Distancia aprox. ${distanceKm.toFixed(1)} km` : ' · Distancia por confirmar';
      const message = `CLIENTE SOLICITA OTRO VIAJE · Desde ${originText} · Hacia ${cleanDestination}${distanceText}.`;

      await primeRadioAudio();
      await sendDriverRadioToCentral(currentCompany.id, 'client_followup_trip', message);
      playVHFRadioChirp();
      setFollowupSuccess(distanceKm > 0 ? `Solicitud enviada · ${distanceKm.toFixed(1)} km aprox.` : 'Solicitud enviada a la central.');
      window.setTimeout(() => {
        setFollowupOpen(false);
        setFollowupDestination('');
        setFollowupSuccess('');
      }, 1400);
    } catch (err) {
      setFollowupError(gpsErrorMessage(err));
    } finally {
      setFollowupBusy(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={openFollowup}
        className="fixed bottom-[calc(env(safe-area-inset-bottom)+8.8rem)] right-3 z-[74] flex min-h-11 max-w-[calc(100vw-1.5rem)] items-center gap-2 rounded-2xl border border-cyan-300/45 bg-cyan-500 px-3.5 py-2.5 text-[11px] font-black text-slate-950 shadow-xl shadow-black/35 active:scale-[0.98]"
        aria-label="Cliente solicita otro viaje"
      >
        <Route className="h-4 w-4 shrink-0" />
        <span>Cliente solicita otro viaje</span>
      </button>

      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-[calc(env(safe-area-inset-bottom)+5.25rem)] right-3 z-[75] flex h-12 w-12 items-center justify-center rounded-full border border-amber-300/60 bg-amber-400 text-zinc-950 shadow-xl shadow-black/45 active:scale-95"
        aria-label="Radio a la central"
        title="Radio a la central"
      >
        <Radio className="h-5 w-5" />
        <span className="sr-only">Radio central</span>
      </button>

      {followupOpen && (
        <div className="fixed inset-0 z-[180] flex items-end bg-black/80 p-3 backdrop-blur-md sm:items-center sm:justify-center">
          <section className="w-full max-w-md rounded-3xl border border-cyan-500/35 bg-[#0b0b0e] p-5 shadow-2xl shadow-black/70">
            <header className="flex items-start justify-between gap-4 border-b border-zinc-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-cyan-500/30 bg-cyan-500/10 text-cyan-300">
                  <Navigation className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-[9px] font-black uppercase tracking-[0.18em] text-cyan-300">{driver.unitNumber} · nuevo destino</p>
                  <h2 className="text-lg font-black text-white">Cliente solicita otro viaje</h2>
                </div>
              </div>
              <button type="button" onClick={() => setFollowupOpen(false)} disabled={followupBusy} className="rounded-xl border border-zinc-800 bg-zinc-950 p-2 text-zinc-500" aria-label="Cerrar"><X className="h-4 w-4" /></button>
            </header>

            <div className="mt-4 rounded-2xl border border-blue-500/20 bg-blue-500/[0.06] p-3 text-[11px] leading-relaxed text-zinc-300">
              <MapPin className="mr-1.5 inline h-4 w-4 text-cyan-300" /> Central GO tomará tu GPS actual como punto de partida y avisará a la central hacia dónde se dirige el móvil.
            </div>

            <form onSubmit={submitFollowup} className="mt-4 space-y-3">
              <label className="block">
                <span className="mb-2 block text-[10px] font-black uppercase tracking-wider text-zinc-500">Dirección de destino</span>
                <input
                  autoFocus
                  autoComplete="street-address"
                  value={followupDestination}
                  onChange={(event) => setFollowupDestination(event.target.value)}
                  placeholder="Ej. Av. León Bustos 1200"
                  className="w-full rounded-2xl border border-zinc-700 bg-zinc-950 px-4 py-3.5 text-sm font-bold text-white outline-none placeholder:text-zinc-600 focus:border-cyan-400"
                />
              </label>

              {followupError && <div className="flex gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-200"><AlertTriangle className="h-4 w-4 shrink-0" />{followupError}</div>}
              {followupSuccess && <div className="flex gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs font-bold text-emerald-200"><CheckCircle2 className="h-4 w-4 shrink-0" />{followupSuccess}</div>}

              <div className="flex gap-2 pt-1">
                <button type="button" disabled={followupBusy} onClick={() => setFollowupOpen(false)} className="flex-1 rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-xs font-black text-zinc-300 disabled:opacity-50">Cancelar</button>
                <button disabled={followupBusy} className="flex flex-[1.35] items-center justify-center gap-2 rounded-xl bg-cyan-500 px-4 py-3 text-xs font-black text-slate-950 disabled:opacity-55">
                  {followupBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  {followupBusy ? 'Ubicando y enviando…' : 'Aceptar y avisar'}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {open && (
        <div className="fixed inset-0 z-[170] flex items-end bg-black/80 p-3 backdrop-blur-md sm:items-center sm:justify-center">
          <section className="w-full max-w-md rounded-3xl border border-amber-500/35 bg-[#0b0b0e] p-5 shadow-2xl shadow-black/70">
            <header className="flex items-start justify-between gap-4 border-b border-zinc-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-amber-500/30 bg-amber-500/10 text-amber-300">
                  <RadioTower className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-[9px] font-black uppercase tracking-[0.18em] text-amber-300">{driver.unitNumber} · canal digital</p>
                  <h2 className="text-lg font-black text-white">Hablar con la central</h2>
                  <p className="text-[10px] text-zinc-500">Mensajes rápidos de un toque · sin escribir mientras conduces</p>
                </div>
              </div>
              <button onClick={() => setOpen(false)} className="rounded-xl border border-zinc-800 bg-zinc-950 p-2 text-zinc-500" aria-label="Cerrar radio"><X className="h-4 w-4" /></button>
            </header>

            {error && <div className="mt-4 flex gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-200"><AlertTriangle className="h-4 w-4 shrink-0" />{error}</div>}

            <button type="button" onClick={() => { setOpen(false); openFollowup(); }} className="mt-4 flex w-full items-center justify-between gap-3 rounded-2xl border border-cyan-500/35 bg-cyan-500/10 p-3.5 text-left active:scale-[0.99]">
              <span><strong className="block text-xs text-cyan-200">Cliente solicita otro viaje</strong><small className="mt-1 block text-[9px] text-zinc-500">Informa GPS actual y el nuevo destino a la central.</small></span>
              <Route className="h-5 w-5 shrink-0 text-cyan-300" />
            </button>

            <div className="mt-3 grid grid-cols-2 gap-2.5">
              {presets.map((preset) => {
                const isSending = sending === preset.code;
                const isSent = sent === preset.code;
                return (
                  <button
                    key={preset.code}
                    type="button"
                    disabled={Boolean(sending)}
                    onClick={() => void transmit(preset.code, preset.message)}
                    className={`min-h-20 rounded-2xl border p-3 text-left transition active:scale-[0.98] disabled:opacity-55 ${isSent ? 'border-emerald-400/50 bg-emerald-500/10' : 'border-zinc-800 bg-[#121215] hover:border-amber-500/40 hover:bg-amber-500/[0.06]'}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className={`text-xs font-black ${isSent ? 'text-emerald-300' : 'text-white'}`}>{preset.label}</span>
                      {isSending ? <Loader2 className="h-4 w-4 animate-spin text-amber-300" /> : isSent ? <CheckCircle2 className="h-4 w-4 text-emerald-400" /> : <Radio className="h-4 w-4 text-zinc-600" />}
                    </div>
                    <p className="mt-1.5 text-[9px] leading-relaxed text-zinc-500">{preset.message}</p>
                  </button>
                );
              })}
            </div>

            <p className="mt-4 text-center text-[9px] leading-relaxed text-zinc-600">Los mensajes entran a la consola en orden. Si dos móviles transmiten juntos, Central GO reproduce primero uno y después el siguiente.</p>
          </section>
        </div>
      )}
    </>
  );
};

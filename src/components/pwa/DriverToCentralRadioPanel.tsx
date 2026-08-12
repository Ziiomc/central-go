import React, { useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Loader2, Radio, RadioTower, X } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { playVHFRadioChirp, primeRadioAudio } from '../../lib/audioService';
import { sendDriverRadioToCentral } from '../../lib/driverOperations';

const presets = [
  { code: 'available', label: 'Estoy libre', message: 'Libre y disponible para la siguiente carrera.' },
  { code: 'arrived_pickup', label: 'Llegué al retiro', message: 'Llegué al punto de retiro.' },
  { code: 'client_no_show', label: 'Cliente no aparece', message: 'Cliente no aparece. Solicito indicaciones de la central.' },
  { code: 'traffic_delay', label: 'Voy con demora', message: 'Tráfico intenso. Voy con demora.' },
  { code: 'returning_central', label: 'Voy a la central', message: 'Voy de regreso a la central.' },
  { code: 'call_me', label: 'Llámeme central', message: 'Solicito que la central me llame cuando pueda.' },
  { code: 'support', label: 'Solicito apoyo', message: 'Solicito apoyo e indicaciones de la central.' },
];

export const DriverToCentralRadioPanel: React.FC = () => {
  const { currentRole, currentCompany, currentUser, drivers } = useApp();
  const [open, setOpen] = useState(false);
  const [sending, setSending] = useState<string | null>(null);
  const [sent, setSent] = useState<string | null>(null);
  const [error, setError] = useState('');

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

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-24 right-4 z-[75] flex h-14 items-center gap-2 rounded-2xl border border-amber-300/50 bg-amber-400 px-4 text-xs font-black text-zinc-950 shadow-2xl shadow-black/50 active:scale-95"
        aria-label="Radio a la central"
      >
        <Radio className="h-5 w-5" />
        <span>Radio central</span>
      </button>

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

            <div className="mt-4 grid grid-cols-2 gap-2.5">
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

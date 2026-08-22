import React, { useState } from 'react';
import { AlertTriangle, CheckCircle2, Loader2, Radio, RadioTower, Send, Volume2, X } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { playVHFRadioChirp, speakVHFDispatch } from '../../lib/audioService';
import { sendDriverRadioMessage } from '../../lib/driverOperations';

const VHF_PRESETS = [
  { label: 'Actualice estado', icon: '↻', msg: (unit: string) => `Atento móvil ${unit}, favor actualice su estado de disponibilidad en la aplicación.` },
  { label: 'Diríjase a central', icon: '⌂', msg: (unit: string) => `Atento móvil ${unit}, por favor diríjase a la central de radio taxis.` },
  { label: 'Reporte ubicación', icon: '⌖', msg: (unit: string) => `Atento móvil ${unit}, reporte su posición GPS actual a la central.` },
  { label: 'Tome siguiente carrera', icon: '↗', msg: (unit: string) => `Atento móvil ${unit}, tome la siguiente carrera disponible en su sector.` },
  { label: '¿En colación?', icon: '☕', msg: (unit: string) => `Atento móvil ${unit}, ¿se encuentra libre o en tiempo de colación?` },
  { label: 'Llamado de radio', icon: '!', msg: (unit: string) => `Atento móvil ${unit}, atento a la radio por llamado de seguridad de la central.` },
  { label: '¿Finalizó carrera?', icon: '✓', msg: (unit: string) => `Atento móvil ${unit}, confirme si ya finalizó el viaje anterior.` },
];

export const VHFDispatchModal: React.FC = () => {
  const { vhfModalDriver, setVHFModalDriver, addAuditLog, soundMuted, currentCompany } = useApp();
  const [customText, setCustomText] = useState('');
  const [lastSentMsg, setLastSentMsg] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  if (!vhfModalDriver) return null;

  const handleTransmit = async (textToSend: string) => {
    const message = textToSend.trim();
    if (!message || sending) return;
    setSending(true);
    setError('');
    try {
      await sendDriverRadioMessage(currentCompany.id, vhfModalDriver, message);
      playVHFRadioChirp();
      if (!soundMuted) speakVHFDispatch(message);
      addAuditLog('TRANSMISION_VHF', `Radio digital enviada a Móvil ${vhfModalDriver.unitNumber} (${vhfModalDriver.name}): "${message}"`);
      setLastSentMsg(message);
      setCustomText('');
      window.setTimeout(() => {
        setLastSentMsg(null);
        setVHFModalDriver(null);
      }, 1800);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No fue posible entregar el mensaje al conductor.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="pointer-events-none fixed inset-0 z-50 p-3 sm:p-5">
      <section className="pointer-events-auto absolute right-3 top-3 max-h-[calc(100dvh-1.5rem)] w-[min(390px,calc(100vw-1.5rem))] overflow-y-auto rounded-2xl border border-cyan-400/25 bg-[#091521]/95 p-3 text-slate-100 shadow-[0_20px_70px_rgba(0,0,0,.55)] backdrop-blur-2xl sm:right-5 sm:top-5">
        <header className="flex items-center gap-2.5 border-b border-white/10 pb-2.5">
          <div className="grid h-9 w-9 place-items-center rounded-xl border border-cyan-300/25 bg-cyan-400/10 text-cyan-300"><RadioTower className="h-4 w-4" /></div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2"><h3 className="text-sm font-black tracking-tight text-white">Radio digital</h3><span className="rounded-full border border-amber-300/30 bg-amber-400/10 px-1.5 py-0.5 text-[8px] font-black text-amber-200">Móvil {vhfModalDriver.unitNumber}</span></div>
            <p className="mt-0.5 truncate text-[9px] text-slate-400">{vhfModalDriver.name} · entrega con lectura por voz</p>
          </div>
          <button type="button" onClick={() => setVHFModalDriver(null)} className="grid h-7 w-7 place-items-center rounded-lg border border-white/10 bg-white/[.04] text-slate-400 transition hover:bg-white/10 hover:text-white" aria-label="Cerrar radio"><X className="h-4 w-4" /></button>
        </header>

        {!vhfModalDriver.userId && <div className="mt-2 flex gap-1.5 rounded-xl border border-amber-400/25 bg-amber-400/10 p-2 text-[9px] leading-relaxed text-amber-100"><AlertTriangle className="h-3.5 w-3.5 shrink-0" />Este conductor aún no tiene una cuenta profesional vinculada.</div>}
        {error && <div className="mt-2 rounded-xl border border-rose-400/25 bg-rose-400/10 p-2 text-[9px] font-semibold text-rose-100">{error}</div>}

        {lastSentMsg ? (
          <div className="mt-3 flex items-center gap-2 rounded-xl border border-emerald-400/25 bg-emerald-400/10 p-3 text-emerald-100"><CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-300" /><div><p className="text-[10px] font-black uppercase tracking-wide">Mensaje entregado</p><p className="mt-0.5 line-clamp-2 text-[9px] text-emerald-100/75">{lastSentMsg}</p></div></div>
        ) : (
          <>
            <div className="mb-2 mt-3 flex items-center justify-between"><p className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-[.14em] text-cyan-200"><Radio className="h-3.5 w-3.5" />Mensajes rápidos</p><span className="text-[8px] text-slate-500">Un toque · lectura por voz</span></div>
            <div className="grid grid-cols-2 gap-1.5">
              {VHF_PRESETS.map((item) => (
                <button key={item.label} type="button" disabled={sending || !vhfModalDriver.userId} title={item.msg(vhfModalDriver.unitNumber)} onClick={() => void handleTransmit(item.msg(vhfModalDriver.unitNumber))} className="group flex min-h-12 items-center gap-2 rounded-xl border border-white/10 bg-white/[.045] px-2.5 py-2 text-left transition hover:border-cyan-300/35 hover:bg-cyan-300/[.08] active:scale-[.98] disabled:opacity-40">
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-lg bg-cyan-400/10 text-xs font-black text-cyan-200 group-hover:bg-cyan-300/20">{item.icon}</span><span className="min-w-0 flex-1 truncate text-[10px] font-black text-slate-100">{item.label}</span><Volume2 className="h-3 w-3 shrink-0 text-slate-500 group-hover:text-cyan-200" />
                </button>
              ))}
            </div>

            <form onSubmit={(event) => { event.preventDefault(); void handleTransmit(customText.trim() ? `Atento móvil ${vhfModalDriver.unitNumber}, ${customText}` : `Atento móvil ${vhfModalDriver.unitNumber}, atento a la central.`); }} className="mt-3 flex gap-1.5 border-t border-white/10 pt-2.5">
              <input type="text" value={customText} onChange={(event) => setCustomText(event.target.value)} placeholder="Mensaje personalizado…" className="h-9 min-w-0 flex-1 rounded-lg border border-white/10 bg-black/20 px-2.5 text-[10px] text-white outline-none placeholder:text-slate-500 focus:border-cyan-300/40" />
              <button type="submit" disabled={sending || !vhfModalDriver.userId} className="flex h-9 shrink-0 items-center gap-1 rounded-lg bg-cyan-300 px-2.5 text-[9px] font-black text-slate-950 transition hover:bg-cyan-200 disabled:opacity-40">{sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}Enviar</button>
            </form>
          </>
        )}
      </section>
    </div>
  );
};

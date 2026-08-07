import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { playVHFRadioChirp, speakVHFDispatch } from '../../lib/audioService';
import { Radio, X, Send, Volume2, RadioTower, Sparkles, CheckCircle2 } from 'lucide-react';

export const VHFDispatchModal: React.FC = () => {
  const { vhfModalDriver, setVHFModalDriver, addAuditLog, addNotification, soundMuted } = useApp();
  const [customText, setCustomText] = useState('');
  const [lastSentMsg, setLastSentMsg] = useState<string | null>(null);

  if (!vhfModalDriver) return null;

  // Preset quick messages for Chilean Radio Taxi Operators
  const VHF_PRESETS = [
    { label: '🔄 Actualice Estado', msg: `Atento móvil ${vhfModalDriver.unitNumber}, favor actualice su estado de disponibilidad en la aplicación.` },
    { label: '🏢 Diríjase a Central', msg: `Atento móvil ${vhfModalDriver.unitNumber}, por favor diríjase a la central de radio taxis.` },
    { label: '📍 Reporte Ubicación', msg: `Atento móvil ${vhfModalDriver.unitNumber}, reporte su posición GPS actual a la central.` },
    { label: '⚡ Tome Siguiente Carrera', msg: `Atento móvil ${vhfModalDriver.unitNumber}, tome la siguiente carrera disponible en su sector.` },
    { label: '☕ ¿En Colación / Libre?', msg: `Atento móvil ${vhfModalDriver.unitNumber}, ¿se encuentra libre o en tiempo de colación?` },
    { label: '⚠️ Llamado de Radio', msg: `Atento móvil ${vhfModalDriver.unitNumber}, atento a la radio por llamado de seguridad de la central.` },
    { label: '🏁 ¿Finalizó Carrera?', msg: `Atento móvil ${vhfModalDriver.unitNumber}, confirme si ya finalizó el viaje anterior.` },
  ];

  const handleTransmit = (textToSend: string) => {
    if (!textToSend.trim()) return;

    // Trigger VHF Radio audio chirp and speech synthesis
    playVHFRadioChirp();
    if (!soundMuted) {
      speakVHFDispatch(textToSend);
    }

    addAuditLog(
      'TRANSMISION_VHF',
      `Transmitió por VHF a Móvil ${vhfModalDriver.unitNumber} (${vhfModalDriver.name}): "${textToSend}"`
    );

    addNotification(
      'Mensaje Radio VHF Enviado',
      `Móvil ${vhfModalDriver.unitNumber}: ${textToSend}`,
      'info',
      vhfModalDriver.id
    );

    setLastSentMsg(textToSend);
    setCustomText('');

    setTimeout(() => {
      setLastSentMsg(null);
      setVHFModalDriver(null);
    }, 1800);
  };

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-3 overflow-y-auto animate-fade-in font-sans">
      <div className="bg-[#0d0d0f] border border-amber-500/40 rounded-2xl max-w-lg w-full p-5 space-y-4 shadow-2xl relative my-6">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400 flex items-center justify-center font-extrabold shadow-md">
              <RadioTower className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h3 className="font-black text-white text-base tracking-tight flex items-center gap-2">
                <span>VHF Transmisión</span>
                <span className="text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded font-mono font-bold">
                  Móvil {vhfModalDriver.unitNumber}
                </span>
              </h3>
              <p className="text-[11px] text-zinc-400 font-mono">
                Conductor: <strong className="text-zinc-200">{vhfModalDriver.name}</strong> • Frecuencia 148.525 MHz
              </p>
            </div>
          </div>

          <button
            onClick={() => setVHFModalDriver(null)}
            className="p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Confirmation Banner when sent */}
        {lastSentMsg ? (
          <div className="p-4 bg-emerald-500/15 border border-emerald-500/40 rounded-xl flex items-center gap-3 text-emerald-300 animate-pulse">
            <CheckCircle2 className="w-6 h-6 shrink-0 text-emerald-400" />
            <div>
              <div className="font-bold text-xs uppercase tracking-wider">¡Transmisión por Radio VHF Exitosa!</div>
              <div className="text-xs text-emerald-200/90 italic font-mono mt-0.5">"{lastSentMsg}"</div>
            </div>
          </div>
        ) : (
          <>
            {/* Quick Preset Buttons */}
            <div className="space-y-2">
              <div className="text-[10px] font-mono uppercase tracking-wider text-amber-400 font-bold flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Mensajes Preestablecidos Rápidos (1-Click)</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {VHF_PRESETS.map((item, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleTransmit(item.msg)}
                    className="p-2.5 bg-[#121215] hover:bg-amber-500/15 border border-zinc-800 hover:border-amber-500/40 rounded-xl text-left transition group flex flex-col gap-0.5"
                  >
                    <div className="text-xs font-bold text-zinc-200 group-hover:text-amber-300 flex items-center justify-between">
                      <span>{item.label}</span>
                      <Volume2 className="w-3.5 h-3.5 text-zinc-500 group-hover:text-amber-400" />
                    </div>
                    <div className="text-[10px] text-zinc-400 line-clamp-1 font-mono">
                      {item.msg}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Custom Audio Message Input Form */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleTransmit(
                  customText.trim()
                    ? `Atento móvil ${vhfModalDriver.unitNumber}, ${customText}`
                    : `Atento móvil ${vhfModalDriver.unitNumber}, atento a la central.`
                );
              }}
              className="space-y-2 pt-2 border-t border-zinc-800"
            >
              <label className="text-xs font-mono font-bold text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
                <Radio className="w-3.5 h-3.5 text-blue-400" />
                <span>Mensaje Personalizado por Voz</span>
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={customText}
                  onChange={(e) => setCustomText(e.target.value)}
                  placeholder={`Ej: Cliente en portón negro espera...`}
                  className="flex-1 bg-[#121215] border border-zinc-800 focus:border-amber-500 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none transition shadow-inner"
                />
                <button
                  type="submit"
                  className="px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs rounded-xl shadow-lg shadow-amber-500/20 transition flex items-center gap-1.5 shrink-0 border border-amber-300 uppercase tracking-wider transform active:scale-95"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Emitir</span>
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
};

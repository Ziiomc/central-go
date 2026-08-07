import React from 'react';
import { useApp } from '../../context/AppContext';
import { ShieldAlert, MapPin, Phone, Radio, CheckCircle, ExternalLink } from 'lucide-react';

export const SOSAlertModal: React.FC = () => {
  const { activeSOSDriver, resolveDriverSOS, setActiveModule } = useApp();

  if (!activeSOSDriver) return null;

  return (
    <div className="fixed inset-0 bg-red-950/80 backdrop-blur-lg z-50 flex items-center justify-center p-4 animate-pulse">
      <div className="bg-[#0d0d0f] border-2 border-red-600 rounded-xl max-w-lg w-full p-6 space-y-5 shadow-[0_0_50px_rgba(239,68,68,0.6)]">
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-red-600/40 pb-4">
          <div className="w-12 h-12 rounded-lg bg-red-600 text-white flex items-center justify-center shadow-lg animate-bounce">
            <ShieldAlert className="w-7 h-7" />
          </div>
          <div>
            <h2 className="font-extrabold text-xl text-red-500 uppercase tracking-tight">
              🚨 ALERTA SOS DE EMERGENCIA
            </h2>
            <p className="text-xs text-zinc-300 font-mono">
              Interrupción prioritaria por botón de pánico de móvil
            </p>
          </div>
        </div>

        {/* Driver Details */}
        <div className="bg-[#121215] p-4 rounded-lg border border-red-500/30 flex items-center gap-4">
          <img
            src={activeSOSDriver.photoUrl}
            alt={activeSOSDriver.name}
            className="w-16 h-16 rounded-full object-cover border-2 border-red-500 shadow-xl"
          />
          <div>
            <div className="text-lg font-extrabold text-white">
              {activeSOSDriver.unitNumber} - {activeSOSDriver.name}
            </div>
            <div className="text-xs text-zinc-400 font-mono">
              Teléfono: <span className="text-white font-bold">{activeSOSDriver.phone}</span>
            </div>
            <div className="text-xs text-blue-400 font-mono mt-0.5">
              Frecuencia VHF: <span className="font-bold">148.525 MHz</span>
            </div>
          </div>
        </div>

        {/* GPS Location */}
        <div className="space-y-1 bg-[#121215] p-3 rounded-lg border border-zinc-800">
          <div className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider">Ubicación GPS Transmitida</div>
          <div className="text-sm font-bold text-zinc-100 flex items-center gap-2">
            <MapPin className="w-4 h-4 text-red-500 shrink-0" />
            <span>{activeSOSDriver.currentLocation.address || 'Coordenadas GPS en directo'}</span>
          </div>
        </div>

        {/* Emergency Protocol Actions */}
        <div className="grid grid-cols-2 gap-3">
          <a
            href={`tel:${activeSOSDriver.phone}`}
            className="py-3 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs rounded-lg flex items-center justify-center gap-2 transition uppercase tracking-wider"
          >
            <Phone className="w-4 h-4" />
            <span>LLAMAR CONDUCTOR</span>
          </a>

          <button
            onClick={() => {
              setActiveModule('live_map');
            }}
            className="py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-lg flex items-center justify-center gap-2 transition uppercase tracking-wider"
          >
            <ExternalLink className="w-4 h-4" />
            <span>VER EN MAPA TIEMPO REAL</span>
          </button>
        </div>

        {/* Resolve Button */}
        <button
          onClick={() => resolveDriverSOS(activeSOSDriver.id)}
          className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs rounded-lg shadow-lg flex items-center justify-center gap-2 transition uppercase tracking-wider"
        >
          <CheckCircle className="w-4 h-4" />
          <span>MARCAR EMERGENCIA COMO RESUELTA / FALSA ALARMA</span>
        </button>
      </div>
    </div>
  );
};

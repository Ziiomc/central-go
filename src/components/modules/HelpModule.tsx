import React from 'react';
import { HelpCircle, Radio, Zap, ShieldCheck, CheckCircle2, XCircle } from 'lucide-react';

export const HelpModule: React.FC = () => {
  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="font-extrabold text-2xl text-white tracking-tight flex items-center gap-2 uppercase font-sans">
          <HelpCircle className="w-6 h-6 text-blue-500" />
          Centro de Ayuda y Protocolos de Operación
        </h1>
        <p className="text-xs text-zinc-400 mt-1 font-sans">
          Guía de transición del sistema analógico VHF al ecosistema digital PWA
        </p>
      </div>

      {/* Comparison Grid: Traditional VHF vs Royal Dispatch */}
      <div className="bg-[#0d0d0f] border border-zinc-800 rounded-xl p-6 space-y-4 shadow-xl">
        <h3 className="font-extrabold text-base text-white flex items-center gap-2 uppercase tracking-tight">
          <Zap className="w-5 h-5 text-blue-500" />
          Modernización del Trabajo Tradicional (No es un clon de Uber)
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-sans">
          {/* Traditional Issues */}
          <div className="bg-[#121215] p-4 rounded-lg border border-rose-500/20 space-y-2">
            <div className="font-bold text-rose-400 text-sm flex items-center gap-1.5 uppercase font-sans tracking-wide">
              <XCircle className="w-4 h-4" /> Problemas Radio VHF Tradicional
            </div>
            <ul className="space-y-1.5 text-zinc-400 list-disc list-inside">
              <li>Conductores hablando al mismo tiempo en el micrófono.</li>
              <li>Direcciones mal escuchadas o repetidas constantemente.</li>
              <li>Imposible saber la ubicación exacta de los taxis libres.</li>
              <li>Proceso de asignación lento (varios minutos por llamada).</li>
              <li>Sin métricas ni registro digital de llamadas.</li>
            </ul>
          </div>

          {/* CentralGo Solutions */}
          <div className="bg-[#121215] p-4 rounded-lg border border-emerald-500/20 space-y-2">
            <div className="font-bold text-emerald-400 text-sm flex items-center gap-1.5 uppercase font-sans tracking-wide">
              <CheckCircle2 className="w-4 h-4" /> Solución CentralGo PWA
            </div>
            <ul className="space-y-1.5 text-zinc-300 list-disc list-inside">
              <li>Despacho digital directo a la pantalla del teléfono del móvil.</li>
              <li>GPS en tiempo real sobre el mapa de la central.</li>
              <li>Asignación en 1-click en menos de 20 segundos.</li>
              <li>Botón SOS directo para emergencias con coordenadas pánico.</li>
              <li>La operadora mantiene el control total sin reemplazarla.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

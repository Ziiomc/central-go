import React from 'react';
import { useApp } from '../../context/AppContext';
import { Headphones, Clock, Radio, Award } from 'lucide-react';

export const OperatorsModule: React.FC = () => {
  const { operators } = useApp();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-extrabold text-2xl text-white tracking-tight flex items-center gap-2 uppercase font-sans">
          <Headphones className="w-6 h-6 text-blue-500" />
          Operadoras de Central
        </h1>
        <p className="text-xs text-zinc-400 mt-1 font-sans">
          Puesto de despacho, control de turnos y métricas de velocidad de atención
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {operators.map((op) => (
          <div
            key={op.id}
            className="bg-[#0d0d0f] border border-zinc-800 rounded-xl p-5 space-y-4 shadow-xl"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center font-bold">
                  <Headphones className="w-5 h-5" />
                </div>
                <div>
                  <div className="font-extrabold text-base text-white">{op.name}</div>
                  <div className="text-xs text-zinc-400 font-mono">Turno {op.shift}</div>
                </div>
              </div>

              <span className="px-2.5 py-1 rounded text-[10px] font-bold font-mono bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 uppercase tracking-wider">
                {op.status}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs font-mono">
              <div className="bg-[#121215] p-3 rounded-lg border border-zinc-800">
                <span className="text-[10px] text-zinc-400 uppercase tracking-wider block">Despachos Hoy</span>
                <span className="font-bold text-blue-400 text-lg">{op.dispatchesToday}</span>
              </div>

              <div className="bg-[#121215] p-3 rounded-lg border border-zinc-800">
                <span className="text-[10px] text-zinc-400 uppercase tracking-wider block">Promedio Asignación</span>
                <span className="font-bold text-emerald-400 text-lg">{op.avgDispatchTimeSeconds} seg</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

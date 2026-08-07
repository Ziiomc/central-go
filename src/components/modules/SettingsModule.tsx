import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Settings, DollarSign, Radio, RadioTower, CheckCircle } from 'lucide-react';

export const SettingsModule: React.FC = () => {
  const { fareConfig, updateFareConfig, currentCompany } = useApp();

  const [baseFare, setBaseFare] = useState(fareConfig.baseFare);
  const [pricePerKm, setPricePerKm] = useState(fareConfig.pricePerKm);
  const [pricePerMinuteWait, setPricePerMinuteWait] = useState(fareConfig.pricePerMinuteWait);
  const [nightSurchargePercent, setNightSurchargePercent] = useState(fareConfig.nightSurchargePercent);
  const [savedSuccess, setSavedSuccess] = useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    updateFareConfig({
      ...fareConfig,
      baseFare,
      pricePerKm,
      pricePerMinuteWait,
      nightSurchargePercent,
    });
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="font-extrabold text-2xl text-white tracking-tight flex items-center gap-2 uppercase font-sans">
          <Settings className="w-6 h-6 text-blue-500" />
          Configuración Central de Tarifas y Parámetros
        </h1>
        <p className="text-xs text-zinc-400 mt-1 font-sans">
          Ajuste de bajada de bandera, ficha por kilómetro y frecuencia VHF de respaldo
        </p>
      </div>

      <form onSubmit={handleSave} className="bg-[#0d0d0f] border border-zinc-800 rounded-xl p-6 space-y-5 shadow-2xl">
        <h3 className="font-extrabold text-base text-white flex items-center gap-2 border-b border-zinc-800 pb-3 uppercase tracking-tight">
          <DollarSign className="w-5 h-5 text-emerald-400" />
          Tarifario Digital ({currentCompany.name})
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-zinc-300 font-mono uppercase tracking-wider block">Bajada de Bandera ($)</label>
            <input
              type="number"
              value={baseFare}
              onChange={(e) => setBaseFare(Number(e.target.value))}
              required
              className="w-full bg-[#121215] border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-200 mt-1 focus:outline-none focus:border-blue-500 transition"
            />
          </div>

          <div>
            <label className="text-xs text-zinc-300 font-mono uppercase tracking-wider block">Precio por Kilómetro ($)</label>
            <input
              type="number"
              value={pricePerKm}
              onChange={(e) => setPricePerKm(Number(e.target.value))}
              required
              className="w-full bg-[#121215] border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-200 mt-1 focus:outline-none focus:border-blue-500 transition"
            />
          </div>

          <div>
            <label className="text-xs text-zinc-300 font-mono uppercase tracking-wider block">Minuto de Espera ($)</label>
            <input
              type="number"
              value={pricePerMinuteWait}
              onChange={(e) => setPricePerMinuteWait(Number(e.target.value))}
              required
              className="w-full bg-[#121215] border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-200 mt-1 focus:outline-none focus:border-blue-500 transition"
            />
          </div>

          <div>
            <label className="text-xs text-zinc-300 font-mono uppercase tracking-wider block">Recargo Nocturno (%)</label>
            <input
              type="number"
              value={nightSurchargePercent}
              onChange={(e) => setNightSurchargePercent(Number(e.target.value))}
              required
              className="w-full bg-[#121215] border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-200 mt-1 focus:outline-none focus:border-blue-500 transition"
            />
          </div>
        </div>

        <div className="bg-[#121215] p-4 rounded-lg border border-zinc-800 space-y-1 text-xs">
          <div className="font-bold text-blue-400 flex items-center gap-2 uppercase tracking-wider">
            <RadioTower className="w-4 h-4" /> Frecuencia de Emergencia VHF
          </div>
          <div className="text-zinc-300 font-mono">{currentCompany.vhfFrequency}</div>
          <p className="text-[11px] text-zinc-500">
            Mantenida en reserva exclusivamente para eventos donde la cobertura celular falle.
          </p>
        </div>

        {savedSuccess && (
          <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 rounded-lg text-xs font-bold flex items-center gap-2">
            <CheckCircle className="w-4 h-4" /> Configuración guardada correctamente
          </div>
        )}

        <button
          type="submit"
          className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-xs rounded-lg shadow-lg transition uppercase tracking-wider"
        >
          Guardar Cambios de Tarifa
        </button>
      </form>
    </div>
  );
};

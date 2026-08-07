import React from 'react';
import { useApp } from '../../context/AppContext';
import { History, Search, ShieldCheck } from 'lucide-react';

export const HistoryModule: React.FC = () => {
  const { auditLogs } = useApp();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-extrabold text-2xl text-white tracking-tight flex items-center gap-2 uppercase font-sans">
          <History className="w-6 h-6 text-blue-500" />
          Historial de Auditoría de la Operación
        </h1>
        <p className="text-xs text-zinc-400 mt-1 font-sans">
          Registro inalterable de asignaciones, cambios de estado, alertas SOS e intervenciones de operadoras
        </p>
      </div>

      <div className="bg-[#0d0d0f] border border-zinc-800 rounded-xl overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-zinc-300">
            <thead className="bg-[#121215] text-zinc-400 uppercase font-mono text-[10px] border-b border-zinc-800">
              <tr>
                <th className="p-4">Fecha / Hora</th>
                <th className="p-4">Usuario</th>
                <th className="p-4">Rol</th>
                <th className="p-4">Acción</th>
                <th className="p-4">Descripción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800 font-sans">
              {auditLogs.map((log) => (
                <tr key={log.id} className="hover:bg-zinc-800/50 transition">
                  <td className="p-4 font-mono text-zinc-400">
                    {new Date(log.timestamp).toLocaleTimeString()}
                  </td>
                  <td className="p-4 font-bold text-white">{log.userName}</td>
                  <td className="p-4 font-mono text-blue-400 uppercase text-[10px] tracking-wider">{log.userRole}</td>
                  <td className="p-4 font-mono font-bold text-emerald-400">{log.action}</td>
                  <td className="p-4 text-zinc-200">{log.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

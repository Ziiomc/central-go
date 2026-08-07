import React from 'react';
import { useApp } from '../../context/AppContext';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
} from 'recharts';
import { BarChart3, TrendingUp, Clock, DollarSign, Award, Radio } from 'lucide-react';

export const ReportsModule: React.FC = () => {
  const { trips, drivers } = useApp();

  // Hourly trips density data
  const hourlyData = [
    { hour: '06:00', viajes: 12 },
    { hour: '08:00', viajes: 38 },
    { hour: '10:00', viajes: 24 },
    { hour: '12:00', viajes: 31 },
    { hour: '14:00', viajes: 29 },
    { hour: '16:00', viajes: 42 },
    { hour: '18:00', viajes: 58 },
    { hour: '20:00', viajes: 49 },
    { hour: '22:00', viajes: 22 },
  ];

  // Dispatch response time comparison data (PWA vs Radio VHF)
  const speedComparisonData = [
    { sistema: 'Radio VHF Tradicional', segundos: 300 }, // 5 mins
    { sistema: 'CentralGo PWA', segundos: 18 }, // 18 seconds
  ];

  // Payment methods pie chart data
  const paymentData = [
    { name: 'Efectivo', value: 55, color: '#10b981' },
    { name: 'Transferencia / MP', value: 25, color: '#3b82f6' },
    { name: 'Posnet / Tarjeta', value: 12, color: '#f59e0b' },
    { name: 'Cuenta Corriente', value: 8, color: '#8b5cf6' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-extrabold text-2xl text-white tracking-tight flex items-center gap-2 uppercase font-sans">
          <BarChart3 className="w-6 h-6 text-blue-500" />
          Reportes y Estadísticas de Operación
        </h1>
        <p className="text-xs text-zinc-400 mt-1 font-sans">
          Análisis de rendimiento, horarios pico y eficiencia comparativa con la radio tradicional
        </p>
      </div>

      {/* Speed Comparison Banner */}
      <div className="bg-[#0d0d0f] p-5 rounded-xl border border-zinc-800 flex flex-col md:flex-row items-center justify-between gap-4 shadow-xl">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-blue-400 font-extrabold text-sm uppercase font-sans">
            <Clock className="w-4 h-4" />
            <span>Optimizador de Tiempos de Despacho</span>
          </div>
          <p className="text-xs text-zinc-300 font-sans">
            CentralGo reduce el tiempo de asignación de <strong className="text-rose-400">5 minutos (300s)</strong> por radio a solo <strong className="text-emerald-400">18 segundos</strong> mediante GPS automático.
          </p>
        </div>

        <div className="text-right font-mono shrink-0">
          <div className="text-2xl font-extrabold text-emerald-400">92% MÁS RÁPIDO</div>
          <div className="text-[10px] text-zinc-400 uppercase tracking-wider">Sin saturación de audio VHF</div>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chart 1: Trips per hour */}
        <div className="bg-[#0d0d0f] border border-zinc-800 rounded-xl p-5 space-y-3 shadow-xl">
          <h3 className="font-bold text-sm text-white flex items-center gap-2 uppercase font-sans tracking-tight">
            <TrendingUp className="w-4 h-4 text-blue-500" />
            Densidad de Viajes Despachados por Hora
          </h3>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={hourlyData}>
                <XAxis dataKey="hour" stroke="#71717a" fontSize={11} />
                <YAxis stroke="#71717a" fontSize={11} />
                <Tooltip contentStyle={{ backgroundColor: '#121215', borderColor: '#27272a', borderRadius: '8px', color: '#fff' }} />
                <Bar dataKey="viajes" fill="#2563eb" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 2: Payment Distribution */}
        <div className="bg-[#0d0d0f] border border-zinc-800 rounded-xl p-5 space-y-3 shadow-xl">
          <h3 className="font-bold text-sm text-white flex items-center gap-2 uppercase font-sans tracking-tight">
            <DollarSign className="w-4 h-4 text-emerald-400" />
            Distribución de Medios de Pago
          </h3>
          <div className="h-64 w-full flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={paymentData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  label={(entry) => `${entry.name} (${entry.value}%)`}
                >
                  {paymentData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ backgroundColor: '#121215', borderColor: '#27272a', borderRadius: '8px', color: '#fff' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};

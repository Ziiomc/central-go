import React, { useMemo } from 'react';
import { BarChart3, Clock, DollarSign, Route, Users } from 'lucide-react';
import { useApp } from '../../context/AppContext';

const paymentLabel: Record<string, string> = {
  efectivo: 'Efectivo',
  transferencia: 'Transferencia',
  posnet_tarjeta: 'Tarjeta / POS',
  cuenta_corriente: 'Cuenta corriente',
};

export const ReportsModule: React.FC = () => {
  const { trips, drivers, currentCompany } = useApp();

  const stats = useMemo(() => {
    const completed = trips.filter((trip) => trip.status === 'completed');
    const cancelled = trips.filter((trip) => trip.status === 'cancelled');
    const gross = completed.reduce((sum, trip) => sum + (trip.finalFare ?? trip.estimatedFare ?? 0), 0);
    const assignmentSamples = trips
      .filter((trip) => trip.assignedAt)
      .map((trip) => Math.max(0, (new Date(trip.assignedAt!).getTime() - new Date(trip.createdAt).getTime()) / 1000));
    const avgAssignment = assignmentSamples.length ? Math.round(assignmentSamples.reduce((sum, value) => sum + value, 0) / assignmentSamples.length) : null;

    const hours = Array.from({ length: 24 }, (_, hour) => ({ hour, count: 0 }));
    trips.forEach((trip) => {
      const date = new Date(trip.createdAt);
      if (!Number.isNaN(date.getTime())) hours[date.getHours()].count += 1;
    });
    const maxHour = Math.max(1, ...hours.map((item) => item.count));

    const payments = completed.reduce<Record<string, { count: number; amount: number }>>((acc, trip) => {
      const key = trip.paymentMethod || 'efectivo';
      acc[key] ??= { count: 0, amount: 0 };
      acc[key].count += 1;
      acc[key].amount += trip.finalFare ?? trip.estimatedFare ?? 0;
      return acc;
    }, {});

    return { completed, cancelled, gross, avgAssignment, hours, maxHour, payments };
  }, [trips]);

  return (
    <div className="space-y-6">
      <div><h1 className="font-extrabold text-2xl text-white tracking-tight flex items-center gap-2"><BarChart3 className="w-6 h-6 text-blue-500" />Reportes de operación</h1><p className="text-xs text-zinc-400 mt-1">Métricas calculadas exclusivamente con carreras persistidas de {currentCompany.name}.</p></div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4"><Metric icon={Route} label="Carreras completadas" value={String(stats.completed.length)} detail={`${stats.cancelled.length} canceladas`} /><Metric icon={DollarSign} label="Facturación registrada" value={`$${stats.gross.toLocaleString('es-CL')}`} detail="Suma de tarifas finales/registradas" /><Metric icon={Clock} label="Asignación promedio" value={stats.avgAssignment == null ? '—' : `${stats.avgAssignment} s`} detail="Desde creación hasta asignación" /><Metric icon={Users} label="Conductores cargados" value={String(drivers.length)} detail={`${drivers.filter((driver) => driver.status !== 'offline').length} no están fuera de línea`} /></div>

      <div className="grid xl:grid-cols-2 gap-5">
        <section className="rounded-2xl border border-zinc-800 bg-[#0d0d0f] p-5 shadow-xl"><div><h2 className="text-sm font-black text-white">Carreras por hora</h2><p className="mt-1 text-[10px] text-zinc-500">Distribución real del historial cargado.</p></div><div className="mt-5 space-y-2">{stats.hours.filter((item) => item.count > 0).map((item) => <div key={item.hour} className="grid grid-cols-[46px_1fr_36px] items-center gap-3"><span className="text-[10px] font-mono text-zinc-500">{String(item.hour).padStart(2,'0')}:00</span><div className="h-2.5 rounded-full bg-zinc-900 overflow-hidden"><div className="h-full rounded-full bg-blue-500" style={{ width: `${Math.max(5,(item.count/stats.maxHour)*100)}%` }} /></div><span className="text-right text-[10px] font-black text-zinc-300">{item.count}</span></div>)}{stats.hours.every((item) => item.count === 0) && <p className="py-10 text-center text-xs text-zinc-500">Aún no hay carreras para construir esta distribución.</p>}</div></section>

        <section className="rounded-2xl border border-zinc-800 bg-[#0d0d0f] p-5 shadow-xl"><div><h2 className="text-sm font-black text-white">Medios de pago</h2><p className="mt-1 text-[10px] text-zinc-500">Solo carreras completadas.</p></div><div className="mt-5 space-y-3">{Object.entries(stats.payments).map(([method, value]) => <div key={method} className="flex items-center justify-between gap-4 rounded-xl border border-zinc-800 bg-zinc-950/60 p-3"><div><p className="text-xs font-black text-white">{paymentLabel[method] ?? method}</p><p className="mt-0.5 text-[9px] text-zinc-600">{value.count} carreras</p></div><p className="text-sm font-black text-emerald-300">${value.amount.toLocaleString('es-CL')}</p></div>)}{Object.keys(stats.payments).length === 0 && <p className="py-10 text-center text-xs text-zinc-500">Todavía no hay pagos registrados.</p>}</div></section>
      </div>

      <section className="rounded-2xl border border-blue-500/20 bg-blue-500/[0.04] p-4"><p className="text-[10px] leading-relaxed text-blue-200/80"><strong className="text-blue-300">Sin comparaciones inventadas:</strong> retiramos del entorno oficial las cifras históricas fijas de “radio tradicional vs Central GO”. Cuando exista suficiente operación real, podremos calcular tendencias y SLA con los datos de cada central.</p></section>
    </div>
  );
};

const Metric: React.FC<{ icon: any; label:string; value:string; detail:string }> = ({icon:Icon,label,value,detail}) => <div className="rounded-2xl border border-zinc-800 bg-[#0d0d0f] p-4"><div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-wider text-zinc-600"><Icon className="h-4 w-4 text-blue-400" />{label}</div><p className="mt-2 text-2xl font-black text-white">{value}</p><p className="mt-1 text-[9px] text-zinc-600">{detail}</p></div>;

import React, { useState } from 'react';
import { AlertCircle, Building2, CheckCircle2, Clock3, Headphones, MessageCircle, Search, ShieldCheck, UserRoundCheck } from 'lucide-react';
import { NetworkKpi, StatusPill } from '../network/NetworkUi';

const tickets = [
  { id: 'SUP-1042', central: 'Central Taxi Arequipa', subject: 'Problema al renovar suscripción', region: 'Perú Sur', owner: 'Renzo Medina', priority: 'high', status: 'pending', age: '28 min' },
  { id: 'SUP-1041', central: 'Taxi Seguro Talca', subject: 'Capacitación para nueva operadora', region: 'Chile Centro-Sur', owner: 'María Paz Herrera', priority: 'normal', status: 'available', age: '46 min' },
  { id: 'SUP-1039', central: 'Radio Móvil Mendoza', subject: 'Actualizar datos de la flota', region: 'Argentina Oeste', owner: 'Valentina Núñez', priority: 'normal', status: 'paid', age: '2 h' },
  { id: 'SUP-1037', central: 'Movilidad Norte CDMX', subject: 'Consulta sobre reporte de carreras', region: 'México Centro', owner: 'Paola Hernández', priority: 'low', status: 'paid', age: '4 h' },
];

export const NetworkSupportModule: React.FC = () => {
  const [query, setQuery] = useState('');
  const filtered = tickets.filter((ticket) => [ticket.central, ticket.subject, ticket.owner, ticket.id].join(' ').toLowerCase().includes(query.toLowerCase()));
  return (
    <div className="space-y-6">
      <div><div className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-blue-300 mb-2"><Headphones className="w-3.5 h-3.5" />Atención distribuida</div><h1 className="text-2xl md:text-3xl font-black text-white tracking-tight">Soporte regional</h1><p className="text-xs text-zinc-400 mt-1">Tickets asignados al partner responsable sin perder supervisión global.</p></div>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4"><NetworkKpi label="Tickets abiertos" value="7" detail="2 de prioridad alta" icon={AlertCircle} accent="amber" /><NetworkKpi label="Tiempo de respuesta" value="18 min" detail="Promedio de la red hoy" icon={Clock3} accent="blue" /><NetworkKpi label="Resueltos esta semana" value="43" detail="94% dentro del objetivo" icon={CheckCircle2} accent="emerald" /><NetworkKpi label="Partners de soporte" value="6" detail="Uno por mercado activo" icon={UserRoundCheck} accent="purple" /></div>
      <div className="grid xl:grid-cols-[1.3fr_.7fr] gap-5">
        <section className="bg-[#0d0d0f] border border-zinc-800 rounded-2xl shadow-xl overflow-hidden">
          <div className="p-4 border-b border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3"><div><h2 className="font-extrabold text-white">Bandeja regional</h2><p className="text-[10px] text-zinc-500 mt-1">Incidencias simuladas de centrales activas.</p></div><label className="relative min-w-[260px]"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600" /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar ticket..." className="w-full pl-9 pr-3 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white outline-none" /></label></div>
          <div className="divide-y divide-zinc-900">{filtered.map((ticket) => <div key={ticket.id} className="p-4 hover:bg-zinc-900/35 transition flex flex-col lg:flex-row lg:items-center justify-between gap-4"><div className="flex items-start gap-3"><div className={`p-2 rounded-xl border ${ticket.priority === 'high' ? 'bg-red-500/10 border-red-500/25 text-red-300' : 'bg-blue-500/10 border-blue-500/20 text-blue-300'}`}><MessageCircle className="w-4 h-4" /></div><div><p className="text-xs font-black text-white">{ticket.subject}</p><p className="text-[10px] text-zinc-500 mt-1">{ticket.id} · {ticket.central} · hace {ticket.age}</p><p className="text-[9px] text-zinc-600 mt-1">Responsable: {ticket.owner} ({ticket.region})</p></div></div><div className="flex items-center gap-2"><StatusPill status={ticket.status} label={ticket.status === 'pending' ? 'Sin responder' : ticket.status === 'available' ? 'En proceso' : 'Resuelto'} /><button className="px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-[10px] font-black text-zinc-300">Abrir</button></div></div>)}</div>
        </section>
        <div className="space-y-5">
          <section className="bg-[#0d0d0f] border border-zinc-800 rounded-2xl p-5"><div className="flex items-center gap-3"><div className="p-2 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-300"><ShieldCheck className="w-5 h-5" /></div><div><h2 className="text-sm font-black text-white">Modelo de escalamiento</h2><p className="text-[10px] text-zinc-500">Quién responde cada caso.</p></div></div><div className="space-y-3 mt-5">{[['Nivel 1', 'Partner comercial', 'Capacitación y uso básico'], ['Nivel 2', 'Responsable regional', 'Configuración y operación'], ['Nivel 3', 'Central GO Global', 'Errores técnicos y facturación']].map(([level, owner, detail]) => <div key={level} className="p-3 rounded-xl bg-zinc-950 border border-zinc-800"><div className="flex justify-between"><span className="text-[9px] font-black uppercase text-blue-300">{level}</span><span className="text-[9px] text-zinc-600">{owner}</span></div><p className="text-[10px] text-zinc-300 mt-1.5">{detail}</p></div>)}</div></section>
          <section className="bg-gradient-to-br from-emerald-500/10 to-blue-500/5 border border-emerald-500/20 rounded-2xl p-5"><Building2 className="w-5 h-5 text-emerald-300" /><p className="text-sm font-black text-white mt-3">Salud de cartera</p><p className="text-[10px] text-zinc-500 mt-1">35 de 38 centrales no tienen incidencias críticas.</p><div className="mt-4 flex items-center gap-2 text-xs font-black text-emerald-300"><CheckCircle2 className="w-4 h-4" />92% operación saludable</div></section>
        </div>
      </div>
    </div>
  );
};

import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { TRIP_STATUS_LABELS } from '../../lib/labels';
import { Trip, TripStatus } from '../../types';
import {
  Route,
  Search,
  Filter,
  Plus,
  Zap,
  MapPin,
  Clock,
  CheckCircle,
  XCircle,
  Phone,
  User,
  DollarSign,
  ChevronRight,
  Printer,
} from 'lucide-react';

export const TripsModule: React.FC = () => {
  const {
    trips,
    drivers,
    setNewTripModalOpen,
    setSelectedTripForDetail,
    autoAssignClosestDriver,
    cancelTrip,
  } = useApp();

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const filteredTrips = trips.filter((t) => {
    const matchesSearch =
      t.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.clientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.origin.address.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (t.driverUnitNumber && t.driverUnitNumber.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesStatus = statusFilter === 'all' || t.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-extrabold text-2xl text-white tracking-tight flex items-center gap-2 uppercase font-sans">
            <Route className="w-6 h-6 text-blue-500" />
            Gestión de Despachos y Viajes
          </h1>
          <p className="text-xs text-zinc-400 mt-1 font-sans">
            Control en tiempo real de servicios, reasignaciones y cobros
          </p>
        </div>

        <button
          onClick={() => setNewTripModalOpen(true)}
          className="px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs rounded-xl shadow-lg shadow-amber-500/20 transition flex items-center gap-2 border border-amber-300 uppercase tracking-wider transform active:scale-95"
        >
          <Zap className="w-4 h-4 fill-slate-950" />
          <span>+ NUEVA CARRERA</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-[#0d0d0f] p-4 rounded-xl border border-zinc-800 flex flex-col md:flex-row gap-3 items-center justify-between shadow-lg">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-3" />
          <input
            type="text"
            placeholder="Buscar por código, cliente, dirección o móvil..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-[#121215] border border-zinc-800 rounded-lg pl-9 pr-4 py-2 text-xs text-zinc-200 focus:outline-none focus:border-blue-500 transition"
          />
        </div>

        <div className="flex flex-wrap gap-2 w-full md:w-auto">
          {[
            { id: 'all', label: 'Todos' },
            { id: 'pending', label: 'Pendientes' },
            { id: 'assigned', label: 'Asignados' },
            { id: 'en_route', label: 'En Camino' },
            { id: 'in_progress', label: 'En Viaje' },
            { id: 'completed', label: 'Completados' },
            { id: 'cancelled', label: 'Cancelados' },
          ].map((f) => (
            <button
              key={f.id}
              onClick={() => setStatusFilter(f.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition uppercase tracking-wider ${
                statusFilter === f.id
                  ? 'bg-blue-600 text-white font-bold shadow'
                  : 'bg-[#121215] text-zinc-400 hover:bg-zinc-800'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Trips Table */}
      <div className="bg-[#0d0d0f] border border-zinc-800 rounded-xl overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-zinc-300">
            <thead className="bg-[#121215] text-zinc-400 uppercase font-mono text-[10px] border-b border-zinc-800">
              <tr>
                <th className="p-4">Código</th>
                <th className="p-4">Cliente</th>
                <th className="p-4">Origen / Destino</th>
                <th className="p-4">Móvil Asignado</th>
                <th className="p-4">Tarifa Est.</th>
                <th className="p-4">Estado</th>
                <th className="p-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/80 font-sans">
              {filteredTrips.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-zinc-500 font-mono text-xs">
                    No se encontraron viajes con el filtro aplicado.
                  </td>
                </tr>
              ) : (
                filteredTrips.map((trip) => (
                  <tr
                    key={trip.id}
                    onClick={() => setSelectedTripForDetail(trip)}
                    className="hover:bg-zinc-800/50 transition cursor-pointer"
                  >
                    <td className="p-4 font-mono font-bold text-blue-400">{trip.code}</td>
                    <td className="p-4">
                      <div className="font-bold text-zinc-100">{trip.clientName}</div>
                      <div className="text-[11px] text-zinc-400 font-mono">{trip.clientPhone}</div>
                    </td>
                    <td className="p-4 max-w-xs">
                      <div className="text-zinc-200 truncate font-medium">📍 {trip.origin.address}</div>
                      <div className="text-zinc-400 truncate text-[11px] mt-0.5">🏁 {trip.destination.address}</div>
                    </td>
                    <td className="p-4">
                      {trip.driverUnitNumber ? (
                        <span className="font-mono font-bold text-blue-300 bg-blue-500/10 px-2.5 py-1 rounded-lg border border-blue-500/20">
                          {trip.driverUnitNumber} ({trip.driverName?.split(' ')[0]})
                        </span>
                      ) : (
                        <span className="text-zinc-500 font-mono italic">Sin Asignar</span>
                      )}
                    </td>
                    <td className="p-4 font-mono font-bold text-zinc-100">
                      <div>${trip.estimatedFare.toLocaleString()}</div>
                      {trip.isFixedFare && (
                        <div className="text-[9px] text-amber-400 uppercase font-extrabold flex items-center gap-0.5 mt-0.5">
                          📌 Tarifa Fija
                        </div>
                      )}
                    </td>
                    <td className="p-4">
                      <span
                        className={`px-2.5 py-1 rounded text-[10px] font-bold font-mono uppercase tracking-wider ${
                          trip.status === 'pending'
                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30 animate-pulse'
                            : trip.status === 'completed'
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                            : trip.status === 'cancelled'
                            ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                            : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                        }`}
                      >
                        {TRIP_STATUS_LABELS[trip.status]}
                      </span>
                    </td>
                    <td className="p-4 text-right space-x-2">
                      {trip.status === 'pending' && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            autoAssignClosestDriver(trip.id);
                          }}
                          className="px-2.5 py-1.5 bg-blue-600 text-white font-bold text-xs rounded-lg shadow hover:bg-blue-500 transition uppercase tracking-wider"
                        >
                          Auto-Asignar
                        </button>
                      )}
                      {trip.status !== 'completed' && trip.status !== 'cancelled' && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (window.confirm(`¿Cancelar la carrera ${trip.code}?`)) {
                              cancelTrip(trip.id, 'Cancelado por operadora');
                            }
                          }}
                          className="px-2.5 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 font-bold text-xs rounded-lg border border-rose-500/30 transition uppercase tracking-wider"
                        >
                          Cancelar
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

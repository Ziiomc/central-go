import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { X, MapPin, User, Phone, DollarSign, Printer, Zap, Route } from 'lucide-react';

export const TripDetailModal: React.FC = () => {
  const { selectedTripForDetail, setSelectedTripForDetail, drivers, reassignTrip, cancelTrip } = useApp();
  const [newDriverId, setNewDriverId] = useState('');

  if (!selectedTripForDetail) return null;

  const trip = selectedTripForDetail;
  const availableDrivers = drivers.filter((d) => d.status === 'available');

  const handleReassign = () => {
    if (newDriverId) {
      reassignTrip(trip.id, newDriverId);
      setSelectedTripForDetail(null);
    }
  };

  return (
    <div className="fixed inset-0 bg-zinc-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
      <div className="bg-[#0d0d0f] border border-zinc-800 rounded-xl max-w-lg w-full p-6 space-y-5 shadow-2xl relative">
        <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
          <div>
            <span className="text-xs font-mono font-bold text-blue-400 uppercase tracking-wider">
              DESPACHO #{trip.code}
            </span>
            <h2 className="font-extrabold text-lg text-white uppercase tracking-tight">Detalle de Servicio</h2>
          </div>
          <button
            onClick={() => setSelectedTripForDetail(null)}
            className="p-2 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Client & Driver Info */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-[#121215] p-3 rounded-lg border border-zinc-800 space-y-1 text-xs">
            <span className="text-[10px] text-zinc-400 font-mono uppercase tracking-wider">Pasajero</span>
            <div className="font-bold text-white">{trip.clientName}</div>
            <div className="text-[11px] text-zinc-400 font-mono">{trip.clientPhone}</div>
          </div>

          <div className="bg-[#121215] p-3 rounded-lg border border-zinc-800 space-y-1 text-xs">
            <span className="text-[10px] text-zinc-400 font-mono uppercase tracking-wider">Móvil Asignado</span>
            <div className="font-bold text-emerald-400">{trip.driverUnitNumber || 'Sin Asignar'}</div>
            <div className="text-[11px] text-zinc-400">{trip.driverName || '-'}</div>
          </div>
        </div>

        {/* Addresses */}
        <div className="bg-[#121215] p-3.5 rounded-lg border border-zinc-800 space-y-2 text-xs">
          <div className="flex items-start gap-2">
            <MapPin className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <span className="text-[10px] text-zinc-400 font-mono uppercase tracking-wider">Origen:</span>
              <div className="font-semibold text-zinc-100">{trip.origin.address}</div>
            </div>
          </div>

          <div className="flex items-start gap-2">
            <MapPin className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <div>
              <span className="text-[10px] text-zinc-400 font-mono uppercase tracking-wider">Destino:</span>
              <div className="font-semibold text-zinc-100">{trip.destination.address}</div>
            </div>
          </div>
        </div>

        {/* Fare & Payment */}
        <div className="flex items-center justify-between bg-[#121215] p-3.5 rounded-lg border border-zinc-800 font-mono text-xs">
          <div>
            <span className="text-zinc-400 uppercase text-[10px] block tracking-wider">Forma de Pago</span>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="font-bold text-white uppercase">{trip.paymentMethod}</span>
              {trip.isFixedFare && (
                <span className="text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/40 px-2 py-0.5 rounded font-mono font-extrabold flex items-center gap-1">
                  📌 Tarifa Fija
                </span>
              )}
            </div>
          </div>
          <div className="text-right">
            <span className="text-zinc-400 uppercase text-[10px] block tracking-wider">
              {trip.isFixedFare ? 'Monto Acordado' : 'Tarifa Final'}
            </span>
            <span className="font-extrabold text-amber-400 text-lg">${trip.estimatedFare.toLocaleString()}</span>
          </div>
        </div>

        {/* Reassignment */}
        {trip.status !== 'completed' && trip.status !== 'cancelled' && (
          <div className="space-y-2 pt-2 border-t border-zinc-800">
            <label className="text-xs font-mono text-blue-400 font-bold uppercase tracking-wider">Reasignar a otro Móvil:</label>
            <div className="flex gap-2">
              <select
                value={newDriverId}
                onChange={(e) => setNewDriverId(e.target.value)}
                className="w-full bg-[#121215] border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-200"
              >
                <option value="">-- Seleccionar Conductor --</option>
                {availableDrivers.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.unitNumber} - {d.name}
                  </option>
                ))}
              </select>
              <button
                onClick={handleReassign}
                disabled={!newDriverId}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold text-xs rounded-lg transition shrink-0 uppercase tracking-wider"
              >
                Reasignar
              </button>
            </div>
          </div>
        )}

        <div className="flex justify-between items-center pt-2">
          <button
            onClick={() => window.print()}
            className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-bold rounded-lg flex items-center gap-2 transition uppercase tracking-wider"
          >
            <Printer className="w-4 h-4" /> Imprimir Voucher
          </button>

          <button
            onClick={() => setSelectedTripForDetail(null)}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-lg uppercase tracking-wider"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};

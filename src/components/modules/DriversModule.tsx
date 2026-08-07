import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Driver } from '../../types';
import {
  Users,
  Search,
  Plus,
  Phone,
  Car,
  Star,
  ShieldCheck,
  Award,
  DollarSign,
  AlertTriangle,
  UserCheck,
  RadioTower,
} from 'lucide-react';

export const DriversModule: React.FC = () => {
  const { drivers, vehicles, addDriver, toggleDriverAvailability, setVHFModalDriver } = useApp();
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // New Driver Form State
  const [unitNumber, setUnitNumber] = useState('Móvil ');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [licenseNumber, setLicenseNumber] = useState('');
  const [selectedVehicleId, setSelectedVehicleId] = useState('');

  const filteredDrivers = drivers.filter(
    (d) =>
      d.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      d.unitNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      d.phone.includes(searchTerm)
  );

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    addDriver({
      userId: `usr-${Date.now()}`,
      companyId: 'comp-1',
      vehicleId: selectedVehicleId || undefined,
      unitNumber: unitNumber || 'Móvil 99',
      name,
      phone,
      licenseNumber,
      licenseExpiry: '2028-01-01',
      photoUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
      status: 'available',
      currentLocation: {
        lat: -35.8454,
        lng: -71.5979,
        address: 'Plaza de Armas, Linares',
        lastUpdated: new Date().toISOString(),
      },
      commissionBalance: 0,
      sosActive: false,
    });
    setIsAddModalOpen(false);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-extrabold text-2xl text-white tracking-tight flex items-center gap-2 uppercase font-sans">
            <Users className="w-6 h-6 text-blue-500" />
            Gestión de Conductores y Móviles
          </h1>
          <p className="text-xs text-zinc-400 mt-1 font-sans">
            Padrón oficial, licencias, estado en frecuencia y liquidación de comisiones
          </p>
        </div>

        <button
          onClick={() => setIsAddModalOpen(true)}
          className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-xs rounded-lg shadow-lg shadow-blue-900/30 transition flex items-center gap-2 border border-blue-400/20 uppercase tracking-wider"
        >
          <Plus className="w-4 h-4" />
          <span>Registrar Nuevo Conductor</span>
        </button>
      </div>

      {/* Search */}
      <div className="bg-[#0d0d0f] p-4 rounded-xl border border-zinc-800 shadow-lg">
        <div className="relative w-full md:w-96">
          <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-3" />
          <input
            type="text"
            placeholder="Buscar conductor por nombre, móvil o teléfono..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-[#121215] border border-zinc-800 rounded-lg pl-9 pr-4 py-2 text-xs text-zinc-200 focus:outline-none focus:border-blue-500 transition"
          />
        </div>
      </div>

      {/* Drivers Roster Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredDrivers.map((driver) => {
          const vehicle = vehicles.find((v) => v.id === driver.vehicleId);
          return (
            <div
              key={driver.id}
              className="bg-[#0d0d0f] border border-zinc-800 rounded-xl p-5 space-y-4 shadow-xl hover:border-blue-500/30 transition relative overflow-hidden"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <img
                    src={driver.photoUrl}
                    alt={driver.name}
                    className="w-12 h-12 rounded-lg object-cover border-2 border-blue-500/50 shadow-md"
                  />
                  <div>
                    <div className="font-extrabold text-base text-white flex items-center gap-2 font-mono">
                      <span>{driver.unitNumber}</span>
                      <span className="text-xs text-blue-400 font-mono">★ {driver.rating.toFixed(2)}</span>
                    </div>
                    <div className="text-xs text-zinc-300 font-semibold">{driver.name}</div>
                    <div className="text-[11px] text-zinc-400 font-mono mt-0.5">{driver.phone}</div>
                  </div>
                </div>

                <span
                  className={`px-2.5 py-1 rounded text-[10px] font-bold font-mono uppercase tracking-wider ${
                    driver.status === 'available'
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      : driver.status === 'en_route' || driver.status === 'in_trip'
                      ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                      : 'bg-zinc-800 text-zinc-400 border border-zinc-700'
                  }`}
                >
                  {driver.status}
                </span>
              </div>

              {/* Vehicle Assignment */}
              <div className="bg-[#121215] p-3 rounded-lg border border-zinc-800 space-y-1 text-xs">
                <div className="text-[10px] text-zinc-400 font-mono uppercase tracking-wider flex items-center gap-1">
                  <Car className="w-3 h-3 text-blue-400" />
                  <span>Vehículo Asignado</span>
                </div>
                {vehicle ? (
                  <div className="font-bold text-zinc-200">
                    {vehicle.brand} {vehicle.model} ({vehicle.licensePlate})
                  </div>
                ) : (
                  <div className="text-zinc-500 italic">Sin vehículo asignado</div>
                )}
              </div>

              {/* Driver Stats */}
              <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                <div className="bg-[#121215] p-2.5 rounded-lg border border-zinc-800">
                  <span className="text-[10px] text-zinc-400 uppercase tracking-wider block">Viajes Totales</span>
                  <span className="font-bold text-white text-sm">{driver.totalTripsCompleted}</span>
                </div>
                <div className="bg-[#121215] p-2.5 rounded-lg border border-zinc-800">
                  <span className="text-[10px] text-zinc-400 uppercase tracking-wider block">Recaudado Hoy</span>
                  <span className="font-bold text-emerald-400 text-sm">${driver.todayEarnings.toLocaleString()}</span>
                </div>
              </div>

              {/* Quick Availability Actions & VHF Radio */}
              <div className="pt-2 border-t border-zinc-800 flex gap-2">
                <button
                  onClick={() => toggleDriverAvailability(driver.id, 'available')}
                  className="flex-1 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 font-bold text-xs rounded-lg border border-emerald-500/30 transition uppercase tracking-wider"
                >
                  Libre
                </button>
                <button
                  onClick={() => toggleDriverAvailability(driver.id, 'paused')}
                  className="flex-1 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 font-bold text-xs rounded-lg border border-amber-500/30 transition uppercase tracking-wider"
                >
                  Pausa
                </button>
                <button
                  onClick={() => setVHFModalDriver(driver)}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-lg shadow-md transition uppercase tracking-wider flex items-center gap-1 shrink-0"
                  title="Enviar transmisión por radio VHF a este móvil"
                >
                  <RadioTower className="w-3.5 h-3.5" />
                  <span>VHF</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add Driver Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-zinc-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-[#0d0d0f] border border-zinc-800 rounded-xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <h3 className="font-bold text-lg text-white uppercase tracking-tight">Registrar Nuevo Conductor</h3>
            <form onSubmit={handleAddSubmit} className="space-y-3">
              <div>
                <label className="text-xs text-zinc-300 font-mono uppercase tracking-wider block">Número de Móvil</label>
                <input
                  type="text"
                  value={unitNumber}
                  onChange={(e) => setUnitNumber(e.target.value)}
                  placeholder="Móvil 25"
                  required
                  className="w-full bg-[#121215] border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-200 mt-1 focus:outline-none focus:border-blue-500 transition"
                />
              </div>

              <div>
                <label className="text-xs text-zinc-300 font-mono uppercase tracking-wider block">Nombre Completo</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ej: Osvaldo Rodríguez"
                  required
                  className="w-full bg-[#121215] border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-200 mt-1 focus:outline-none focus:border-blue-500 transition"
                />
              </div>

              <div>
                <label className="text-xs text-zinc-300 font-mono uppercase tracking-wider block">Teléfono Móvil</label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+56 9 8712 3456"
                  required
                  className="w-full bg-[#121215] border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-200 mt-1 focus:outline-none focus:border-blue-500 transition"
                />
              </div>

              <div>
                <label className="text-xs text-zinc-300 font-mono uppercase tracking-wider block">Licencia de Conducir</label>
                <input
                  type="text"
                  value={licenseNumber}
                  onChange={(e) => setLicenseNumber(e.target.value)}
                  placeholder="LIC-MAULE-90123"
                  required
                  className="w-full bg-[#121215] border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-200 mt-1 focus:outline-none focus:border-blue-500 transition"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="w-1/2 py-2 bg-zinc-800 text-zinc-300 font-bold text-xs rounded-lg uppercase tracking-wider"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="w-1/2 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-lg shadow uppercase tracking-wider"
                >
                  Guardar Conductor
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Vehicle } from '../../types';
import {
  Car,
  Search,
  Plus,
  ShieldAlert,
  CheckCircle,
  Wrench,
  Dog,
  Accessibility,
  Wind,
  Calendar,
} from 'lucide-react';

export const VehiclesModule: React.FC = () => {
  const { vehicles, addVehicle } = useApp();
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);

  const [unitNumber, setUnitNumber] = useState('Móvil ');
  const [licensePlate, setLicensePlate] = useState('');
  const [brand, setBrand] = useState('Toyota');
  const [model, setModel] = useState('Corolla');
  const [year, setYear] = useState(2023);
  const [color, setColor] = useState('Negro');
  const [petFriendly, setPetFriendly] = useState(false);
  const [wheelchairAccessible, setWheelchairAccessible] = useState(false);

  const filteredVehicles = vehicles.filter(
    (v) =>
      v.unitNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      v.licensePlate.toLowerCase().includes(searchTerm.toLowerCase()) ||
      v.brand.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    addVehicle({
      companyId: 'comp-1',
      unitNumber,
      licensePlate,
      brand,
      model,
      year,
      color,
      capacity: 4,
      petFriendly,
      wheelchairAccessible,
      airConditioning: true,
      technicalInspectionExpiry: '2027-12-31',
      status: 'active',
    });
    setIsModalOpen(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-extrabold text-2xl text-white tracking-tight flex items-center gap-2 uppercase font-sans">
            <Car className="w-6 h-6 text-blue-500" />
            Flota de Vehículos
          </h1>
          <p className="text-xs text-zinc-400 mt-1 font-sans">
            Inventario, características técnicas, VTO e inspecciones de seguridad
          </p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-xs rounded-lg shadow-lg shadow-blue-900/30 transition flex items-center gap-2 border border-blue-400/20 uppercase tracking-wider"
        >
          <Plus className="w-4 h-4" />
          <span>Registrar Vehículo</span>
        </button>
      </div>

      <div className="bg-[#0d0d0f] p-4 rounded-xl border border-zinc-800 shadow-lg">
        <div className="relative w-full md:w-96">
          <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-3" />
          <input
            type="text"
            placeholder="Buscar por móvil, patente o marca..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-[#121215] border border-zinc-800 rounded-lg pl-9 pr-4 py-2 text-xs text-zinc-200 focus:outline-none focus:border-blue-500 transition"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredVehicles.map((vehicle) => (
          <div
            key={vehicle.id}
            className="bg-[#0d0d0f] border border-zinc-800 rounded-xl p-5 space-y-4 shadow-xl hover:border-blue-500/30 transition"
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="font-extrabold text-lg text-white font-mono">{vehicle.unitNumber}</div>
                <div className="font-mono text-blue-400 text-xs font-bold">{vehicle.licensePlate}</div>
              </div>
              <span className="px-2.5 py-1 rounded text-[10px] font-bold font-mono bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 uppercase tracking-wider">
                {vehicle.status}
              </span>
            </div>

            <div className="bg-[#121215] p-3 rounded-lg border border-zinc-800 text-xs text-zinc-300 space-y-1 font-sans">
              <div className="font-bold text-white">
                {vehicle.brand} {vehicle.model} ({vehicle.year})
              </div>
              <div className="text-zinc-400">Color: {vehicle.color} • Capacidad: {vehicle.capacity} pasajeros</div>
            </div>

            {/* Badges for features */}
            <div className="flex flex-wrap gap-1.5 text-[11px] font-mono">
              {vehicle.petFriendly && (
                <span className="px-2 py-0.5 rounded bg-purple-500/10 text-purple-300 border border-purple-500/20 flex items-center gap-1">
                  <Dog className="w-3 h-3" /> Mascotas
                </span>
              )}
              {vehicle.wheelchairAccessible && (
                <span className="px-2 py-0.5 rounded bg-blue-500/10 text-blue-300 border border-blue-500/20 flex items-center gap-1">
                  <Accessibility className="w-3 h-3" /> Silla de Ruedas
                </span>
              )}
              {vehicle.airConditioning && (
                <span className="px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-300 border border-cyan-500/20 flex items-center gap-1">
                  <Wind className="w-3 h-3" /> Aire Acond.
                </span>
              )}
            </div>

            <div className="text-[11px] font-mono text-zinc-400 flex items-center justify-between pt-2 border-t border-zinc-800">
              <span className="uppercase tracking-wider">Vencimiento VTO:</span>
              <span className="font-bold text-zinc-200">{vehicle.technicalInspectionExpiry}</span>
            </div>
          </div>
        ))}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-zinc-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-[#0d0d0f] border border-zinc-800 rounded-xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <h3 className="font-bold text-lg text-white uppercase tracking-tight">Registrar Vehículo en Flota</h3>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="text-xs text-zinc-300 font-mono uppercase tracking-wider block">Número de Móvil</label>
                <input
                  type="text"
                  value={unitNumber}
                  onChange={(e) => setUnitNumber(e.target.value)}
                  placeholder="Móvil 15"
                  required
                  className="w-full bg-[#121215] border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-200 mt-1 focus:outline-none focus:border-blue-500 transition"
                />
              </div>

              <div>
                <label className="text-xs text-zinc-300 font-mono uppercase tracking-wider block">Patente / Placa</label>
                <input
                  type="text"
                  value={licensePlate}
                  onChange={(e) => setLicensePlate(e.target.value)}
                  placeholder="AF 123 CD"
                  required
                  className="w-full bg-[#121215] border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-200 mt-1 focus:outline-none focus:border-blue-500 transition"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-zinc-300 font-mono uppercase tracking-wider block">Marca</label>
                  <input
                    type="text"
                    value={brand}
                    onChange={(e) => setBrand(e.target.value)}
                    required
                    className="w-full bg-[#121215] border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-200 mt-1 focus:outline-none focus:border-blue-500 transition"
                  />
                </div>
                <div>
                  <label className="text-xs text-zinc-300 font-mono uppercase tracking-wider block">Modelo</label>
                  <input
                    type="text"
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    required
                    className="w-full bg-[#121215] border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-200 mt-1 focus:outline-none focus:border-blue-500 transition"
                  />
                </div>
              </div>

              <div className="flex gap-4 pt-2 text-xs text-zinc-300 font-mono">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={petFriendly}
                    onChange={(e) => setPetFriendly(e.target.checked)}
                    className="rounded bg-[#121215] border-zinc-800 text-blue-600 focus:ring-0"
                  />
                  <span>Apto Mascotas</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={wheelchairAccessible}
                    onChange={(e) => setWheelchairAccessible(e.target.checked)}
                    className="rounded bg-[#121215] border-zinc-800 text-blue-600 focus:ring-0"
                  />
                  <span>Silla de Ruedas</span>
                </label>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="w-1/2 py-2 bg-zinc-800 text-zinc-300 font-bold text-xs rounded-lg uppercase tracking-wider"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="w-1/2 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-lg shadow uppercase tracking-wider"
                >
                  Guardar Vehículo
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

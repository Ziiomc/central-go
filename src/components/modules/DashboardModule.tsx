import React from 'react';
import { useApp } from '../../context/AppContext';
import { LiveMap } from '../map/LiveMap';
import {
  Route,
  Car,
  Clock,
  DollarSign,
  Radio,
  RadioTower,
  Plus,
  CheckCircle2,
  AlertTriangle,
  Users,
  ChevronRight,
  Zap,
  ShieldAlert,
  Phone,
  MapPin,
  ExternalLink,
} from 'lucide-react';

export const DashboardModule: React.FC = () => {
  const {
    currentRole,
    trips,
    drivers,
    setNewTripModalOpen,
    setSelectedTripForDetail,
    autoAssignClosestDriver,
    setActiveModule,
    triggerDriverSOS,
    resolveDriverSOS,
    activeSOSDriver,
    setActiveSOSDriver,
  } = useApp();

  const activeTrips = trips.filter((t) =>
    ['pending', 'assigned', 'en_route', 'arrived', 'in_progress'].includes(t.status)
  );

  const availableDrivers = drivers.filter((d) => d.status === 'available');
  const enRouteDrivers = drivers.filter((d) => d.status === 'en_route' || d.status === 'in_trip');

  const totalTripsToday = trips.length;
  const completedTrips = trips.filter((t) => t.status === 'completed').length;
  const totalEarningsToday = trips
    .filter((t) => t.status === 'completed')
    .reduce((acc, t) => acc + (t.finalFare || t.estimatedFare), 0);

  return (
    <div className="space-y-6">
      {/* ACTIVE SOS DRIVER EMERGENCY OPERATOR BANNER */}
      {activeSOSDriver && (
        <div className="bg-red-950/90 border-2 border-red-600 rounded-2xl p-4 shadow-[0_0_40px_rgba(239,68,68,0.5)] flex flex-col md:flex-row items-center justify-between gap-4 animate-pulse">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-red-600 text-white flex items-center justify-center font-black shadow-lg animate-bounce shrink-0">
              <ShieldAlert className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="bg-red-600 text-white text-[10px] font-extrabold px-2 py-0.5 rounded font-mono uppercase tracking-wider">
                  🚨 ALERTA SOS EN DIRECTO
                </span>
                <span className="text-xs text-red-300 font-mono font-bold">
                  VHF: 148.525 MHz
                </span>
              </div>
              <h2 className="font-extrabold text-white text-base mt-0.5">
                {activeSOSDriver.unitNumber} - {activeSOSDriver.name} enviando SEÑAL DE AUXILIO
              </h2>
              <div className="text-xs text-red-200 font-mono flex items-center gap-1 mt-0.5">
                <MapPin className="w-3.5 h-3.5 text-red-400 shrink-0" />
                <span>{activeSOSDriver.currentLocation.address || 'Ubicación GPS'}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto shrink-0">
            <button
              onClick={() => setActiveSOSDriver(activeSOSDriver)}
              className="px-4 py-2.5 bg-red-600 hover:bg-red-500 text-white font-extrabold text-xs rounded-xl shadow-lg transition uppercase tracking-wider flex items-center justify-center gap-1.5"
            >
              <ShieldAlert className="w-4 h-4" />
              <span>Ver Pantalla Completa</span>
            </button>
            <a
              href={`tel:${activeSOSDriver.phone}`}
              className="px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl shadow transition uppercase tracking-wider flex items-center justify-center gap-1.5"
            >
              <Phone className="w-4 h-4" />
              <span>Llamar Chofer</span>
            </a>
            <button
              onClick={() => resolveDriverSOS(activeSOSDriver.id)}
              className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs rounded-xl transition uppercase tracking-wider"
            >
              Marcar Resuelto
            </button>
          </div>
        </div>
      )}

      {/* Quick Operator Dispatch Launcher Banner */}
      <div className="bg-[#0d0d0f] p-4 rounded-2xl border border-amber-500/40 bg-gradient-to-r from-amber-500/10 via-zinc-900 to-[#0d0d0f] shadow-2xl flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center font-black shadow-lg shadow-amber-500/20 shrink-0">
            <Zap className="w-6 h-6" />
          </div>
          <div>
            <h2 className="font-black text-white text-base uppercase tracking-tight font-sans flex items-center gap-2">
              <span>Despacho Rápido de Carrera</span>
              <span className="text-[10px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded font-mono font-bold">
                {availableDrivers.length} Móviles Libres
              </span>
            </h2>
            <p className="text-xs text-zinc-400 font-sans">
              Interfaz optimizada para la operadora: ingresa dirección, asigna móvil en 1 click y despacha al instante.
            </p>
          </div>
        </div>

        <button
          onClick={() => setNewTripModalOpen(true)}
          className="w-full sm:w-auto px-6 py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs rounded-xl shadow-xl shadow-amber-500/20 transition uppercase tracking-wider flex items-center justify-center gap-2 border border-amber-300 transform active:scale-95 shrink-0"
        >
          <Plus className="w-4 h-4 stroke-[3]" />
          <span>+ NUEVA CARRERA (EXPRÉS)</span>
        </button>
      </div>

      {/* Top Banner KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Active Dispatches */}
        <div className="bg-[#0d0d0f] border border-zinc-800 rounded-xl p-4 shadow-xl flex items-center justify-between">
          <div>
            <div className="text-xs text-zinc-400 font-mono font-medium uppercase tracking-wider">Viajes Activos</div>
            <div className="text-2xl font-extrabold text-white mt-1 font-mono">{activeTrips.length}</div>
            <div className="text-[10px] text-blue-400 font-medium mt-1 flex items-center gap-1">
              <Zap className="w-3 h-3" />
              <span>{trips.filter((t) => t.status === 'pending').length} pendientes de asignación</span>
            </div>
          </div>
          <div className="w-11 h-11 rounded-lg bg-blue-600/10 border border-blue-500/20 text-blue-400 flex items-center justify-center">
            <Route className="w-5 h-5" />
          </div>
        </div>

        {/* KPI 2: Available Fleet */}
        <div className="bg-[#0d0d0f] border border-zinc-800 rounded-xl p-4 shadow-xl flex items-center justify-between">
          <div>
            <div className="text-xs text-zinc-400 font-mono font-medium uppercase tracking-wider">Flota Libre</div>
            <div className="text-2xl font-extrabold text-emerald-400 mt-1 font-mono">
              {availableDrivers.length} <span className="text-xs text-zinc-500 font-normal">/ {drivers.length}</span>
            </div>
            <div className="text-[10px] text-emerald-400 font-medium mt-1">
              {enRouteDrivers.length} móviles actualmente en viaje
            </div>
          </div>
          <div className="w-11 h-11 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center">
            <Car className="w-5 h-5" />
          </div>
        </div>

        {/* KPI 3: Avg Response Speed */}
        <div className="bg-[#0d0d0f] border border-zinc-800 rounded-xl p-4 shadow-xl flex items-center justify-between">
          <div>
            <div className="text-xs text-zinc-400 font-mono font-medium uppercase tracking-wider">Tiempo Asignación</div>
            <div className="text-2xl font-extrabold text-blue-400 mt-1 font-mono">18 seg</div>
            <div className="text-[10px] text-emerald-400 font-medium mt-1">
              ↓ 92% más rápido que Radio VHF
            </div>
          </div>
          <div className="w-11 h-11 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center">
            <Clock className="w-5 h-5" />
          </div>
        </div>

        {/* KPI 4: Financial Revenue (Admin) or VHF Frequency Status (Operator) */}
        {currentRole === 'operator' ? (
          <div className="bg-[#0d0d0f] border border-amber-500/30 rounded-xl p-4 shadow-xl flex items-center justify-between">
            <div>
              <div className="text-xs text-amber-400 font-mono font-medium uppercase tracking-wider">Estado Central Radio</div>
              <div className="text-xl font-extrabold text-white mt-1 font-mono">148.525 MHz</div>
              <div className="text-[10px] text-emerald-400 font-medium mt-1">
                Frecuencia Operativa Linares
              </div>
            </div>
            <div className="w-11 h-11 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-400 flex items-center justify-center">
              <RadioTower className="w-5 h-5 animate-pulse" />
            </div>
          </div>
        ) : (
          <div className="bg-[#0d0d0f] border border-zinc-800 rounded-xl p-4 shadow-xl flex items-center justify-between">
            <div>
              <div className="text-xs text-zinc-400 font-mono font-medium uppercase tracking-wider">Recaudación Turno</div>
              <div className="text-2xl font-extrabold text-zinc-100 mt-1 font-mono">
                ${totalEarningsToday.toLocaleString()}
              </div>
              <div className="text-[10px] text-zinc-400 font-medium mt-1">
                {completedTrips} viajes completados
              </div>
            </div>
            <div className="w-11 h-11 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
        )}
      </div>

      {/* Main Grid: Live Map + Active Dispatches Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Live Map (2 cols) */}
        <div className="lg:col-span-2 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <RadioTower className="w-5 h-5 text-blue-400" />
              <h2 className="font-extrabold text-base text-white uppercase tracking-tight">Monitoreo GPS en Vivo</h2>
            </div>
            <button
              onClick={() => setActiveModule('live_map')}
              className="text-xs text-blue-400 font-semibold hover:underline flex items-center gap-1 uppercase tracking-wider"
            >
              Ver Mapa Completo <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <LiveMap height="h-[420px]" />
        </div>

        {/* Active Dispatches Feed (1 col) */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-extrabold text-base text-white flex items-center gap-2 uppercase tracking-tight">
              <Route className="w-5 h-5 text-blue-400" />
              Cola de Despachos
            </h2>

            <button
              onClick={() => setNewTripModalOpen(true)}
              className="px-2.5 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold transition flex items-center gap-1 shadow-md shadow-blue-900/20"
            >
              <Plus className="w-3.5 h-3.5" /> Nuevo
            </button>
          </div>

          <div className="bg-[#0d0d0f] border border-zinc-800 rounded-xl p-3 h-[420px] overflow-y-auto space-y-3 shadow-xl">
            {activeTrips.length === 0 ? (
              <div className="text-center text-zinc-500 py-12 text-xs font-mono uppercase tracking-wider">
                No hay viajes activos en cola.
              </div>
            ) : (
              activeTrips.map((trip) => (
                <div
                  key={trip.id}
                  onClick={() => setSelectedTripForDetail(trip)}
                  className="bg-[#121215] p-3.5 rounded-lg border border-zinc-800/80 hover:border-zinc-700 transition cursor-pointer space-y-2 group"
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-mono font-bold text-blue-400">{trip.code}</span>
                    <span
                      className={`px-2 py-0.5 rounded font-bold text-[10px] uppercase tracking-wider ${
                        trip.status === 'pending'
                          ? 'bg-amber-500/20 text-amber-300 animate-pulse border border-amber-500/30'
                          : trip.status === 'en_route'
                          ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                          : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      }`}
                    >
                      {trip.status === 'pending'
                        ? 'PENDIENTE'
                        : trip.status === 'assigned' || trip.status === 'en_route'
                        ? 'EN CAMINO'
                        : 'EN VIAJE'}
                    </span>
                  </div>

                  <div className="text-xs">
                    <div className="font-bold text-zinc-100 truncate">{trip.clientName}</div>
                    <div className="text-zinc-400 truncate text-[11px] mt-0.5">
                      📍 {trip.origin.address}
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-[11px] font-mono text-zinc-400 pt-1 border-t border-zinc-800/60">
                    <span>
                      Móvil: <strong className="text-white">{trip.driverUnitNumber || 'Sin Asignar'}</strong>
                    </span>
                    <span className="font-bold text-emerald-400">${trip.estimatedFare}</span>
                  </div>

                  {trip.status === 'pending' && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        autoAssignClosestDriver(trip.id);
                      }}
                      className="w-full py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-lg transition flex items-center justify-center gap-1 mt-2 shadow-md shadow-blue-900/20"
                    >
                      <Zap className="w-3 h-3 text-white" /> Auto-Asignar Cercano
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Driver Status Fleet Matrix */}
      <div className="bg-[#0d0d0f] border border-zinc-800 rounded-xl p-4 space-y-3 shadow-xl">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-sm text-white flex items-center gap-2 uppercase tracking-tight">
            <Users className="w-4 h-4 text-blue-400" />
            Estado de Móviles en Frecuencia
          </h3>
          <span className="text-xs text-zinc-400 font-mono">
            {availableDrivers.length} Libres • {enRouteDrivers.length} Ocupados
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
          {drivers.map((drv) => (
            <div
              key={drv.id}
              className="bg-[#121215] p-3 rounded-lg border border-zinc-800 flex items-center gap-3"
            >
              <div className="relative">
                <img
                  src={drv.photoUrl}
                  alt={drv.name}
                  className="w-9 h-9 rounded-full object-cover border border-zinc-700"
                />
                <span
                  className={`absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full border-2 border-zinc-950 ${
                    drv.status === 'available'
                      ? 'bg-emerald-500'
                      : drv.status === 'en_route' || drv.status === 'in_trip'
                      ? 'bg-blue-500'
                      : 'bg-zinc-600'
                  }`}
                />
              </div>
              <div className="truncate">
                <div className="font-extrabold text-xs text-white font-mono">{drv.unitNumber}</div>
                <div className="text-[10px] text-zinc-400 truncate">{drv.name.split(' ')[0]}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

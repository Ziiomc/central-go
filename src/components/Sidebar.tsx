import React from 'react';
import { useApp } from '../context/AppContext';
import {
  LayoutDashboard,
  MapPin,
  Route,
  Users,
  Car,
  UserCheck,
  Headphones,
  Building2,
  Lock,
  BarChart3,
  History,
  Settings,
  User,
  HelpCircle,
  Radio,
  RadioTower,
  Smartphone,
} from 'lucide-react';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose }) => {
  const { activeModule, setActiveModule, currentRole } = useApp();

  const navItems = [
    { id: 'dashboard', label: currentRole === 'operator' ? 'Central de Despacho' : 'Dashboard', icon: LayoutDashboard, roles: ['super_admin', 'company_admin', 'operator', 'driver'] },
    { id: 'live_map', label: 'Mapa de la Flota', icon: MapPin, roles: ['super_admin', 'company_admin', 'operator', 'driver'] },
    { id: 'trips', label: 'Todas las Carreras', icon: Route, roles: ['super_admin', 'company_admin', 'operator', 'driver'] },
    { id: 'drivers', label: 'Conductores', icon: Users, roles: ['super_admin', 'company_admin', 'operator'] },
    { id: 'vehicles', label: 'Vehículos y Flota', icon: Car, roles: ['super_admin', 'company_admin'] },
    { id: 'clients', label: 'Clientes Frecuentes', icon: UserCheck, roles: ['super_admin', 'company_admin', 'operator'] },
    { id: 'operators', label: 'Operadoras', icon: Headphones, roles: ['super_admin', 'company_admin'] },
    { id: 'companies', label: 'Empresas', icon: Building2, roles: ['super_admin', 'company_admin'] },
    { id: 'users', label: 'Usuarios y Permisos', icon: Lock, roles: ['super_admin', 'company_admin'] },
    { id: 'reports', label: 'Reportes & Stats', icon: BarChart3, roles: ['super_admin', 'company_admin'] },
    { id: 'history', label: 'Historial Auditoría', icon: History, roles: ['super_admin', 'company_admin'] },
    { id: 'settings', label: 'Configuración Tarifas', icon: Settings, roles: ['super_admin', 'company_admin'] },
    { id: 'profile', label: 'Mi Perfil', icon: User, roles: ['super_admin', 'company_admin', 'operator', 'driver'] },
    { id: 'help', label: 'Ayuda y Protocolos', icon: HelpCircle, roles: ['super_admin', 'company_admin', 'operator', 'driver'] },
  ];

  // Filter items allowed for current user role
  const allowedItems = navItems.filter((item) => item.roles.includes(currentRole));

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div
          onClick={onClose}
          className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-30 md:hidden"
        />
      )}

      <aside
        className={`fixed md:sticky top-[61px] left-0 h-[calc(100vh-61px)] w-64 bg-[#0d0d0f] border-r border-zinc-800 z-30 transition-transform duration-300 ease-in-out overflow-y-auto ${
          isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        <div className="p-4 space-y-6">
          {/* Driver PWA Fast Mode Highlight Banner */}
          {currentRole === 'driver' && (
            <div className="p-3 bg-blue-600/10 border border-blue-500/20 rounded-xl">
              <div className="flex items-center gap-2 text-blue-400 font-bold text-xs mb-1 uppercase tracking-tight">
                <Smartphone className="w-4 h-4" />
                <span>Modo Conductor PWA</span>
              </div>
              <p className="text-[11px] text-zinc-400">
                Diseñado para pantallas móviles con botones táctiles gigantes y GPS en vivo.
              </p>
            </div>
          )}

          {/* Radio Status indicator */}
          <div className="px-3 py-2 bg-zinc-900/80 rounded-xl border border-zinc-800 flex items-center justify-between text-xs font-mono">
            <div className="flex items-center gap-2">
              <RadioTower className="w-4 h-4 text-blue-400 animate-pulse" />
              <span className="text-zinc-300 uppercase tracking-tight font-semibold">Central VHF</span>
            </div>
            <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded font-bold border border-emerald-500/20">
              148.525 MHz
            </span>
          </div>

          {/* Navigation Group */}
          <nav className="space-y-1">
            <div className="px-3 text-[10px] uppercase font-mono font-bold text-zinc-500 tracking-widest mb-2">
              Navegación
            </div>
            {allowedItems.map(({ id, label, icon: Icon }) => {
              const isActive = activeModule === id;
              return (
                <button
                  key={id}
                  onClick={() => {
                    setActiveModule(id);
                    onClose();
                  }}
                  className={`w-full text-left px-3.5 py-2.5 rounded-lg text-xs font-semibold flex items-center gap-3 transition ${
                    isActive
                      ? 'bg-zinc-800 text-blue-400 border border-zinc-700/60 shadow-lg shadow-blue-900/10 font-bold'
                      : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-blue-400' : 'text-zinc-500'}`} />
                  <span>{label}</span>
                </button>
              );
            })}
          </nav>
        </div>
      </aside>
    </>
  );
};

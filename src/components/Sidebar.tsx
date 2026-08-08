import React from 'react';
import { useApp } from '../context/AppContext';
import {
  BadgeDollarSign,
  BarChart3,
  Building2,
  Car,
  Globe2,
  Headphones,
  HelpCircle,
  History,
  LayoutDashboard,
  Layers3,
  Lock,
  MapPin,
  MapPinned,
  RadioTower,
  Route,
  Settings,
  ShieldCheck,
  Smartphone,
  User,
  UserCheck,
  Users,
  UsersRound,
  WalletCards,
} from 'lucide-react';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose }) => {
  const { activeModule, setActiveModule, currentRole } = useApp();

  const navItems = [
    { id: 'dashboard', label: currentRole === 'operator' ? 'Central de Despacho' : currentRole === 'super_admin' ? 'Resumen Global' : currentRole === 'regional_partner' || currentRole === 'sales_partner' ? 'Panel del Partner' : 'Dashboard', icon: currentRole === 'super_admin' ? Globe2 : LayoutDashboard, roles: ['super_admin', 'regional_partner', 'sales_partner', 'company_admin', 'operator', 'driver'] },

    { id: 'network_centrals', label: currentRole === 'super_admin' ? 'Centrales de la Red' : 'Mis Centrales', icon: Building2, roles: ['super_admin', 'regional_partner', 'sales_partner'] },
    { id: 'partners_network', label: currentRole === 'super_admin' ? 'Partners y Territorios' : 'Equipo Comercial', icon: UsersRound, roles: ['super_admin', 'regional_partner'] },
    { id: 'commissions_network', label: 'Comisiones y Pagos', icon: BadgeDollarSign, roles: ['super_admin', 'regional_partner', 'sales_partner'] },
    { id: 'plans_network', label: 'Planes y Suscripciones', icon: Layers3, roles: ['super_admin'] },
    { id: 'network_support', label: 'Soporte Regional', icon: Headphones, roles: ['super_admin', 'regional_partner', 'sales_partner'] },

    { id: 'live_map', label: 'Mapa de la Flota', icon: MapPin, roles: ['company_admin', 'operator', 'driver'] },
    { id: 'trips', label: 'Todas las Carreras', icon: Route, roles: ['company_admin', 'operator', 'driver'] },
    { id: 'drivers', label: 'Conductores', icon: Users, roles: ['company_admin', 'operator'] },
    { id: 'vehicles', label: 'Vehículos y Flota', icon: Car, roles: ['company_admin'] },
    { id: 'clients', label: 'Clientes Frecuentes', icon: UserCheck, roles: ['company_admin', 'operator'] },
    { id: 'operators', label: 'Operadoras', icon: Headphones, roles: ['company_admin'] },
    { id: 'companies', label: 'Empresas y Convenios', icon: Building2, roles: ['company_admin'] },
    { id: 'users', label: 'Usuarios y Permisos', icon: Lock, roles: ['company_admin'] },
    { id: 'reports', label: 'Reportes y Finanzas', icon: BarChart3, roles: ['company_admin'] },
    { id: 'history', label: currentRole === 'super_admin' ? 'Auditoría Global' : 'Historial Auditoría', icon: History, roles: ['super_admin', 'company_admin'] },
    { id: 'settings', label: currentRole === 'super_admin' ? 'Configuración Global' : 'Configuración Tarifas', icon: Settings, roles: ['super_admin', 'company_admin'] },
    { id: 'profile', label: 'Mi Perfil', icon: User, roles: ['super_admin', 'regional_partner', 'sales_partner', 'company_admin', 'operator', 'driver'] },
    { id: 'help', label: currentRole === 'regional_partner' || currentRole === 'sales_partner' ? 'Material Comercial' : 'Ayuda y Protocolos', icon: HelpCircle, roles: ['super_admin', 'regional_partner', 'sales_partner', 'company_admin', 'operator', 'driver'] },
  ];

  const allowedItems = navItems.filter((item) => item.roles.includes(currentRole));
  const isNetworkRole = ['super_admin', 'regional_partner', 'sales_partner'].includes(currentRole);

  return (
    <>
      {isOpen && <div onClick={onClose} className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-30 md:hidden" />}
      <aside className={`fixed md:sticky top-[61px] left-0 h-[calc(100vh-61px)] ${currentRole === 'operator' ? 'w-48' : 'w-64'} bg-[#0d0d0f] border-r border-zinc-800 z-30 transition-transform duration-300 ease-in-out overflow-y-auto ${isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
        <div className={currentRole === 'operator' ? 'p-2 space-y-2.5' : 'p-4 space-y-5'}>
          {currentRole === 'driver' && (
            <div className="p-3 bg-blue-600/10 border border-blue-500/20 rounded-xl">
              <div className="flex items-center gap-2 text-blue-400 font-bold text-xs mb-1 uppercase tracking-tight"><Smartphone className="w-4 h-4" /><span>Modo Conductor PWA</span></div>
              <p className="text-[11px] text-zinc-400">Diseñado para pantallas móviles con botones táctiles y GPS en vivo.</p>
            </div>
          )}

          {isNetworkRole ? (
            <div className="p-3.5 rounded-2xl bg-gradient-to-br from-purple-500/10 to-blue-500/5 border border-purple-500/20">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-purple-300 font-black text-[10px] uppercase tracking-widest"><ShieldCheck className="w-4 h-4" />Central GO Network</div>
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              </div>
              <p className="text-[10px] text-zinc-500 mt-2 leading-relaxed">{currentRole === 'super_admin' ? 'Vista global: centrales, partners y facturación.' : currentRole === 'regional_partner' ? 'Territorio asignado: Chile Centro-Sur.' : 'Cartera comercial: Maule, Chile.'}</p>
            </div>
          ) : (
            <div className={currentRole === 'operator' ? 'px-2.5 py-2 bg-zinc-900/80 rounded-xl border border-zinc-800 flex items-center justify-between text-[10px] font-mono' : 'px-3 py-2 bg-zinc-900/80 rounded-xl border border-zinc-800 flex items-center justify-between text-xs font-mono'}>
              <div className="flex items-center gap-2"><RadioTower className="w-4 h-4 text-blue-400 animate-pulse" /><span className="text-zinc-300 uppercase tracking-tight font-semibold">Central VHF</span></div>
              <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded font-bold border border-emerald-500/20">148.525</span>
            </div>
          )}

          <nav className="space-y-1">
            <div className="px-3 text-[10px] uppercase font-mono font-bold text-zinc-500 tracking-widest mb-2">{isNetworkRole ? 'Gestión de red' : 'Navegación'}</div>
            {allowedItems.map(({ id, label, icon: Icon }) => {
              const isActive = activeModule === id;
              const networkAccent = isNetworkRole && ['network_centrals', 'partners_network', 'commissions_network', 'plans_network', 'network_support'].includes(id);
              return (
                <button key={id} onClick={() => { setActiveModule(id); onClose(); }} className={`w-full text-left ${currentRole === 'operator' ? 'px-2.5 py-2 text-[11px] gap-2.5' : 'px-3.5 py-2.5 text-xs gap-3'} rounded-lg font-semibold flex items-center transition ${isActive ? networkAccent ? 'bg-purple-500/10 text-purple-300 border border-purple-500/20 shadow-lg shadow-purple-950/10' : 'bg-zinc-800 text-blue-400 border border-zinc-700/60 shadow-lg shadow-blue-900/10 font-bold' : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40'}`}>
                  <Icon className={`w-4 h-4 ${isActive ? networkAccent ? 'text-purple-300' : 'text-blue-400' : 'text-zinc-500'}`} />
                  <span>{label}</span>
                </button>
              );
            })}
          </nav>

          {isNetworkRole && (
            <div className="p-3 rounded-xl border border-zinc-800 bg-zinc-950/50">
              <div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-widest text-zinc-600"><WalletCards className="w-3.5 h-3.5" />Próximo pago</div>
              <p className="text-sm font-black text-white mt-2">15 de agosto</p>
              <p className="text-[9px] text-emerald-400 mt-1">$768.600 listos para liquidar</p>
            </div>
          )}
        </div>
      </aside>
    </>
  );
};

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
  RadioTower,
  Route,
  Settings,
  ShieldCheck,
  User,
  UserCheck,
  Users,
  UsersRound,
} from 'lucide-react';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose }) => {
  const { activeModule, setActiveModule, currentRole, currentCompany } = useApp();
  const isNetworkRole = ['super_admin', 'regional_partner', 'sales_partner'].includes(currentRole);

  const navItems = [
    { id: 'dashboard', label: currentRole === 'operator' ? 'Central de Despacho' : currentRole === 'super_admin' ? 'Resumen Global' : isNetworkRole ? 'Panel Comercial' : 'Dashboard', icon: currentRole === 'super_admin' ? Globe2 : LayoutDashboard, roles: ['super_admin', 'regional_partner', 'sales_partner', 'company_admin', 'operator'] },
    { id: 'network_centrals', label: currentRole === 'super_admin' ? 'Centrales de la Red' : 'Mis Centrales', icon: Building2, roles: ['super_admin', 'regional_partner', 'sales_partner'] },
    { id: 'partners_network', label: currentRole === 'super_admin' ? 'Partners y Territorios' : 'Equipo Comercial', icon: UsersRound, roles: ['super_admin', 'regional_partner'] },
    { id: 'plans_network', label: currentRole === 'super_admin' ? 'Planes y Valores' : 'Planes para Vender', icon: Layers3, roles: ['super_admin', 'regional_partner', 'sales_partner'] },
    { id: 'commissions_network', label: 'Comisiones y Pagos', icon: BadgeDollarSign, roles: ['super_admin', 'regional_partner', 'sales_partner'] },
    { id: 'network_support', label: 'Soporte', icon: Headphones, roles: ['super_admin', 'regional_partner', 'sales_partner'] },
    { id: 'live_map', label: 'Mapa de la Flota', icon: MapPin, roles: ['company_admin', 'operator'] },
    { id: 'trips', label: 'Todas las Carreras', icon: Route, roles: ['company_admin', 'operator'] },
    { id: 'drivers', label: 'Conductores', icon: Users, roles: ['company_admin', 'operator'] },
    { id: 'vehicles', label: 'Vehículos y Flota', icon: Car, roles: ['company_admin'] },
    { id: 'clients', label: 'Clientes', icon: UserCheck, roles: ['company_admin', 'operator'] },
    { id: 'operators', label: 'Operadoras', icon: Headphones, roles: ['company_admin'] },
    { id: 'companies', label: 'Empresas y Convenios', icon: Building2, roles: ['company_admin'] },
    { id: 'users', label: 'Usuarios y Permisos', icon: Lock, roles: ['company_admin'] },
    { id: 'reports', label: 'Reportes y Finanzas', icon: BarChart3, roles: ['company_admin'] },
    { id: 'history', label: currentRole === 'super_admin' ? 'Auditoría Global' : 'Historial Auditoría', icon: History, roles: ['super_admin', 'company_admin'] },
    { id: 'settings', label: currentRole === 'super_admin' ? 'Configuración Global' : 'Configuración Tarifas', icon: Settings, roles: ['super_admin', 'company_admin'] },
    { id: 'profile', label: 'Mi Perfil', icon: User, roles: ['super_admin', 'regional_partner', 'sales_partner', 'company_admin', 'operator'] },
    { id: 'help', label: isNetworkRole ? 'Material y Ayuda' : 'Ayuda y Protocolos', icon: HelpCircle, roles: ['super_admin', 'regional_partner', 'sales_partner', 'company_admin', 'operator'] },
  ];

  const allowedItems = navItems.filter((item) => item.roles.includes(currentRole));

  return (
    <>
      {isOpen && <div onClick={onClose} className="fixed inset-0 z-30 bg-slate-950/80 backdrop-blur-sm md:hidden" />}
      <aside className={`fixed left-0 top-[61px] z-30 h-[calc(100vh-61px)] ${currentRole === 'operator' ? 'w-48' : 'w-64'} overflow-y-auto border-r border-zinc-800 bg-[#0d0d0f] transition-transform duration-300 md:sticky ${isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
        <div className={currentRole === 'operator' ? 'space-y-2.5 p-2' : 'space-y-5 p-4'}>
          {isNetworkRole ? (
            <div className="rounded-2xl border border-purple-500/20 bg-gradient-to-br from-purple-500/10 to-blue-500/5 p-3.5"><div className="flex items-center justify-between gap-2"><div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-purple-300"><ShieldCheck className="h-4 w-4" />Central GO Network</div><span className="h-2 w-2 rounded-full bg-emerald-400" /></div><p className="mt-2 text-[10px] leading-relaxed text-zinc-500">{currentRole === 'super_admin' ? 'Control de centrales, planes, usuarios y red comercial.' : currentRole === 'regional_partner' ? 'Cartera regional, equipo comercial, comisiones y catálogo de venta.' : 'Cartera atribuida, comisiones y catálogo oficial de planes.'}</p></div>
          ) : (
            <div className={currentRole === 'operator' ? 'flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-900/80 px-2.5 py-2 text-[10px]' : 'rounded-xl border border-zinc-800 bg-zinc-900/80 px-3 py-2.5'}><div className="flex items-center gap-2"><RadioTower className="h-4 w-4 text-emerald-400" /><div><p className="text-[9px] font-black uppercase tracking-wider text-zinc-500">Central activa</p><p className="mt-0.5 truncate text-xs font-bold text-zinc-300">{currentCompany.name}</p></div></div></div>
          )}

          <nav className="space-y-1"><div className="mb-2 px-3 text-[9px] font-black uppercase tracking-widest text-zinc-600">{isNetworkRole ? 'Gestión comercial' : 'Operación'}</div>{allowedItems.map(({ id, label, icon: Icon }) => { const active=activeModule===id; const networkAccent=isNetworkRole&&['network_centrals','partners_network','plans_network','commissions_network','network_support'].includes(id); return <button key={id} onClick={() => { setActiveModule(id); onClose(); }} className={`flex w-full items-center ${currentRole==='operator'?'gap-2.5 px-2.5 py-2 text-[11px]':'gap-3 px-3.5 py-2.5 text-xs'} rounded-lg text-left font-semibold transition ${active ? networkAccent ? 'border border-purple-500/20 bg-purple-500/10 text-purple-300' : 'border border-zinc-700/60 bg-zinc-800 text-blue-400' : 'text-zinc-400 hover:bg-zinc-800/40 hover:text-zinc-200'}`}><Icon className={`h-4 w-4 ${active ? networkAccent ? 'text-purple-300' : 'text-blue-400' : 'text-zinc-500'}`} /><span>{label}</span></button>; })}</nav>

          {isNetworkRole && <div className="rounded-xl border border-zinc-800 bg-zinc-950/50 p-3"><p className="text-[9px] font-black uppercase tracking-widest text-zinc-600">Entorno</p><p className="mt-2 text-xs font-black text-emerald-300">Producción sincronizada</p><p className="mt-1 text-[9px] leading-relaxed text-zinc-600">Los indicadores comerciales visibles se cargan desde Supabase.</p></div>}
        </div>
      </aside>
    </>
  );
};

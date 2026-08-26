import React from 'react';
import { useApp } from '../context/AppContext';
import { ScheduledTripsStrip } from './modules/ScheduledTripsStrip';
import {
  BadgeDollarSign,
  BarChart3,
  Building2,
  CalendarClock,
  Car,
  Globe2,
  Headphones,
  HelpCircle,
  History,
  LayoutDashboard,
  Layers3,
  Lock,
  RadioTower,
  Route,
  Settings,
  ShieldCheck,
  User,
  UserCheck,
  Users,
  UsersRound,
  WalletCards,
  X,
} from 'lucide-react';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose }) => {
  const { activeModule, setActiveModule, currentRole, currentCompany } = useApp();
  const [reservationsOpen,setReservationsOpen]=React.useState(false);
  const isNetworkRole = ['super_admin', 'regional_partner', 'sales_partner'].includes(currentRole);

  React.useEffect(() => {
    if (!isOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [isOpen, onClose]);

  React.useEffect(()=>{
    const closeReservations=(event:KeyboardEvent)=>{if(event.key==='Escape'&&reservationsOpen)setReservationsOpen(false);};
    window.addEventListener('keydown',closeReservations);
    return()=>window.removeEventListener('keydown',closeReservations);
  },[reservationsOpen]);

  const navItems = [
    { id: 'dashboard', group: 'Vista general', label: currentRole === 'operator' ? 'Central de Despacho' : currentRole === 'super_admin' ? 'Resumen Global' : isNetworkRole ? 'Panel Comercial' : 'Dashboard', icon: currentRole === 'super_admin' ? Globe2 : LayoutDashboard, roles: ['super_admin', 'regional_partner', 'sales_partner', 'company_admin', 'operator'] },
    { id: 'network_centrals', group: 'Red comercial', label: currentRole === 'super_admin' ? 'Centrales de la Red' : 'Mis Centrales', icon: Building2, roles: ['super_admin', 'regional_partner', 'sales_partner'] },
    { id: 'partners_network', group: 'Red comercial', label: currentRole === 'super_admin' ? 'Partners y Territorios' : 'Equipo Comercial', icon: UsersRound, roles: ['super_admin', 'regional_partner'] },
    { id: 'plans_network', group: 'Red comercial', label: currentRole === 'super_admin' ? 'Planes y Valores' : 'Planes para Vender', icon: Layers3, roles: ['super_admin', 'regional_partner', 'sales_partner'] },
    { id: 'commissions_network', group: 'Red comercial', label: 'Comisiones y Pagos', icon: BadgeDollarSign, roles: ['super_admin', 'regional_partner', 'sales_partner'] },
    { id: 'payments', group: 'Red comercial', label: 'Pagos y Mercado Pago', icon: WalletCards, roles: ['super_admin'] },
    { id: 'network_support', group: 'Red comercial', label: 'Soporte', icon: Headphones, roles: ['super_admin', 'regional_partner', 'sales_partner'] },
    { id: 'trips', group: 'Operación', label: 'Carreras', icon: Route, roles: ['company_admin', 'operator'] },
    { id: 'reservations', group: 'Operación', label: 'Reservas', icon: CalendarClock, roles: ['company_admin', 'operator'] },
    { id: 'drivers', group: 'Operación', label: 'Conductores', icon: Users, roles: ['company_admin', 'operator'] },
    { id: 'vehicles', group: 'Operación', label: 'Vehículos y Flota', icon: Car, roles: ['company_admin'] },
    { id: 'clients', group: 'Operación', label: 'Clientes', icon: UserCheck, roles: ['company_admin', 'operator'] },
    { id: 'operators', group: 'Operación', label: 'Operadores/as', icon: Headphones, roles: ['company_admin'] },
    { id: 'users', group: 'Administración', label: 'Usuarios y Permisos', icon: Lock, roles: ['super_admin'] },
    { id: 'reports', group: 'Administración', label: 'Reportes de Operación', icon: BarChart3, roles: ['company_admin'] },
    { id: 'history', group: 'Administración', label: currentRole === 'super_admin' ? 'Auditoría Global' : 'Historial Auditoría', icon: History, roles: ['super_admin', 'company_admin'] },
    { id: 'settings', group: 'Administración', label: currentRole === 'super_admin' ? 'Configuración Global' : 'Configuración Tarifas', icon: Settings, roles: ['super_admin', 'company_admin'] },
    { id: 'profile', group: 'Cuenta', label: 'Mi Perfil', icon: User, roles: ['super_admin', 'regional_partner', 'sales_partner', 'company_admin', 'operator'] },
    { id: 'help', group: 'Cuenta', label: isNetworkRole ? 'Material y Ayuda' : 'Ayuda y Protocolos', icon: HelpCircle, roles: ['super_admin', 'regional_partner', 'sales_partner', 'company_admin', 'operator'] },
  ];

  const operatorCore = new Set(['dashboard', 'trips', 'reservations', 'drivers']);
  const allowedItems = navItems
    .filter((item) => item.roles.includes(currentRole))
    .filter((item) => currentRole !== 'operator' || operatorCore.has(item.id));
  const groups = ['Vista general', 'Red comercial', 'Operación', 'Administración', 'Cuenta']
    .map((name) => ({ name, items: allowedItems.filter((item) => item.group === name) }))
    .filter((section) => section.items.length > 0);

  const openItem=(id:string)=>{
    if(id==='reservations'){
      setReservationsOpen(true);
      onClose();
      return;
    }
    setReservationsOpen(false);
    setActiveModule(id);
    onClose();
  };

  return (
    <>
      {isOpen && <div onClick={onClose} className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm" />}
      <aside aria-hidden={!isOpen} inert={!isOpen} className={`cg-sidebar fixed left-0 top-0 z-50 h-[100dvh] w-[min(88vw,300px)] overflow-y-auto border-r border-zinc-700 bg-[#0d0d0f] shadow-[24px_0_70px_rgba(0,0,0,.45)] transition-transform duration-300 ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className={currentRole === 'operator' ? 'space-y-2.5 p-2' : 'space-y-5 p-4'}>
          <div className="flex justify-end"><button onClick={onClose} className="rounded-lg border border-zinc-800 bg-zinc-900 p-2 text-zinc-400" aria-label="Cerrar menú"><X className="h-4 w-4" /></button></div>
          {isNetworkRole ? (
            <div className="rounded-2xl border border-blue-500/20 bg-gradient-to-br from-blue-500/10 to-cyan-500/5 p-3.5"><div className="flex items-center justify-between gap-2"><div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-blue-300"><ShieldCheck className="h-4 w-4" />Central GO Network</div><span className="h-2 w-2 rounded-full bg-emerald-400" /></div><p className="mt-2 text-[10px] leading-relaxed text-zinc-500">{currentRole === 'super_admin' ? 'Control de centrales, planes, usuarios y red comercial.' : currentRole === 'regional_partner' ? 'Cartera regional, equipo comercial, comisiones y catálogo de venta.' : 'Cartera atribuida, comisiones y catálogo oficial de planes.'}</p></div>
          ) : (
            <div className={currentRole === 'operator' ? 'flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-900/80 px-2.5 py-2 text-[10px]' : 'rounded-xl border border-zinc-800 bg-zinc-900/80 px-3 py-2.5'}><div className="flex items-center gap-2"><RadioTower className="h-4 w-4 text-emerald-400" /><div><p className="text-[9px] font-black uppercase tracking-wider text-zinc-500">Central activa</p><p className="mt-0.5 truncate text-xs font-bold text-zinc-300">{currentCompany.name}</p></div></div></div>
          )}

          <nav className="space-y-4">{groups.map((section) => <div key={section.name}><div className="mb-1.5 px-3 text-[8px] font-black uppercase tracking-[.18em] text-zinc-600">{section.name}</div><div className="space-y-1">{section.items.map(({ id, label, icon: Icon }) => { const active=id==='reservations'?reservationsOpen:activeModule===id&&!reservationsOpen; return <button key={id} onClick={() => openItem(id)} data-active={active} className={`cg-nav-item ${currentRole==='operator'?'is-compact':''}`}><span className="cg-nav-icon"><Icon className="h-4 w-4" /></span><span className="min-w-0 flex-1 truncate">{label}</span><span className="cg-nav-indicator" /></button>; })}</div></div>)}</nav>

          {isNetworkRole && <div className="rounded-xl border border-zinc-800 bg-zinc-950/50 p-3"><p className="text-[9px] font-black uppercase tracking-widest text-zinc-600">Entorno</p><p className="mt-2 text-xs font-black text-emerald-300">Producción sincronizada</p><p className="mt-1 text-[9px] leading-relaxed text-zinc-600">Los indicadores comerciales visibles se cargan desde Supabase.</p></div>}
          <a href="mailto:ziiomc3@gmail.com" className="block rounded-xl border border-zinc-800 bg-zinc-950/40 px-3 py-2.5 text-[9px] font-bold text-zinc-500 transition hover:border-blue-500/25 hover:text-blue-300">Contacto: ziiomc3@gmail.com</a>
        </div>
      </aside>

      {reservationsOpen&&<div className="fixed inset-0 z-[45] overflow-y-auto bg-[#08090c] p-3 text-zinc-100 sm:p-5">
        <div className="mx-auto max-w-6xl">
          <div className="mb-3 flex items-center justify-between rounded-2xl border border-zinc-800 bg-[#0d0d0f] px-4 py-3"><div><p className="text-[9px] font-black uppercase tracking-[.18em] text-sky-400">Central GO · Operación</p><h1 className="mt-0.5 text-xl font-black text-white">Reservas programadas</h1><p className="mt-1 text-[10px] text-zinc-500">Las reservas futuras se administran aquí y entran al despacho solo cuando corresponde.</p></div><button type="button" onClick={()=>setReservationsOpen(false)} className="grid h-10 w-10 place-items-center rounded-xl border border-zinc-700 bg-zinc-900 text-zinc-300" aria-label="Cerrar reservas"><X className="h-4 w-4"/></button></div>
          <ScheduledTripsStrip/>
        </div>
      </div>}
    </>
  );
};

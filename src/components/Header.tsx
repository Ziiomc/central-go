import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import centralGoLogo from '../assets/images/central-go-logo.svg';
import { ThemeToggle } from './auth/ThemeToggle';
import {
  BadgeDollarSign,
  Bell,
  Building2,
  ChevronDown,
  Eye,
  Globe2,
  LogOut,
  MapPinned,
  Menu,
  Plus,
  ShieldAlert,
  ShieldCheck,
  UsersRound,
  Volume2,
  VolumeX,
  Zap,
} from 'lucide-react';

interface HeaderProps {
  onToggleNotifications: () => void;
  onToggleMenu: () => void;
}

const roleLabels: Record<string, string> = {
  super_admin: 'Superadmin Global',
  regional_partner: 'Partner Regional',
  sales_partner: 'Partner Comercial',
  company_admin: 'Administrador de Central',
  operator: 'Operadora',
  driver: 'Conductor',
};

export const Header: React.FC<HeaderProps> = ({ onToggleNotifications, onToggleMenu }) => {
  const { signOut, profile } = useAuth();
  const {
    currentRole,
    currentCompany,
    companies,
    setCurrentCompany,
    soundMuted,
    toggleSound,
    notifications,
    setNewTripModalOpen,
    activeSOSDriver,
    setActiveSOSDriver,
    setActiveModule,
  } = useApp();
  const [companyMenuOpen, setCompanyMenuOpen] = useState(false);
  const unreadCount = notifications.filter((notification) => !notification.read).length;
  const isNetworkRole = ['super_admin', 'regional_partner', 'sales_partner'].includes(currentRole);
  const roleLabel = roleLabels[currentRole] ?? currentRole;

  const openRolePreview = (view: string) => {
    if (!view) return;
    const url = new URL(window.location.origin);
    url.searchParams.set('demo', '1');
    url.searchParams.set('view', view);
    window.open(url.toString(), '_blank', 'noopener,noreferrer');
  };

  return (
    <header className="sticky top-0 z-40 w-full shrink-0 border-b border-zinc-800 bg-[#0d0d0f] px-3 py-2.5 shadow-xl md:px-6">
      <div className="mx-auto flex max-w-[1800px] items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3 md:gap-4">
          <button onClick={onToggleMenu} className="rounded-xl border border-zinc-800 bg-zinc-900 p-2.5 text-zinc-200 shadow-lg transition hover:bg-zinc-800" aria-label="Abrir menú principal"><Menu className="h-5 w-5" /></button>
          <div className="flex shrink-0 items-center gap-2.5">
            <img src={centralGoLogo} alt="Central GO" className="h-10 w-10 rounded-xl border-2 border-amber-400/70 bg-zinc-950 p-0.5" />
            <div className="hidden sm:block"><div className="flex items-center gap-1 text-lg font-black tracking-tight text-white">CENTRAL <span className="rounded-md border border-amber-400/50 bg-amber-500/20 px-1.5 py-0.5 text-amber-400">GO</span></div><p className="mt-0.5 text-[8px] font-black uppercase tracking-[0.16em] text-zinc-600">Plataforma oficial · datos sincronizados</p></div>
          </div>

          {isNetworkRole ? (
            <div className="hidden items-center gap-2 border-l border-zinc-800 pl-4 md:flex"><div className="rounded-lg border border-purple-500/20 bg-purple-500/10 p-1.5 text-purple-300">{currentRole === 'super_admin' ? <Globe2 className="h-3.5 w-3.5" /> : <MapPinned className="h-3.5 w-3.5" />}</div><div><p className="text-[8px] font-black uppercase tracking-widest text-zinc-600">Área de trabajo</p><p className="text-xs font-bold text-zinc-300">{currentRole === 'super_admin' ? 'Red Central GO' : roleLabel}</p></div></div>
          ) : (
            <div className="relative hidden border-l border-zinc-800 pl-4 md:block">
              <button onClick={() => setCompanyMenuOpen((open) => !open)} className="flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-zinc-300 hover:bg-zinc-800"><Building2 className="h-3.5 w-3.5 text-blue-400" /><span className="max-w-[190px] truncate">{currentCompany.name}</span>{companies.length > 1 && <ChevronDown className="h-3 w-3 text-zinc-500" />}</button>
              {companyMenuOpen && companies.length > 1 && <div className="absolute left-4 top-full z-50 mt-2 w-64 rounded-xl border border-zinc-800 bg-[#0d0d0f] p-1 shadow-2xl"><div className="px-3 py-2 text-[9px] font-black uppercase tracking-widest text-zinc-600">Centrales autorizadas</div>{companies.map((company) => <button key={company.id} onClick={() => { setCurrentCompany(company); setCompanyMenuOpen(false); }} className={`flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left text-xs font-bold ${company.id === currentCompany.id ? 'border border-blue-500/20 bg-blue-500/10 text-blue-300' : 'text-zinc-300 hover:bg-zinc-800'}`}><span className="truncate">{company.name}</span><span className="ml-2 text-[9px] font-mono text-zinc-600">{company.code}</span></button>)}</div>}
            </div>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {currentRole === 'operator' && <button onClick={() => setNewTripModalOpen(true)} className="hidden items-center gap-2 rounded-xl border border-amber-300 bg-amber-400 px-4 py-2 text-xs font-black uppercase text-zinc-950 shadow-lg shadow-amber-950/30 lg:flex"><Zap className="h-4 w-4" />Nueva carrera <kbd className="rounded bg-black/10 px-1.5 py-0.5 text-[9px]">F2</kbd></button>}
          {currentRole === 'sales_partner' && <button onClick={() => setActiveModule('network_centrals')} className="hidden items-center gap-2 rounded-xl border border-purple-400/25 bg-purple-600 px-4 py-2 text-xs font-black text-white xl:flex"><Plus className="h-4 w-4" />Registrar central</button>}
          {currentRole === 'super_admin' && <button onClick={() => setActiveModule('partners_network')} className="hidden items-center gap-2 rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-[10px] font-black text-amber-300 xl:flex" title="Partners y territorios"><UsersRound className="h-4 w-4" />Partners</button>}
          {currentRole === 'super_admin' && <label className="hidden items-center gap-1.5 rounded-xl border border-blue-500/20 bg-blue-500/[0.06] px-2 py-1.5 lg:flex" title="Vista segura de inspección; no cambia permisos reales"><Eye className="h-4 w-4 text-blue-300" /><select defaultValue="" onChange={(event) => { openRolePreview(event.target.value); event.currentTarget.value = ''; }} className="max-w-[125px] bg-transparent text-[9px] font-black text-blue-200 outline-none"><option value="" className="bg-zinc-950">Ver como…</option><option value="operator" className="bg-zinc-950">Operadora</option><option value="company_admin" className="bg-zinc-950">Administrador</option><option value="driver" className="bg-zinc-950">Conductor</option><option value="sales_partner" className="bg-zinc-950">Partner comercial</option><option value="regional_partner" className="bg-zinc-950">Partner regional</option><option value="plans" className="bg-zinc-950">Planes</option></select></label>}
          {activeSOSDriver && !isNetworkRole && <button onClick={() => setActiveSOSDriver(activeSOSDriver)} className="hidden items-center gap-2 rounded-xl border border-red-400 bg-red-600 px-3 py-2 text-xs font-black text-white shadow-lg shadow-red-950/40 lg:flex"><ShieldAlert className="h-4 w-4" />SOS {activeSOSDriver.unitNumber}</button>}
          {!isNetworkRole && <button onClick={toggleSound} className={`rounded-lg border p-2 ${soundMuted ? 'border-zinc-800 bg-zinc-900 text-zinc-500' : 'border-blue-500/20 bg-blue-500/10 text-blue-400'}`} title={soundMuted ? 'Activar sonidos' : 'Silenciar sonidos'}>{soundMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}</button>}
          {isNetworkRole && <button onClick={() => setActiveModule('plans_network')} className="hidden rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-2 text-emerald-300 sm:block" title="Planes y valores"><BadgeDollarSign className="h-4 w-4" /></button>}
          <ThemeToggle compact />
          <button onClick={onToggleNotifications} className="relative rounded-lg border border-zinc-800 bg-zinc-900 p-2 text-zinc-300 hover:bg-zinc-800"><Bell className="h-4 w-4" />{unreadCount > 0 && <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-blue-500 px-1 text-[9px] font-black text-white">{unreadCount}</span>}</button>
          <div className="hidden items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900 px-2.5 py-1.5 md:flex"><div className={`h-2 w-2 rounded-full ${isNetworkRole ? 'bg-purple-400' : 'bg-emerald-400'}`} /><div className="max-w-[145px]"><p className="truncate text-[10px] font-black text-zinc-200">{profile?.name || roleLabel}</p><p className="truncate text-[8px] uppercase text-zinc-600">{roleLabel}</p></div>{currentRole === 'super_admin' && <ShieldCheck className="h-3.5 w-3.5 text-purple-300" />}</div>
          <button onClick={() => void signOut()} className="rounded-lg border border-zinc-800 bg-zinc-900 p-2 text-zinc-400 transition hover:border-rose-500/30 hover:bg-rose-950/50 hover:text-rose-300" title="Cerrar sesión"><LogOut className="h-4 w-4" /></button>
        </div>
      </div>
    </header>
  );
};

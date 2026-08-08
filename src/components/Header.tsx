import React, { useEffect, useRef, useState } from 'react';
import { useApp } from '../context/AppContext';
import { UserRole } from '../types';
import { runtimeConfig } from '../config/runtime';
import { useAuth } from '../context/AuthContext';
import { promptPWAInstall } from '../lib/pwa';
import centralGoLogo from '../assets/images/central-go-logo.svg';
import {
  BadgeDollarSign,
  Bell,
  Building2,
  Car,
  ChevronDown,
  Download,
  Globe2,
  Handshake,
  Headphones,
  MapPinned,
  Plus,
  ShieldAlert,
  ShieldCheck,
  LockKeyhole,
  LogOut,
  X,
  Volume2,
  VolumeX,
  Zap,
} from 'lucide-react';

interface HeaderProps {
  onToggleNotifications: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onToggleNotifications }) => {
  const { signOut } = useAuth();
  const {
    currentRole,
    setCurrentRole,
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

  const [roleMenuOpen, setRoleMenuOpen] = useState(false);
  const [companyMenuOpen, setCompanyMenuOpen] = useState(false);
  const [ownerAccessOpen, setOwnerAccessOpen] = useState(false);
  const [ownerPin, setOwnerPin] = useState('');
  const [ownerAccessError, setOwnerAccessError] = useState('');
  const [ownerUnlocked, setOwnerUnlocked] = useState(false);
  const ownerTapCount = useRef(0);
  const ownerTapTimer = useRef<number | null>(null);
  const unreadCount = notifications.filter((n) => !n.read).length;
  const isNetworkRole = ['super_admin', 'regional_partner', 'sales_partner'].includes(currentRole);
  const compactCompanyName = currentCompany.name.replace(/\bradiotaxis?\b/gi, '').replace(/\s+/g, ' ').trim().replace(/^Central Go\b/i, 'Central GO');

  const publicRoles: { role: UserRole; label: string; icon: any; color: string }[] = [
    { role: 'operator', label: 'Central Operadora', icon: Headphones, color: 'text-blue-400' },
    { role: 'driver', label: 'Conductor (PWA)', icon: Car, color: 'text-emerald-400' },
    { role: 'company_admin', label: 'Admin de Central', icon: Building2, color: 'text-amber-400' },
    { role: 'sales_partner', label: 'Partner Comercial', icon: Handshake, color: 'text-cyan-400' },
    { role: 'regional_partner', label: 'Partner Regional', icon: MapPinned, color: 'text-purple-400' },
  ];
  const rolesList = ownerUnlocked || currentRole === 'super_admin'
    ? [...publicRoles, { role: 'super_admin' as UserRole, label: 'Superadmin Global', icon: ShieldCheck, color: 'text-fuchsia-400' }]
    : publicRoles;

  const SUPERADMIN_PIN_HASH = '73a2af8864fc500fa49048bf3003776c19938f360e56bd03663866fb3087884a';

  const hashValue = async (value: string) => {
    const encoded = new TextEncoder().encode(value);
    const digest = await window.crypto.subtle.digest('SHA-256', encoded);
    return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, '0')).join('');
  };

  const openOwnerAccess = () => {
    if (!runtimeConfig.isDemo) return;
    setRoleMenuOpen(false);
    setOwnerPin('');
    setOwnerAccessError('');
    setOwnerAccessOpen(true);
  };

  useEffect(() => {
    const handleOwnerShortcut = (event: KeyboardEvent) => {
      if (event.ctrlKey && event.altKey && event.key.toLowerCase() === 's') {
        event.preventDefault();
        openOwnerAccess();
      }
    };
    window.addEventListener('keydown', handleOwnerShortcut);
    return () => window.removeEventListener('keydown', handleOwnerShortcut);
  }, []);

  const handleOwnerLogoTap = () => {
    if (!runtimeConfig.isDemo) return;
    ownerTapCount.current += 1;
    if (ownerTapTimer.current) window.clearTimeout(ownerTapTimer.current);
    if (ownerTapCount.current >= 5) {
      ownerTapCount.current = 0;
      openOwnerAccess();
      return;
    }
    ownerTapTimer.current = window.setTimeout(() => {
      ownerTapCount.current = 0;
    }, 2500);
  };

  const enterRole = (role: UserRole) => {
    if (!runtimeConfig.isDemo) return;
    if (role === 'super_admin' && !ownerUnlocked) {
      openOwnerAccess();
      return;
    }
    if (role !== 'super_admin') setOwnerUnlocked(false);
    setCurrentRole(role);
    setActiveModule('dashboard');
    setRoleMenuOpen(false);
  };

  const unlockOwnerAccess = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setOwnerAccessError('');
    try {
      const pinHash = await hashValue(ownerPin.trim());
      if (pinHash !== SUPERADMIN_PIN_HASH) {
        setOwnerAccessError('Contraseña incorrecta.');
        return;
      }
      setOwnerUnlocked(true);
      setCurrentRole('super_admin');
      setActiveModule('dashboard');
      setOwnerPin('');
      setOwnerAccessOpen(false);
    } catch {
      setOwnerAccessError('No fue posible validar el acceso en este navegador.');
    }
  };

  const handleInstallClick = async () => {
    const installed = await promptPWAInstall();
    if (installed) alert('¡Central GO instalado correctamente como PWA!');
    else alert('Para instalar: abre las opciones del navegador y selecciona “Instalar aplicación” o “Agregar a la pantalla principal”.');
  };

  const networkScope = currentRole === 'super_admin' ? 'Red Global' : currentRole === 'regional_partner' ? 'Chile Centro-Sur' : 'Maule, Chile';

  return (
    <header className="sticky top-0 z-40 w-full bg-[#0d0d0f] border-b border-zinc-800 px-4 md:px-6 py-3 shrink-0 shadow-xl">
      <div className="max-w-[1600px] mx-auto flex items-center justify-between gap-3">
        <div className="flex items-center gap-4 min-w-0">
          <div className="flex items-center gap-3 shrink-0">
            <button type="button" onClick={handleOwnerLogoTap} className="relative" aria-label="Central GO">
              <img src={centralGoLogo} alt="Central GO" className="w-10 h-10 md:w-11 md:h-11 rounded-xl border-2 border-amber-400/80 shadow-lg shadow-amber-500/30 object-cover bg-zinc-950 p-0.5" />
              <span className="absolute -top-1 -right-1 flex h-3 w-3"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" /><span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500" /></span>
            </button>
            <div className="hidden sm:block">
              <span className="font-black text-lg md:text-xl tracking-tight text-white flex items-center gap-1">CENTRAL <span className="text-amber-400 px-1.5 py-0.5 bg-amber-500/20 border border-amber-400/50 rounded-md">GO</span></span>
              <p className="text-[9px] text-amber-300/80 uppercase tracking-widest font-extrabold flex items-center gap-1.5 mt-0.5 font-mono"><span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />{isNetworkRole ? 'International Network' : 'Radiotaxis & Despacho GPS'}</p>
            </div>
          </div>

          {!isNetworkRole ? (
            <div className="relative hidden md:block border-l border-zinc-800 pl-4 ml-1">
              <button onClick={() => setCompanyMenuOpen(!companyMenuOpen)} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-xs font-medium text-zinc-300 transition">
                <Building2 className="w-3.5 h-3.5 text-blue-400" /><span className="truncate max-w-[180px] font-semibold">{compactCompanyName}</span><ChevronDown className="w-3 h-3 text-zinc-500" />
              </button>
              {companyMenuOpen && (
                <div className="absolute top-full left-4 mt-2 w-60 bg-[#0d0d0f] border border-zinc-800 rounded-xl shadow-2xl z-50 p-1">
                  <div className="px-3 py-1.5 text-[10px] uppercase font-mono font-bold text-zinc-500 tracking-wider">Centrales registradas</div>
                  {companies.map((comp) => <button key={comp.id} onClick={() => { setCurrentCompany(comp); setCompanyMenuOpen(false); }} className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium flex items-center justify-between transition ${comp.id === currentCompany.id ? 'bg-blue-600/10 text-blue-400 border border-blue-500/20' : 'text-zinc-300 hover:bg-zinc-800'}`}><span>{comp.name}</span><span className="text-[10px] font-mono bg-zinc-800 px-1.5 py-0.5 rounded text-zinc-400">{comp.code}</span></button>)}
                </div>
              )}
            </div>
          ) : (
            <div className="hidden md:flex items-center gap-2 border-l border-zinc-800 pl-4 ml-1">
              <div className="p-1.5 rounded-lg bg-purple-500/10 border border-purple-500/20 text-purple-300"><Globe2 className="w-3.5 h-3.5" /></div>
              <div><p className="text-[9px] uppercase tracking-widest font-black text-zinc-600">Alcance actual</p><p className="text-xs font-bold text-zinc-300">{networkScope}</p></div>
            </div>
          )}
        </div>

        <div className="hidden lg:flex items-center gap-2">
          {currentRole === 'operator' && (
            <button onClick={() => setNewTripModalOpen(true)} className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs shadow-lg shadow-amber-500/20 transition flex items-center gap-2 border border-amber-300 uppercase tracking-wider active:scale-95"><Zap className="w-4 h-4 fill-slate-950" /><span>+ Nueva carrera</span><kbd className="rounded bg-black/15 px-1.5 py-0.5 text-[10px] font-black">F2</kbd></button>
          )}
          {isNetworkRole && (
            <button onClick={() => setActiveModule('network_centrals')} className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-black text-xs shadow-lg shadow-purple-950/40 transition flex items-center gap-2 border border-purple-400/30 uppercase tracking-wider"><Plus className="w-4 h-4" /><span>Registrar central</span></button>
          )}
          {activeSOSDriver && !isNetworkRole && (
            <button onClick={() => setActiveSOSDriver(activeSOSDriver)} className="px-4 py-2 rounded-xl bg-red-600 text-white font-extrabold text-xs shadow-lg shadow-red-600/50 flex items-center gap-2 border border-red-400 uppercase tracking-wider animate-bounce"><ShieldAlert className="w-4 h-4" /><span>Alerta SOS ({activeSOSDriver.unitNumber})</span></button>
          )}
        </div>

        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {!isNetworkRole && <button onClick={toggleSound} className={`p-2 rounded-lg border transition ${soundMuted ? 'bg-zinc-900 text-zinc-500 border-zinc-800' : 'bg-blue-500/10 text-blue-400 border-blue-500/20'}`} title={soundMuted ? 'Activar sonidos' : 'Silenciar sonidos'}>{soundMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}</button>}
          {isNetworkRole && <button onClick={() => setActiveModule('commissions_network')} className="hidden sm:flex p-2 rounded-lg bg-amber-500/10 text-amber-300 border border-amber-500/20" title="Comisiones"><BadgeDollarSign className="w-4 h-4" /></button>}
          <button onClick={onToggleNotifications} className="relative p-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 transition"><Bell className="w-4 h-4" />{unreadCount > 0 && <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-blue-500 text-white font-bold text-[10px] flex items-center justify-center">{unreadCount}</span>}</button>
          <button onClick={handleInstallClick} className="hidden xl:flex items-center gap-1.5 px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-200 rounded-lg text-xs font-semibold"><Download className="w-3.5 h-3.5 text-blue-400" /><span>PWA</span></button>

          <div className="relative">
            <button onClick={() => runtimeConfig.isDemo && setRoleMenuOpen(!roleMenuOpen)} className="flex items-center gap-2 px-2.5 md:px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-xs font-medium text-zinc-200 transition shadow-md"><div className={`w-2 h-2 rounded-full animate-pulse ${isNetworkRole ? 'bg-purple-500' : 'bg-blue-500'}`} /><span className="hidden md:block font-semibold max-w-[150px] truncate">{currentRole === 'super_admin' ? 'Superadmin Global' : rolesList.find((r) => r.role === currentRole)?.label}</span><ChevronDown className="w-3.5 h-3.5 text-zinc-500" /></button>
            {runtimeConfig.isDemo && roleMenuOpen && (
              <div className="absolute right-0 mt-2 w-72 bg-[#0d0d0f] border border-zinc-800 rounded-xl shadow-2xl z-50 p-2">
                <div className="px-3 py-1.5 text-[10px] font-mono font-bold text-zinc-500 uppercase border-b border-zinc-800 mb-1 tracking-wider">Cambiar perfil de demostración</div>
                {rolesList.map(({ role, label, icon: Icon, color }) => <button key={role} onClick={() => enterRole(role)} className={`w-full text-left px-3 py-2.5 rounded-lg text-xs font-medium flex items-center gap-2.5 transition ${currentRole === role ? 'bg-blue-600/10 text-blue-400 font-bold border border-blue-500/20' : 'text-zinc-300 hover:bg-zinc-800'}`}><Icon className={`w-4 h-4 ${color}`} /><span className="flex-1">{label}</span></button>)}
              </div>
            )}
          </div>
          {runtimeConfig.isCommercial && (
            <button onClick={() => void signOut()} className="p-2 rounded-lg bg-zinc-900 hover:bg-rose-950/60 border border-zinc-800 hover:border-rose-500/30 text-zinc-400 hover:text-rose-300 transition" title="Cerrar sesión"><LogOut className="w-4 h-4" /></button>
          )}
        </div>
      </div>

      {runtimeConfig.isDemo && ownerAccessOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 px-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="owner-access-title">
          <form onSubmit={unlockOwnerAccess} className="w-full max-w-sm rounded-3xl border border-fuchsia-500/25 bg-[#111116] p-6 shadow-2xl shadow-fuchsia-950/40">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="rounded-2xl border border-fuchsia-500/25 bg-fuchsia-500/10 p-3 text-fuchsia-300"><LockKeyhole className="h-6 w-6" /></div>
                <div>
                  <h2 id="owner-access-title" className="text-lg font-black text-white">Acceso del propietario</h2>
                  <p className="mt-1 text-xs leading-relaxed text-zinc-400">El panel Superadmin Global está protegido y no se muestra sin autorización.</p>
                </div>
              </div>
              <button type="button" onClick={() => { setOwnerAccessOpen(false); setOwnerPin(''); setOwnerAccessError(''); }} className="rounded-xl p-2 text-zinc-500 transition hover:bg-white/5 hover:text-white" aria-label="Cerrar acceso"><X className="h-5 w-5" /></button>
            </div>
            <label className="mt-6 block text-[10px] font-black uppercase tracking-widest text-zinc-500" htmlFor="owner-pin">Contraseña</label>
            <input id="owner-pin" autoFocus type="password" inputMode="numeric" autoComplete="current-password" value={ownerPin} onChange={(event) => { setOwnerPin(event.target.value); setOwnerAccessError(''); }} className="mt-2 w-full rounded-2xl border border-zinc-700 bg-zinc-950 px-4 py-3.5 text-center text-lg font-black tracking-[0.35em] text-white outline-none transition placeholder:tracking-normal focus:border-fuchsia-400 focus:ring-4 focus:ring-fuchsia-500/10" placeholder="••••" maxLength={12} />
            {ownerAccessError && <p className="mt-2 text-sm font-bold text-red-400">{ownerAccessError}</p>}
            <button type="submit" disabled={!ownerPin.trim()} className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-fuchsia-600 px-4 py-3.5 text-sm font-black text-white shadow-xl shadow-fuchsia-950/40 transition hover:bg-fuchsia-500 disabled:cursor-not-allowed disabled:opacity-40"><ShieldCheck className="h-5 w-5" /> Entrar a Superadmin Global</button>
            <p className="mt-4 text-center text-[10px] leading-relaxed text-zinc-600">El acceso vuelve a bloquearse al cambiar de perfil o recargar la página.</p>
          </form>
        </div>
      )}
    </header>
  );
};

import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { UserRole } from '../types';
import { promptPWAInstall } from '../lib/pwa';
import centralGoLogo from '../assets/images/central-go-logo.svg';
import {
  Crown,
  Bell,
  Volume2,
  VolumeX,
  Smartphone,
  UserCheck,
  Building2,
  Radio,
  ChevronDown,
  ShieldCheck,
  Headphones,
  Car,
  Settings,
  HelpCircle,
  Download,
  Zap,
  ShieldAlert,
} from 'lucide-react';

interface HeaderProps {
  onToggleNotifications: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onToggleNotifications }) => {
  const {
    currentRole,
    setCurrentRole,
    currentUser,
    currentCompany,
    companies,
    setCurrentCompany,
    soundMuted,
    toggleSound,
    notifications,
    setNewTripModalOpen,
    drivers,
    triggerDriverSOS,
    activeSOSDriver,
    setActiveSOSDriver,
    setActiveModule,
  } = useApp();

  const [roleMenuOpen, setRoleMenuOpen] = useState(false);
  const [companyMenuOpen, setCompanyMenuOpen] = useState(false);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const rolesList: { role: UserRole; label: string; icon: any; color: string }[] = [
    { role: 'operator', label: 'Central Operadora', icon: Headphones, color: 'text-blue-400' },
    { role: 'driver', label: 'Conductor (PWA Móvil)', icon: Car, color: 'text-emerald-400' },
    { role: 'company_admin', label: 'Admin Empresa', icon: Building2, color: 'text-amber-400' },
    { role: 'super_admin', label: 'Super Administrador', icon: ShieldCheck, color: 'text-purple-400' },
  ];

  const handleInstallClick = async () => {
    const installed = await promptPWAInstall();
    if (installed) {
      alert('¡Central Go instalado correctamente como PWA!');
    } else {
      alert('Para instalar en Android / Chrome: Abre las opciones del navegador y selecciona "Agregar a la pantalla principal" o "Instalar aplicación".');
    }
  };

  return (
    <header className="sticky top-0 z-40 w-full bg-[#0d0d0f] border-b border-zinc-800 px-6 py-3 shrink-0 shadow-xl">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
        {/* Left: Brand & Company Selector */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="relative">
              <img
                src={centralGoLogo}
                alt="Central Go Logo"
                className="w-11 h-11 rounded-xl border-2 border-amber-400/80 shadow-lg shadow-amber-500/30 object-cover bg-zinc-950 p-0.5 transform transition-transform hover:scale-105"
                referrerPolicy="no-referrer"
              />
              <span className="absolute -top-1 -right-1 flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500"></span>
              </span>
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-black text-xl tracking-tight text-white flex items-center gap-1">
                  CENTRAL <span className="text-amber-400 font-extrabold px-1.5 py-0.5 bg-amber-500/20 border border-amber-400/50 rounded-md shadow-sm">GO</span>
                </span>
              </div>
              <p className="text-[10px] text-amber-300/80 uppercase tracking-widest font-extrabold flex items-center gap-1.5 mt-0.5 font-mono">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse"></span>
                <span>Radiotaxis & Despacho GPS</span>
              </p>
            </div>
          </div>

          {/* Company Multi-tenant Selector */}
          <div className="relative hidden md:block border-l border-zinc-800 pl-4 ml-2">
            <button
              onClick={() => setCompanyMenuOpen(!companyMenuOpen)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-xs font-medium text-zinc-300 transition"
            >
              <Building2 className="w-3.5 h-3.5 text-blue-400" />
              <span className="truncate max-w-[150px] font-semibold">{currentCompany.name}</span>
              <ChevronDown className="w-3 h-3 text-zinc-500" />
            </button>

            {companyMenuOpen && (
              <div className="absolute top-full left-4 mt-2 w-56 bg-[#0d0d0f] border border-zinc-800 rounded-xl shadow-2xl z-50 p-1">
                <div className="px-3 py-1.5 text-[10px] uppercase font-mono font-bold text-zinc-500 tracking-wider">
                  Empresas Registradas
                </div>
                {companies.map((comp) => (
                  <button
                    key={comp.id}
                    onClick={() => {
                      setCurrentCompany(comp);
                      setCompanyMenuOpen(false);
                    }}
                    className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium flex items-center justify-between transition ${
                      comp.id === currentCompany.id
                        ? 'bg-blue-600/10 text-blue-400 border border-blue-500/20'
                        : 'text-zinc-300 hover:bg-zinc-800'
                    }`}
                  >
                    <span>{comp.name}</span>
                    <span className="text-[10px] font-mono bg-zinc-800 px-1.5 py-0.5 rounded text-zinc-400">
                      {comp.code}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Center: Quick Dispatch & SOS Test Button for Operators */}
        <div className="hidden lg:flex items-center gap-2">
          <button
            onClick={() => setNewTripModalOpen(true)}
            className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs shadow-lg shadow-amber-500/20 transition flex items-center gap-2 border border-amber-300 uppercase tracking-wider transform active:scale-95"
          >
            <Zap className="w-4 h-4 fill-slate-950" />
            <span>+ Nueva Carrera (Exprés)</span>
          </button>

          {/* Active SOS Alert Notification Button */}
          {activeSOSDriver && (
            <button
              onClick={() => setActiveSOSDriver(activeSOSDriver)}
              className="px-4 py-2 rounded-xl bg-red-600 text-white font-extrabold text-xs shadow-lg shadow-red-600/50 transition flex items-center gap-2 border border-red-400 uppercase tracking-wider animate-bounce"
            >
              <ShieldAlert className="w-4 h-4 text-white" />
              <span>🚨 VER ALERTA SOS ACTIVA ({activeSOSDriver.unitNumber})</span>
            </button>
          )}
        </div>

        {/* Right: Actions, Sound, PWA Install & Role Switcher */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Sound Toggle */}
          <button
            onClick={toggleSound}
            className={`p-2 rounded-lg border transition ${
              soundMuted
                ? 'bg-zinc-900 text-zinc-500 border-zinc-800 hover:bg-zinc-800'
                : 'bg-blue-500/10 text-blue-400 border-blue-500/20 hover:bg-blue-500/20'
            }`}
            title={soundMuted ? 'Activar Sonidos de Alerta' : 'Silenciar Sonidos'}
          >
            {soundMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>

          {/* Notifications Bell */}
          <button
            onClick={onToggleNotifications}
            className="relative p-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 transition"
            title="Centro de Notificaciones"
          >
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-blue-500 text-white font-bold text-[10px] flex items-center justify-center animate-pulse">
                {unreadCount}
              </span>
            )}
          </button>

          {/* PWA Install Button */}
          <button
            onClick={handleInstallClick}
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-200 rounded-lg text-xs font-semibold transition"
            title="Instalar PWA"
          >
            <Download className="w-3.5 h-3.5 text-blue-400" />
            <span>PWA App</span>
          </button>

          {/* Role Switcher Menu */}
          <div className="relative">
            <button
              onClick={() => setRoleMenuOpen(!roleMenuOpen)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-xs font-medium text-zinc-200 transition shadow-md"
            >
              <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></div>
              <span className="font-semibold">{rolesList.find((r) => r.role === currentRole)?.label}</span>
              <ChevronDown className="w-3.5 h-3.5 text-zinc-500" />
            </button>

            {roleMenuOpen && (
              <div className="absolute right-0 mt-2 w-64 bg-[#0d0d0f] border border-zinc-800 rounded-xl shadow-2xl z-50 p-2">
                <div className="px-3 py-1.5 text-[10px] font-mono font-bold text-zinc-500 uppercase border-b border-zinc-800 mb-1 tracking-wider">
                  Cambiar Rol de Pruebas
                </div>
                {rolesList.map(({ role, label, icon: Icon, color }) => (
                  <button
                    key={role}
                    onClick={() => {
                      setCurrentRole(role);
                      setActiveModule('dashboard');
                      setRoleMenuOpen(false);
                    }}
                    className={`w-full text-left px-3 py-2.5 rounded-lg text-xs font-medium flex items-center gap-2.5 transition ${
                      currentRole === role
                        ? 'bg-blue-600/10 text-blue-400 font-bold border border-blue-500/20'
                        : 'text-zinc-300 hover:bg-zinc-800'
                    }`}
                  >
                    <Icon className={`w-4 h-4 ${color}`} />
                    <span>{label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

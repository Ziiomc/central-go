import React, { useState, useEffect } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { DashboardModule } from './components/modules/DashboardModule';
import { OperatorConsole } from './components/modules/OperatorConsole';
import { LiveMap } from './components/map/LiveMap';
import { TripsModule } from './components/modules/TripsModule';
import { DriversModule } from './components/modules/DriversModule';
import { VehiclesModule } from './components/modules/VehiclesModule';
import { ClientsModule } from './components/modules/ClientsModule';
import { OperatorsModule } from './components/modules/OperatorsModule';
import { CompaniesModule } from './components/modules/CompaniesModule';
import { UsersModule } from './components/modules/UsersModule';
import { ReportsModule } from './components/modules/ReportsModule';
import { HistoryModule } from './components/modules/HistoryModule';
import { SettingsModule } from './components/modules/SettingsModule';
import { ProfileModule } from './components/modules/ProfileModule';
import { HelpModule } from './components/modules/HelpModule';
import { DriverMobileView } from './components/pwa/DriverMobileView';
import { NewTripModal } from './components/modals/NewTripModal';
import { SOSAlertModal } from './components/modals/SOSAlertModal';
import { TripDetailModal } from './components/modals/TripDetailModal';
import { VHFDispatchModal } from './components/modals/VHFDispatchModal';
import { NotificationsDrawer } from './components/notifications/NotificationsDrawer';
import { registerServiceWorker } from './lib/pwa';
import { Menu, Car, Headphones, Smartphone, Monitor } from 'lucide-react';

const MainAppContent: React.FC = () => {
  const { currentRole, activeModule, setNewTripModalOpen } = useApp();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [driverViewMode, setDriverViewMode] = useState<'mobile' | 'desktop'>('mobile');

  useEffect(() => {
    registerServiceWorker();
  }, []);

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if (event.key === 'F2' && currentRole === 'operator') {
        event.preventDefault();
        setNewTripModalOpen(true);
      }
    };
    window.addEventListener('keydown', handleShortcut);
    return () => window.removeEventListener('keydown', handleShortcut);
  }, [currentRole, setNewTripModalOpen]);

  // Render Module router
  const renderModule = () => {
    switch (activeModule) {
      case 'dashboard':
        return currentRole === 'operator' ? <OperatorConsole /> : <DashboardModule />;
      case 'live_map':
        return (
          <div className="space-y-4">
            <h1 className="font-extrabold text-2xl text-white">Mapa en Tiempo Real</h1>
            <LiveMap height="h-[calc(100vh-200px)]" />
          </div>
        );
      case 'trips':
        return <TripsModule />;
      case 'drivers':
        return <DriversModule />;
      case 'vehicles':
        return <VehiclesModule />;
      case 'clients':
        return <ClientsModule />;
      case 'operators':
        return <OperatorsModule />;
      case 'companies':
        return <CompaniesModule />;
      case 'users':
        return <UsersModule />;
      case 'reports':
        return <ReportsModule />;
      case 'history':
        return <HistoryModule />;
      case 'settings':
        return <SettingsModule />;
      case 'profile':
        return <ProfileModule />;
      case 'help':
        return <HelpModule />;
      default:
        return <DashboardModule />;
    }
  };

  return (
    <div className="min-h-screen bg-[#09090b] text-zinc-100 flex flex-col font-sans selection:bg-blue-500/30">
      {/* Header */}
      <Header onToggleNotifications={() => setNotificationsOpen(!notificationsOpen)} />

      {/* Driver Special PWA View Switcher Bar if currentRole is driver */}
      {currentRole === 'driver' ? (
        <div className="p-4 max-w-7xl mx-auto w-full">
          <div className="flex items-center justify-between bg-[#0d0d0f] p-2 rounded-xl border border-zinc-800 mb-4 shadow-xl">
            <div className="flex items-center gap-2 text-xs text-blue-400 font-bold px-3 uppercase tracking-wider">
              <Car className="w-4 h-4" />
              <span>Rol Conductor Activo</span>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setDriverViewMode('mobile')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 uppercase tracking-wider ${
                  driverViewMode === 'mobile'
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/30'
                    : 'bg-zinc-900 text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <Smartphone className="w-3.5 h-3.5" /> Vista PWA Smartphone
              </button>
              <button
                onClick={() => setDriverViewMode('desktop')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 uppercase tracking-wider ${
                  driverViewMode === 'desktop'
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/30'
                    : 'bg-zinc-900 text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <Monitor className="w-3.5 h-3.5" /> Vista Escritorio
              </button>
            </div>
          </div>

          {driverViewMode === 'mobile' ? (
            <DriverMobileView />
          ) : (
            <div className="flex flex-1 relative">
              <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
              <main className="flex-1 p-4 md:p-6 overflow-y-auto max-w-7xl mx-auto w-full">
                {renderModule()}
              </main>
            </div>
          )}
        </div>
      ) : (
        <div className="flex-1 flex relative">
          {/* Mobile Sidebar Toggle Button */}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="md:hidden fixed bottom-5 right-5 z-40 p-3.5 bg-blue-600 text-white rounded-full shadow-2xl font-bold border border-blue-400/30 shadow-blue-900/50"
            aria-label="Abrir Menú"
          >
            <Menu className="w-6 h-6" />
          </button>

          <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

          <main className="flex-1 p-4 md:p-6 overflow-y-auto max-w-7xl mx-auto w-full min-h-[calc(100vh-65px)]">
            {renderModule()}
          </main>
        </div>
      )}

      {/* Global Modals */}
      <NewTripModal />
      <SOSAlertModal />
      <TripDetailModal />
      <VHFDispatchModal />
      <NotificationsDrawer isOpen={notificationsOpen} onClose={() => setNotificationsOpen(false)} />
    </div>
  );
};

export default function App() {
  return (
    <AppProvider>
      <MainAppContent />
    </AppProvider>
  );
}

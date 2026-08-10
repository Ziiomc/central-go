import React, { useEffect, useState } from 'react';
import { useApp } from './context/AppContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { CommercialAppProvider } from './context/CommercialAppProvider';
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
import { CommercialGlobalAdminDashboard } from './components/modules/CommercialGlobalAdminDashboard';
import { PartnerDashboard } from './components/modules/PartnerDashboard';
import { CentralsNetworkModule } from './components/modules/CentralsNetworkModule';
import { PartnersNetworkModule } from './components/modules/PartnersNetworkModule';
import { CommissionsNetworkModule } from './components/modules/CommissionsNetworkModule';
import { PlansNetworkModule } from './components/modules/PlansNetworkModule';
import { NetworkSupportModule } from './components/modules/NetworkSupportModule';
import { DriverMobileView } from './components/pwa/DriverMobileView';
import { NewTripModal } from './components/modals/NewTripModal';
import { SOSAlertModal } from './components/modals/SOSAlertModal';
import { TripDetailModal } from './components/modals/TripDetailModal';
import { VHFDispatchModal } from './components/modals/VHFDispatchModal';
import { NotificationsDrawer } from './components/notifications/NotificationsDrawer';
import { LoginScreen } from './components/auth/LoginScreen';
import { PasswordSetupScreen } from './components/auth/PasswordSetupScreen';
import { registerServiceWorker } from './lib/pwa';
import { ErrorBoundary } from './components/system/ErrorBoundary';
import { CommercialGate } from './components/system/CommercialGate';
import { ArrowLeft, Loader2, Menu, ShieldAlert } from 'lucide-react';

const SalesDemoScreen = React.lazy(() =>
  import('./components/demo/SalesDemoScreen').then((module) => ({ default: module.SalesDemoScreen }))
);

const MainAppContent: React.FC = () => {
  const { currentRole, activeModule, setNewTripModalOpen } = useApp();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);

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

  const renderModule = () => {
    switch (activeModule) {
      case 'dashboard':
        if (currentRole === 'operator') return <OperatorConsole />;
        if (currentRole === 'super_admin') return <CommercialGlobalAdminDashboard />;
        if (currentRole === 'regional_partner' || currentRole === 'sales_partner') return <PartnerDashboard />;
        return <DashboardModule />;
      case 'network_centrals': return <CentralsNetworkModule />;
      case 'partners_network': return <PartnersNetworkModule />;
      case 'commissions_network': return <CommissionsNetworkModule />;
      case 'plans_network': return <PlansNetworkModule />;
      case 'network_support': return <NetworkSupportModule />;
      case 'live_map': return <div className="space-y-4"><h1 className="font-extrabold text-2xl text-white">Mapa en Tiempo Real</h1><LiveMap height="h-[calc(100vh-200px)]" /></div>;
      case 'trips': return <TripsModule />;
      case 'drivers': return <DriversModule />;
      case 'vehicles': return <VehiclesModule />;
      case 'clients': return <ClientsModule />;
      case 'operators': return <OperatorsModule />;
      case 'companies': return <CompaniesModule />;
      case 'users': return <UsersModule />;
      case 'reports': return <ReportsModule />;
      case 'history': return <HistoryModule />;
      case 'settings': return <SettingsModule />;
      case 'profile': return <ProfileModule />;
      case 'help': return <HelpModule />;
      default: return <DashboardModule />;
    }
  };

  return (
    <div className="min-h-screen bg-[#09090b] text-zinc-100 flex flex-col font-sans selection:bg-blue-500/30">
      <Header onToggleNotifications={() => setNotificationsOpen(!notificationsOpen)} />
      <div className="flex-1 flex relative">
        <button onClick={() => setSidebarOpen(!sidebarOpen)} className="md:hidden fixed bottom-5 right-5 z-40 p-3.5 bg-blue-600 text-white rounded-full shadow-2xl font-bold border border-blue-400/30" aria-label="Abrir menú"><Menu className="w-6 h-6" /></button>
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <main className={`flex-1 overflow-y-auto mx-auto w-full min-h-[calc(100vh-65px)] ${currentRole === 'operator' ? 'p-2.5 md:p-3 max-w-[1800px]' : ['super_admin', 'regional_partner', 'sales_partner'].includes(currentRole) ? 'p-4 md:p-6 max-w-[1600px]' : 'p-4 md:p-6 max-w-7xl'}`}>{renderModule()}</main>
      </div>
      <NewTripModal />
      <SOSAlertModal />
      <TripDetailModal />
      <VHFDispatchModal />
      <NotificationsDrawer isOpen={notificationsOpen} onClose={() => setNotificationsOpen(false)} />
    </div>
  );
};

const WrongDriverRoute: React.FC = () => (
  <main className="min-h-screen bg-zinc-950 p-5 text-zinc-100 flex items-center justify-center">
    <section className="w-full max-w-md rounded-3xl border border-amber-500/25 bg-[#0d0d0f] p-7 text-center">
      <ShieldAlert className="mx-auto h-9 w-9 text-amber-300" />
      <h1 className="mt-4 text-xl font-black">Acceso exclusivo para conductores</h1>
      <p className="mt-2 text-sm text-zinc-400">Esta ruta instala y abre la app móvil del conductor. Tu cuenta utiliza el panel web de Central GO.</p>
      <button onClick={() => { window.location.href = '/'; }} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-amber-400 px-4 py-3 text-xs font-black text-zinc-950"><ArrowLeft className="h-4 w-4" />Volver al panel</button>
    </section>
  </main>
);

const AuthenticatedShell: React.FC = () => {
  const { session, authUser, loading, effectiveRole } = useAuth();
  const driverPath = window.location.pathname === '/driver' || window.location.pathname.startsWith('/driver/');
  const recoveryPath = window.location.pathname === '/reset-password' || window.location.pathname.startsWith('/reset-password/');
  const needsPasswordSetup = Boolean(authUser?.user_metadata?.needs_password_setup);

  useEffect(() => {
    registerServiceWorker();
  }, []);

  useEffect(() => {
    if (!loading && session && !needsPasswordSetup && !recoveryPath && effectiveRole === 'driver' && !driverPath) {
      window.location.replace('/driver');
    }
  }, [loading, session, effectiveRole, driverPath, recoveryPath, needsPasswordSetup]);

  if (loading) return <main className="min-h-screen bg-zinc-950 text-zinc-200 flex items-center justify-center"><div className="flex items-center gap-3 text-sm font-bold"><Loader2 className="h-5 w-5 animate-spin text-amber-400" />Validando sesión segura…</div></main>;
  if (!session) return <LoginScreen />;
  if (needsPasswordSetup || recoveryPath) return <PasswordSetupScreen recovery={recoveryPath} />;
  if (effectiveRole === 'driver' && !driverPath) return <main className="min-h-screen bg-zinc-950 text-zinc-300 flex items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-amber-400" /></main>;
  if (driverPath && effectiveRole !== 'driver') return <WrongDriverRoute />;
  if (driverPath) return <CommercialAppProvider><DriverMobileView /></CommercialAppProvider>;
  return <CommercialAppProvider><MainAppContent /></CommercialAppProvider>;
};

export default function App() {
  const demoRequested = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('demo') === '1';

  if (demoRequested) {
    return (
      <ErrorBoundary>
        <React.Suspense fallback={<main className="min-h-screen bg-zinc-950 text-zinc-300 flex items-center justify-center"><div className="flex items-center gap-3 text-sm font-bold"><Loader2 className="h-5 w-5 animate-spin text-amber-400" />Preparando demo comercial…</div></main>}>
          <SalesDemoScreen />
        </React.Suspense>
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary>
      <AuthProvider>
        <CommercialGate>
          <AuthenticatedShell />
        </CommercialGate>
      </AuthProvider>
    </ErrorBoundary>
  );
}

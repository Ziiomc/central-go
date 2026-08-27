import React,{lazy,Suspense,useEffect,useState} from 'react';
import {useApp} from './context/AppContext';import {AuthProvider,useAuth} from './context/AuthContext';import {CommercialAppProvider} from './context/CommercialAppProvider';
import {Header} from './components/Header';import {Sidebar} from './components/Sidebar';import {DriverMobileShell} from './components/pwa/DriverMobileShell';import {DriverToCentralRadioPanel} from './components/pwa/DriverToCentralRadioPanel';import {DriverPriorityCounter} from './components/pwa/DriverPriorityCounter';import {CentralRadioReceiver} from './components/radio/CentralRadioReceiver';import {OperatorRadioLauncher} from './components/radio/OperatorRadioLauncher';
import {NewTripModal} from './components/modals/NewTripModal';import {SOSAlertModal} from './components/modals/SOSAlertModal';import {TripDetailModal} from './components/modals/TripDetailModal';import {VHFDispatchModal} from './components/modals/VHFDispatchModal';import {NotificationsDrawer} from './components/notifications/NotificationsDrawer';import {LoginScreen} from './components/auth/LoginScreen';import {OnboardingScreen} from './components/auth/OnboardingScreen';import {PartnerApplicationStatusScreen} from './components/auth/PartnerApplicationStatusScreen';import {DriverOnboardingPortal} from './components/driver/DriverOnboardingPortal';import {OperatorOnboardingPortal} from './components/operator/OperatorOnboardingPortal';import {registerServiceWorker} from './lib/pwa';import {ErrorBoundary} from './components/system/ErrorBoundary';import {CommercialGate} from './components/system/CommercialGate';import {TrialGate} from './components/system/TrialGate';import {SessionBackGuard,type CentralGoBackDetail} from './components/system/SessionBackGuard';import {ArrowLeft,Loader2,ShieldAlert,ShieldCheck} from 'lucide-react';
import {AuthShell} from './components/auth/AuthShell';
import {OperatorRealtimeWatchdog} from './components/system/OperatorRealtimeWatchdog';

const DashboardModule=lazy(()=>import('./components/modules/DashboardModule').then(module=>({default:module.DashboardModule})));
const OperatorWorkspace=lazy(()=>import('./components/modules/OperatorWorkspace').then(module=>({default:module.OperatorWorkspace})));
const LiveMap=lazy(()=>import('./components/map/LiveMap').then(module=>({default:module.LiveMap})));
const TripsModule=lazy(()=>import('./components/modules/TripsModule').then(module=>({default:module.TripsModule})));
const ReservationsModule=lazy(()=>import('./components/modules/ReservationsModule').then(module=>({default:module.ReservationsModule})));
const DriversModule=lazy(()=>import('./components/modules/DriversModule').then(module=>({default:module.DriversModule})));
const VehiclesModule=lazy(()=>import('./components/modules/VehiclesModule').then(module=>({default:module.VehiclesModule})));
const ClientsModule=lazy(()=>import('./components/modules/ClientsModule').then(module=>({default:module.ClientsModule})));
const OperatorsModule=lazy(()=>import('./components/modules/OperatorsModule').then(module=>({default:module.OperatorsModule})));
const CompaniesModule=lazy(()=>import('./components/modules/CompaniesModule').then(module=>({default:module.CompaniesModule})));
const UsersModule=lazy(()=>import('./components/modules/UsersModule').then(module=>({default:module.UsersModule})));
const ReportsModule=lazy(()=>import('./components/modules/ReportsModule').then(module=>({default:module.ReportsModule})));
const HistoryModule=lazy(()=>import('./components/modules/HistoryModule').then(module=>({default:module.HistoryModule})));
const SettingsModule=lazy(()=>import('./components/modules/SettingsModule').then(module=>({default:module.SettingsModule})));
const ProfileModule=lazy(()=>import('./components/modules/ProfileModule').then(module=>({default:module.ProfileModule})));
const HelpModule=lazy(()=>import('./components/modules/HelpModule').then(module=>({default:module.HelpModule})));
const CommercialGlobalAdminDashboard=lazy(()=>import('./components/modules/CommercialGlobalAdminDashboard').then(module=>({default:module.CommercialGlobalAdminDashboard})));
const PartnerDashboard=lazy(()=>import('./components/modules/PartnerDashboard').then(module=>({default:module.PartnerDashboard})));
const CentralsNetworkModule=lazy(()=>import('./components/modules/CentralsNetworkModule').then(module=>({default:module.CentralsNetworkModule})));
const PartnersNetworkModule=lazy(()=>import('./components/modules/PartnersNetworkModule').then(module=>({default:module.PartnersNetworkModule})));
const CommissionsNetworkModule=lazy(()=>import('./components/modules/CommissionsNetworkModule').then(module=>({default:module.CommissionsNetworkModule})));
const PlansNetworkModule=lazy(()=>import('./components/modules/PlansNetworkModule').then(module=>({default:module.PlansNetworkModule})));
const NetworkSupportModule=lazy(()=>import('./components/modules/NetworkSupportModule').then(module=>({default:module.NetworkSupportModule})));
const PlatformPaymentsModule=lazy(()=>import('./components/modules/PlatformPaymentsModule').then(module=>({default:module.PlatformPaymentsModule})));

const ModuleLoader=()=> <div className="flex min-h-72 items-center justify-center" role="status" aria-live="polite"><Loader2 className="h-6 w-6 animate-spin text-[var(--cg-primary)]"/><span className="sr-only">Cargando módulo</span></div>;
const MODULE_ACCESS:Record<string,string[]>={dashboard:['super_admin','regional_partner','sales_partner','company_admin','operator'],network_centrals:['super_admin','regional_partner','sales_partner'],partners_network:['super_admin','regional_partner'],commissions_network:['super_admin','regional_partner','sales_partner'],plans_network:['super_admin','regional_partner','sales_partner'],network_support:['super_admin','regional_partner','sales_partner'],payments:['super_admin'],live_map:['super_admin'],trips:['company_admin','operator'],reservations:['company_admin','operator'],drivers:['company_admin','operator'],vehicles:['company_admin'],clients:['company_admin','operator'],operators:['company_admin'],companies:['super_admin'],users:['super_admin'],reports:['company_admin'],history:['super_admin','company_admin'],settings:['super_admin','company_admin'],profile:['super_admin','regional_partner','sales_partner','company_admin','operator'],help:['super_admin','regional_partner','sales_partner','company_admin','operator']};

const FIRE_MODE_STORAGE_KEY='centralgo:superadmin-fire-mode';
const FIRE_MODE_OWNER='ziiomc3@gmail.com';
const readFireModePreference=()=>{try{return window.localStorage.getItem(FIRE_MODE_STORAGE_KEY)!=='off';}catch{return true;}};

const MainAppContent:React.FC=()=>{
 const{currentRole,activeModule,setActiveModule,newTripModalOpen,setNewTripModalOpen,selectedTripForDetail,setSelectedTripForDetail,vhfModalDriver,setVHFModalDriver}=useApp();
 const{authUser}=useAuth();
 const[sidebarOpen,setSidebarOpen]=useState(false);
 const[notificationsOpen,setNotificationsOpen]=useState(false);
 const isFireOwner=currentRole==='super_admin'&&authUser?.email?.trim().toLowerCase()===FIRE_MODE_OWNER;
 const[fireMode,setFireMode]=useState(readFireModePreference);

 const toggleFireMode=()=>setFireMode((enabled)=>{
  const next=!enabled;
  try{window.localStorage.setItem(FIRE_MODE_STORAGE_KEY,next?'on':'off');}catch{/* Keep the choice for this session. */}
  return next;
 });

 useEffect(()=>{
  const h=(e:KeyboardEvent)=>{
   const canDispatch=['operator','company_admin','super_admin'].includes(currentRole);
   if(!canDispatch)return;
   const target=e.target as HTMLElement|null;
   const typing=['INPUT','TEXTAREA','SELECT'].includes(target?.tagName||'');
   const key=e.key.toLowerCase();
   const code=e.code;
   if(key==='f2'||code==='F2'){e.preventDefault();e.stopPropagation();setNewTripModalOpen(true);return;}
   if((key==='f3'||code==='F3')&&!typing){e.preventDefault();e.stopPropagation();window.dispatchEvent(new CustomEvent('centralgo:toggle-queue-view'));return;}
   if((e.ctrlKey||e.metaKey)&&key==='k'){e.preventDefault();e.stopPropagation();if(activeModule!=='dashboard')setActiveModule('dashboard');window.setTimeout(()=>window.dispatchEvent(new CustomEvent('centralgo:focus-search')),80);return;}
   if(key==='escape'){
    e.preventDefault();
    e.stopPropagation();
    if(vhfModalDriver){setVHFModalDriver(null);return;}
    if(newTripModalOpen){setNewTripModalOpen(false);return;}
    if(selectedTripForDetail){setSelectedTripForDetail(null);return;}
    if(notificationsOpen){setNotificationsOpen(false);return;}
    if(sidebarOpen){setSidebarOpen(false);return;}
    window.dispatchEvent(new CustomEvent('centralgo:escape'));
   }
  };
  window.addEventListener('keydown',h,true);
  return()=>window.removeEventListener('keydown',h,true);
 },[currentRole,activeModule,newTripModalOpen,selectedTripForDetail,vhfModalDriver,notificationsOpen,sidebarOpen,setActiveModule,setNewTripModalOpen,setSelectedTripForDetail,setVHFModalDriver]);

 useEffect(()=>{
  const handleBack=(event:Event)=>{
   const detail=(event as CustomEvent<CentralGoBackDetail>).detail;
   if(!detail)return;
   if(vhfModalDriver){setVHFModalDriver(null);detail.handled=true;return;}
   if(newTripModalOpen){setNewTripModalOpen(false);detail.handled=true;return;}
   if(selectedTripForDetail){setSelectedTripForDetail(null);detail.handled=true;return;}
   if(notificationsOpen){setNotificationsOpen(false);detail.handled=true;return;}
   if(sidebarOpen){setSidebarOpen(false);detail.handled=true;return;}
   if(activeModule!=='dashboard'){setActiveModule('dashboard');detail.handled=true;}
  };
  window.addEventListener('centralgo:hardware-back',handleBack);
  return()=>window.removeEventListener('centralgo:hardware-back',handleBack);
 },[activeModule,newTripModalOpen,selectedTripForDetail,vhfModalDriver,notificationsOpen,sidebarOpen,setActiveModule,setNewTripModalOpen,setSelectedTripForDetail,setVHFModalDriver]);

 const authorized=(module:string)=>MODULE_ACCESS[module]?.includes(currentRole)??false;
 useEffect(()=>{if(!authorized(activeModule))setActiveModule('dashboard');},[activeModule,currentRole,setActiveModule]);
 useEffect(()=>{if(currentRole==='super_admin'&&new URLSearchParams(window.location.search).has('mercadopago'))setActiveModule('payments');},[currentRole,setActiveModule]);

 const render=()=>{
  if(!authorized(activeModule))return currentRole==='super_admin'?<CommercialGlobalAdminDashboard/>:<DashboardModule/>;
  switch(activeModule){
   case'dashboard':if(currentRole==='operator'||currentRole==='company_admin')return <OperatorWorkspace/>;if(currentRole==='super_admin')return <CommercialGlobalAdminDashboard/>;if(currentRole==='regional_partner'||currentRole==='sales_partner')return <PartnerDashboard/>;return <DashboardModule/>;
   case'network_centrals':return <CentralsNetworkModule/>;case'partners_network':return <PartnersNetworkModule/>;case'commissions_network':return <CommissionsNetworkModule/>;case'plans_network':return <PlansNetworkModule/>;case'network_support':return <NetworkSupportModule/>;case'payments':return <PlatformPaymentsModule/>;case'live_map':return <div className="space-y-4"><h1 className="text-2xl font-extrabold text-white">Mapa en Tiempo Real</h1><LiveMap height="h-[calc(100vh-200px)]"/></div>;case'trips':return <TripsModule/>;case'reservations':return <ReservationsModule/>;case'drivers':return <DriversModule/>;case'vehicles':return <VehiclesModule/>;case'clients':return <ClientsModule/>;case'operators':return <OperatorsModule/>;case'companies':return <CompaniesModule/>;case'users':return <UsersModule/>;case'reports':return <ReportsModule/>;case'history':return <HistoryModule/>;case'settings':return <SettingsModule/>;case'profile':return <ProfileModule/>;case'help':return <HelpModule/>;default:return <DashboardModule/>;
  }
 };

 return <div className={`cg-operational min-h-screen bg-[#09090b] text-zinc-100 flex flex-col ${isFireOwner&&fireMode?'cg-fire-mode':''}`}><Header onToggleMenu={()=>setSidebarOpen(open=>!open)} onToggleNotifications={()=>setNotificationsOpen(open=>!open)} fireModeAvailable={isFireOwner} fireModeEnabled={isFireOwner&&fireMode} onToggleFireMode={toggleFireMode}/><div className="flex-1 flex relative"><Sidebar isOpen={sidebarOpen} onClose={()=>setSidebarOpen(false)}/><main className={`cg-main flex-1 overflow-y-auto mx-auto w-full min-h-[calc(100vh-65px)] ${['operator','company_admin'].includes(currentRole)?'p-2 md:p-2.5 max-w-[1900px]':['super_admin','regional_partner','sales_partner'].includes(currentRole)?'p-4 md:p-6 max-w-[1600px]':'p-4 md:p-6 max-w-7xl'}`}><Suspense fallback={<ModuleLoader/>}>{render()}</Suspense></main></div><OperatorRealtimeWatchdog/><NewTripModal/><SOSAlertModal/><TripDetailModal/><VHFDispatchModal/><CentralRadioReceiver/><OperatorRadioLauncher/><NotificationsDrawer isOpen={notificationsOpen} onClose={()=>setNotificationsOpen(false)}/></div>;
};

const PasswordSetupGate:React.FC=()=>{const{updatePassword}=useAuth();const[password,setPassword]=useState(''),[confirm,setConfirm]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');const submit=async(e:React.FormEvent)=>{e.preventDefault();setError('');if(password.length<10){setError('Usa al menos 10 caracteres.');return;}if(password!==confirm){setError('Las contraseñas no coinciden.');return;}setBusy(true);try{await updatePassword(password);window.location.replace('/');}catch(err){setError(err instanceof Error?err.message:'No fue posible guardar la contraseña.');setBusy(false);}};return <AuthShell compact><div className="flex items-center gap-3"><span className="cg-role-icon h-12 w-12"><ShieldCheck className="h-6 w-6"/></span><div><p className="cg-card-kicker">Central GO · Cuenta verificada</p><h1 className="cg-card-title text-xl">Crea tu contraseña</h1></div></div><p className="cg-card-copy mt-5">Google confirmó tu correo. Crea una contraseña personal para que desde ahora puedas entrar con Google o escribiendo tu correo y contraseña.</p><form onSubmit={submit} className="cg-form mt-5"><label className="cg-field"><span>Contraseña</span><input required minLength={10} type="password" autoComplete="new-password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Mínimo 10 caracteres"/></label><label className="cg-field"><span>Repetir contraseña</span><input required minLength={10} type="password" autoComplete="new-password" value={confirm} onChange={e=>setConfirm(e.target.value)} placeholder="Repite tu contraseña"/></label>{error&&<div className="cg-alert cg-alert-error mt-0">{error}</div>}<button disabled={busy} className="cg-primary-button">{busy?<Loader2 className="h-4 w-4 animate-spin"/>:<ShieldCheck className="h-4 w-4"/>}{busy?'Guardando…':'Guardar contraseña y entrar'}</button><p className="cg-auth-hint">Después podrás usar cualquiera de las dos opciones de inicio de sesión.</p></form></AuthShell>};
const WrongDriverRoute=()=> <AuthShell compact><div className="text-center"><ShieldAlert className="mx-auto h-9 w-9 text-[var(--cg-primary)]"/><h1 className="cg-card-title mt-4 text-xl">Acceso exclusivo para conductores</h1><p className="cg-card-copy">Esta ruta pertenece a la aplicación móvil del conductor.</p><button onClick={()=>location.href='/'} className="cg-primary-button mt-5"><ArrowLeft className="h-4 w-4"/>Volver al panel</button></div></AuthShell>;
const IdentityErrorScreen:React.FC<{message:string}>=({message})=><AuthShell compact><div className="text-center"><ShieldAlert className="mx-auto h-9 w-9 text-rose-400"/><h1 className="cg-card-title mt-4 text-xl">No pudimos validar tu cuenta</h1><p className="cg-card-copy">{message}</p><button onClick={()=>location.reload()} className="cg-primary-button mt-5">Reintentar</button><p className="cg-auth-hint">No crees otra cuenta mientras aparece este mensaje.</p></div></AuthShell>;
const AuthenticatedShell:React.FC=()=>{const{session,authUser,loading,effectiveRole,profile,memberships,saasAccount,partnerApplication,identityError}=useAuth();const driverPath=location.pathname.startsWith('/driver');const needsPasswordSetup=Boolean(authUser?.user_metadata?.needs_password_setup);const pendingOperatorGoogleValidation=Boolean(authUser?.user_metadata?.operator_invite)&&!memberships.some(membership=>membership.role==='operator'&&membership.active);useEffect(()=>{registerServiceWorker();},[]);if(loading)return <main className="cg-auth-shell items-center justify-center"><div className="cg-card flex items-center gap-3 px-5 py-4"><Loader2 className="h-5 w-5 animate-spin text-[var(--cg-primary)]"/><span className="text-xs font-black text-[var(--cg-muted)]">Abriendo Central GO…</span></div></main>;if(!session)return <LoginScreen/>;if(needsPasswordSetup&&!pendingOperatorGoogleValidation)return <PasswordSetupGate/>;const configured=Boolean(profile?.globalRole)||Boolean(saasAccount)||memberships.length>0;if(identityError&&!configured)return <IdentityErrorScreen message={identityError}/>;if(!configured)return <OnboardingScreen/>;if(saasAccount?.accountKind==='sales_partner'&&!profile?.globalRole)return <PartnerApplicationStatusScreen/>;if(partnerApplication?.status==='pending'&&!profile?.globalRole)return <PartnerApplicationStatusScreen/>;if(saasAccount?.accountKind==='driver'&&effectiveRole!=='driver')return <DriverOnboardingPortal/>;if(saasAccount?.accountKind==='operator'&&effectiveRole!=='operator')return <OperatorOnboardingPortal/>;if(effectiveRole==='driver'&&!driverPath){location.replace('/driver');return null;}if(driverPath&&effectiveRole!=='driver')return <WrongDriverRoute/>;if(driverPath)return <CommercialAppProvider><div className="cg-operational"><DriverMobileShell/><DriverPriorityCounter/><DriverToCentralRadioPanel/></div></CommercialAppProvider>;return <CommercialAppProvider><TrialGate><MainAppContent/></TrialGate></CommercialAppProvider>};
export default function App(){return <ErrorBoundary><AuthProvider><SessionBackGuard/><CommercialGate><AuthenticatedShell/></CommercialGate></AuthProvider></ErrorBoundary>}


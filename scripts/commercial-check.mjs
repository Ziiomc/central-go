import fs from 'node:fs';

const fail = (message) => { console.error('OFFICIAL CHECK FAILED:', message); process.exitCode = 1; };
const mustRead = (file) => { if (!fs.existsSync(file)) { fail(`Falta archivo obligatorio: ${file}`); return ''; } return fs.readFileSync(file, 'utf8'); };

const pkg = JSON.parse(mustRead('package.json') || '{}');
const vercel = JSON.parse(mustRead('vercel.json') || '{}');
const app = mustRead('src/App.tsx');
const runtime = mustRead('src/config/runtime.ts');
const header = mustRead('src/components/Header.tsx');
const driver = mustRead('src/components/pwa/DriverMobileView.tsx');
const login = mustRead('src/components/auth/LoginScreen.tsx');
const auth = mustRead('src/context/AuthContext.tsx');
const onboarding = mustRead('src/components/auth/SelfServiceOnboarding.tsx');
const saasGate = mustRead('src/components/billing/SaasAccessGate.tsx');
const saasRepo = mustRead('src/lib/saasAccessRepository.ts');
const plans = mustRead('src/components/network/PlanComparison.tsx');
const users = mustRead('src/components/modules/UsersModule.tsx');
const partnerDashboard = mustRead('src/components/modules/PartnerDashboard.tsx');
const migrationCore = mustRead('supabase/migrations/001_commercial_core.sql');
const migrationSecurity = mustRead('supabase/migrations/002_security_rpc.sql');
const migrationPrivileges = mustRead('supabase/migrations/003_explicit_privileges.sql');
const migrationSaas = mustRead('supabase/migrations/023_saas_self_service_five_day_trial.sql');
const driverManifest = mustRead('public/driver-manifest.json');

if ((pkg.scripts?.build ?? '').includes('bootstrap')) fail('El build volvió a depender de capas bootstrap.');
if (!pkg.scripts?.lint?.includes('tsc')) fail('Falta TypeScript obligatorio.');
if (!app.includes('CommercialGate') || !app.includes('ErrorBoundary')) fail('Faltan guardas globales de producción/error.');
if (!app.includes('SelfServiceOnboarding') || !app.includes('SaasAccessGate')) fail('Falta onboarding/paywall SaaS en el árbol oficial.');
if (app.includes('SalesDemoScreen') || app.includes("get('demo')") || app.includes('demoRequested')) fail('La app oficial volvió a montar un modo demo público.');
if (!app.includes("window.location.replace('/driver')")) fail('Falta redirección automática a la app independiente del conductor.');

for (const required of ["mode: 'official'", 'isDemo: false', 'isCommercial: true', 'commercialBackendIntegrated = true']) {
  if (!runtime.includes(required)) fail(`Runtime oficial incompleto: ${required}`);
}

for (const forbidden of ['SUPERADMIN_PIN_HASH', 'handleLogoClick', 'showRoleSelector', 'Cambiar rol (Demo)']) {
  if (header.includes(forbidden)) fail(`Cabecera oficial contiene acceso/selector demo: ${forbidden}`);
}

for (const forbidden of ['Simular como Móvil', 'Transmitir PTT', 'Simular carrera nueva', 'sendTestTrip']) {
  if (driver.includes(forbidden)) fail(`App de conductor contiene control de demostración: ${forbidden}`);
}
for (const required of ['promptPWAInstall', 'isPWAStandalone', 'watchPosition', 'SOS DE EMERGENCIA']) {
  if (!driver.includes(required)) fail(`App de conductor oficial incompleta: ${required}`);
}
if (!driverManifest.includes('Central GO Conductor') || !driverManifest.includes('"start_url": "/driver"')) fail('Manifest independiente del conductor incompleto.');

for (const required of ['Continuar con Google','5 días','Registrar Central','Partner Comercial']) if (!login.includes(required)) fail(`Login SaaS incompleto: ${required}`);
if (login.includes('Modo Demo') || login.includes('Crear cuenta segura')) fail('El login oficial volvió a exponer demo/registro por contraseña.');
if (!auth.includes("provider: 'google'") || !auth.includes('signInWithOAuth') || !auth.includes('runtimeConfig.officialAppUrl')) fail('Google OAuth no está conectado al AuthContext oficial.');

for (const required of ['central','sales_partner','Comenzar mis 5 días gratis','completeSelfServiceOnboarding']) if (!onboarding.includes(required)) fail(`Onboarding autoservicio incompleto: ${required}`);
for (const required of ['loadMyAccessState','requestAccountActivation','Tu prueba gratuita terminó','PlanCard']) if (!saasGate.includes(required)) fail(`Paywall SaaS incompleto: ${required}`);
for (const required of ['centralgo_my_access_state','centralgo_self_service_onboarding','centralgo_request_activation']) if (!saasRepo.includes(required)) fail(`Repositorio SaaS incompleto: ${required}`);

for (const required of ['loadPlanCatalog', '<X ', 'App independiente para conductores', 'Múltiples sedes y ciudades', 'API e integraciones']) {
  if (!plans.includes(required)) fail(`Comparador de planes incompleto: ${required}`);
}
for (const required of ['loadCompanyUsers', 'inviteCompanyUser', 'Invitar usuario']) {
  if (!users.includes(required)) fail(`Gestión real de usuarios incompleta: ${required}`);
}
for (const required of ['loadPartnerDashboard', 'PlanComparison', 'Registrar nueva central']) {
  if (!partnerDashboard.includes(required)) fail(`Panel real de partner incompleto: ${required}`);
}

for (const required of ['create table public.saas_accounts','create table public.activation_requests','centralgo_self_service_onboarding','centralgo_my_access_state','centralgo_company_access_allowed','centralgo_partner_access_allowed','centralgo_cap_trial_subscription',"interval '5 days'",'centralgo_guard_company_write']) {
  if (!migrationSaas.includes(required)) fail(`Contrato SaaS SQL incompleto: ${required}`);
}

const globalHeaders = vercel.headers?.find((item) => item.source === '/(.*)')?.headers ?? [];
for (const key of ['X-Content-Type-Options', 'Referrer-Policy', 'Permissions-Policy', 'Content-Security-Policy']) {
  if (!globalHeaders.some((header) => header.key === key)) fail('Falta header de seguridad: ' + key);
}

for (const forbidden of ['.network', '.operations-pro', '.operator-layout', '.road-routes', 'selection-fix-bootstrap.mjs']) {
  if (fs.existsSync(forbidden)) fail('Artefacto temporal reapareció: ' + forbidden);
}

for (const table of ['profiles', 'companies', 'company_memberships', 'vehicles', 'drivers', 'driver_locations', 'clients', 'trips', 'audit_logs']) {
  if (!migrationCore.includes(`alter table public.${table} enable row level security;`)) fail(`RLS obligatorio ausente para public.${table}`);
}
for (const requiredSnippet of ['revoke update on table public.profiles from authenticated;','grant update (name, phone, avatar_url) on table public.profiles to authenticated;','revoke insert, update, delete on table public.audit_logs from authenticated;','centralgo_driver_report_location','centralgo_driver_transition_trip','centralgo_write_audit']) {
  if (!migrationSecurity.includes(requiredSnippet)) fail(`Hardening SQL obligatorio ausente: ${requiredSnippet}`);
}
for (const requiredSnippet of ['from anon, authenticated;','grant select on public.company_memberships to authenticated;','grant select, insert, update on public.trips to authenticated;','grant select on public.audit_logs to authenticated;']) {
  if (!migrationPrivileges.includes(requiredSnippet)) fail(`Matriz de privilegios SQL incompleta: ${requiredSnippet}`);
}

if (!process.exitCode) console.log('Central GO SaaS 5-day static checks: OK');

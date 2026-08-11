import fs from 'node:fs';

const fail = (message) => {
  console.error('OFFICIAL CHECK FAILED:', message);
  process.exitCode = 1;
};

const mustRead = (file) => {
  if (!fs.existsSync(file)) {
    fail(`Falta archivo obligatorio: ${file}`);
    return '';
  }
  return fs.readFileSync(file, 'utf8');
};

const pkg = JSON.parse(mustRead('package.json') || '{}');
const vercel = JSON.parse(mustRead('vercel.json') || '{}');
const app = mustRead('src/App.tsx');
const auth = mustRead('src/context/AuthContext.tsx');
const runtime = mustRead('src/config/runtime.ts');
const header = mustRead('src/components/Header.tsx');
const driver = mustRead('src/components/pwa/DriverMobileView.tsx');
const login = mustRead('src/components/auth/LoginScreen.tsx');
const plans = mustRead('src/components/network/PlanComparison.tsx');
const users = mustRead('src/components/modules/UsersModule.tsx');
const partnerDashboard = mustRead('src/components/modules/PartnerDashboard.tsx');
const migrationCore = mustRead('supabase/migrations/001_commercial_core.sql');
const migrationSecurity = mustRead('supabase/migrations/002_security_rpc.sql');
const migrationPrivileges = mustRead('supabase/migrations/003_explicit_privileges.sql');
const migrationOfficial = mustRead('supabase/migrations/016_official_partner_users_and_plan_catalog.sql');
const migrationPartners = mustRead('supabase/migrations/017_official_visible_partner_directory.sql');
const migrationCommissions = mustRead('supabase/migrations/018_official_visible_commission_ledger.sql');
const migrationEntitlements = mustRead('supabase/migrations/019_official_partner_audit_and_plan_entitlements.sql');
const driverManifest = mustRead('public/driver-manifest.json');
const inviteCompanyUser = mustRead('supabase/functions/invite-company-user/index.ts');
const inviteNetworkUser = mustRead('supabase/functions/invite-network-user/index.ts');

if ((pkg.scripts?.build ?? '').includes('bootstrap')) fail('El build volvió a depender de capas bootstrap.');
if (!pkg.scripts?.lint?.includes('tsc')) fail('Falta TypeScript obligatorio.');
if (!app.includes('CommercialGate') || !app.includes('ErrorBoundary')) fail('Faltan guardas globales de producción/error.');
if (app.includes("import { AppProvider")) fail('App oficial volvió a importar el provider demo.');
if (!app.includes("location.replace('/driver')")) fail('Falta redirección automática a la app independiente del conductor.');
if (!app.includes('PasswordSetupGate') || !app.includes('needs_password_setup')) fail('Falta onboarding de contraseña para invitaciones.');
if (!auth.includes('updatePassword') || !auth.includes('needs_password_setup:false')) fail('El flujo de activación no completa la creación de contraseña.');

for (const required of ["mode: 'official'", 'isDemo: false', 'isCommercial: true', 'commercialBackendIntegrated = true', "OFFICIAL_APP_URL = 'https://central-go-one.vercel.app'"]) {
  if (!runtime.includes(required)) fail(`Runtime oficial incompleto: ${required}`);
}

for (const forbidden of ['SUPERADMIN_PIN_HASH', 'handleLogoClick', 'showRoleSelector', 'Cambiar rol (Demo)']) {
  if (header.includes(forbidden)) fail(`Cabecera oficial contiene acceso/selector demo: ${forbidden}`);
}
for (const required of ['Ver como…', "setActiveModule('partners_network')", "view', view"]) {
  if (!header.includes(required)) fail(`Superadmin perdió herramienta segura de inspección/comercial: ${required}`);
}

for (const forbidden of ['Simular como Móvil', 'Transmitir PTT', 'Simular carrera nueva', 'sendTestTrip']) {
  if (driver.includes(forbidden)) fail(`App de conductor contiene control de demostración: ${forbidden}`);
}
for (const required of ['promptPWAInstall', 'isPWAStandalone', 'watchPosition', 'SOS DE EMERGENCIA']) {
  if (!driver.includes(required)) fail(`App de conductor oficial incompleta: ${required}`);
}
if (!driverManifest.includes('Central GO Conductor') || !driverManifest.includes('"start_url": "/driver"')) fail('Manifest independiente del conductor incompleto.');

if (login.includes('Crear cuenta segura') || login.includes("setMode('signup')")) fail('El acceso oficial volvió a habilitar el registro legado por formulario.');
if (!login.includes('Olvidé mi contraseña') || !auth.includes('resetPasswordForEmail')) fail('Falta recuperación de contraseña oficial.');
if (login.includes('Modo Demo') || app.includes("get('demo') === '1'")) fail('La demo pública volvió a quedar expuesta.');

for (const required of ['loadPlanCatalog', '<X ', 'App independiente para conductores', 'Múltiples sedes y ciudades', 'API e integraciones']) {
  if (!plans.includes(required)) fail(`Comparador de planes incompleto: ${required}`);
}
for (const required of ['loadCompanyUsers', 'inviteCompanyUser', 'Invitar usuario']) {
  if (!users.includes(required)) fail(`Gestión real de usuarios incompleta: ${required}`);
}
for (const required of ['loadPartnerDashboard', 'PlanComparison', 'Registrar nueva central']) {
  if (!partnerDashboard.includes(required)) fail(`Panel real de partner incompleto: ${required}`);
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

for (const requiredSnippet of [
  'revoke update on table public.profiles from authenticated;',
  'grant update (name, phone, avatar_url) on table public.profiles to authenticated;',
  'revoke insert, update, delete on table public.audit_logs from authenticated;',
  'centralgo_driver_report_location',
  'centralgo_driver_transition_trip',
  'centralgo_write_audit',
]) {
  if (!migrationSecurity.includes(requiredSnippet)) fail(`Hardening SQL obligatorio ausente: ${requiredSnippet}`);
}

for (const requiredSnippet of [
  'from anon, authenticated;',
  'grant select on public.company_memberships to authenticated;',
  'grant select, insert, update on public.trips to authenticated;',
  'grant select on public.audit_logs to authenticated;',
]) {
  if (!migrationPrivileges.includes(requiredSnippet)) fail(`Matriz de privilegios SQL incompleta: ${requiredSnippet}`);
}

for (const [source, snippets] of [
  [migrationOfficial, ['centralgo_visible_network_centrals', 'centralgo_partner_dashboard', 'centralgo_partner_create_company', 'centralgo_company_user_directory', 'centralgo_superadmin_set_company_status']],
  [migrationPartners, ['centralgo_visible_partners', 'centralgo_superadmin_set_partner_status']],
  [migrationCommissions, ['centralgo_visible_commissions']],
  [migrationEntitlements, ['centralgo_enforce_vehicle_limit', 'centralgo_enforce_membership_entitlements', 'driver_app_enabled']],
]) {
  for (const snippet of snippets) if (!source.includes(snippet)) fail(`Operación oficial SQL ausente: ${snippet}`);
}

for (const source of [inviteCompanyUser, inviteNetworkUser]) {
  if (!source.includes('needs_password_setup: true')) fail('Una invitación oficial no exige creación de contraseña.');
  if (!source.includes('SUPABASE_SERVICE_ROLE_KEY')) fail('Edge Function de invitación no usa canal administrativo del servidor.');
}

if (!inviteCompanyUser.includes('central-go-one.vercel.app')) fail('Las invitaciones de centrales no apuntan al dominio oficial actual.');

if (!process.exitCode) console.log('Central GO official static checks: OK');

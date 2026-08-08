import fs from 'node:fs';

const fail = (message) => {
  console.error('COMMERCIAL CHECK FAILED:', message);
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
const context = mustRead('src/context/AppContext.tsx');
const migrationCore = mustRead('supabase/migrations/001_commercial_core.sql');
const migrationSecurity = mustRead('supabase/migrations/002_security_rpc.sql');

if ((pkg.scripts?.build ?? '').includes('bootstrap')) fail('El build volvió a depender de capas bootstrap.');
if (!pkg.scripts?.lint?.includes('tsc')) fail('Falta TypeScript obligatorio.');
if (!app.includes('CommercialGate') || !app.includes('ErrorBoundary')) fail('Faltan guardas globales de producción/error.');
if (!context.includes('runtimeConfig.isDemo')) fail('La simulación GPS no está limitada al modo demo.');

const globalHeaders = vercel.headers?.find((item) => item.source === '/(.*)')?.headers ?? [];
for (const key of ['X-Content-Type-Options', 'Referrer-Policy', 'Permissions-Policy', 'Content-Security-Policy']) {
  if (!globalHeaders.some((header) => header.key === key)) fail('Falta header de seguridad: ' + key);
}

for (const forbidden of ['.network', '.operations-pro', '.operator-layout', '.road-routes', 'selection-fix-bootstrap.mjs']) {
  if (fs.existsSync(forbidden)) fail('Artefacto temporal reapareció: ' + forbidden);
}

for (const table of ['profiles', 'companies', 'company_memberships', 'vehicles', 'drivers', 'driver_locations', 'clients', 'trips', 'audit_logs']) {
  if (!migrationCore.includes(`alter table public.${table} enable row level security;`)) {
    fail(`RLS obligatorio ausente para public.${table}`);
  }
}

for (const requiredSnippet of [
  'revoke update on table public.profiles from authenticated;',
  'grant update (name, phone, avatar_url) on table public.profiles to authenticated;',
  'revoke insert, update, delete on table public.audit_logs from authenticated;',
  'centralgo_driver_report_location',
  'centralgo_driver_transition_trip',
  'centralgo_write_audit',
]) {
  if (!migrationSecurity.includes(requiredSnippet)) {
    fail(`Hardening SQL obligatorio ausente: ${requiredSnippet}`);
  }
}

if (!process.exitCode) console.log('Commercial readiness static checks: OK');

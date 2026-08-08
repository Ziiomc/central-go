import fs from 'node:fs';

const fail = (message) => {
  console.error('COMMERCIAL CHECK FAILED:', message);
  process.exitCode = 1;
};

const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const vercel = JSON.parse(fs.readFileSync('vercel.json', 'utf8'));
const app = fs.readFileSync('src/App.tsx', 'utf8');
const context = fs.readFileSync('src/context/AppContext.tsx', 'utf8');

if ((pkg.scripts.build ?? '').includes('bootstrap')) fail('El build volvió a depender de capas bootstrap.');
if (!pkg.scripts.lint?.includes('tsc')) fail('Falta TypeScript obligatorio.');
if (!app.includes('CommercialGate') || !app.includes('ErrorBoundary')) fail('Faltan guardas globales de producción/error.');
if (!context.includes('runtimeConfig.isDemo')) fail('La simulación GPS no está limitada al modo demo.');

const globalHeaders = vercel.headers?.find((item) => item.source === '/(.*)')?.headers ?? [];
for (const key of ['X-Content-Type-Options', 'Referrer-Policy', 'Permissions-Policy', 'Content-Security-Policy']) {
  if (!globalHeaders.some((header) => header.key === key)) fail('Falta header de seguridad: ' + key);
}

for (const forbidden of ['.network', '.operations-pro', '.operator-layout', '.road-routes', 'selection-fix-bootstrap.mjs']) {
  if (fs.existsSync(forbidden)) fail('Artefacto temporal reapareció: ' + forbidden);
}

if (!process.exitCode) console.log('Commercial readiness static checks: OK');

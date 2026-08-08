import fs from 'node:fs';
import path from 'node:path';

const write = (file, content) => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
};

// Runtime mode and production safety gate.
write('src/config/runtime.ts', `export type RuntimeMode = 'demo' | 'commercial';

const rawMode = (import.meta.env.VITE_APP_MODE ?? 'demo').toLowerCase();
const mode: RuntimeMode = rawMode === 'commercial' ? 'commercial' : 'demo';
const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL ?? '').trim();
const supabasePublishableKey = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? '').trim();
const backendFlag = import.meta.env.VITE_COMMERCIAL_BACKEND_ENABLED === 'true';

// Deliberately false until the authenticated persistence layer is wired into AppContext.
// This prevents a demo data model from being mistaken for a production system.
const commercialBackendIntegrated = false;

export const runtimeConfig = Object.freeze({
  mode,
  isDemo: mode === 'demo',
  isCommercial: mode === 'commercial',
  supabaseUrl,
  supabasePublishableKey,
  hasSupabaseConfig: Boolean(supabaseUrl && supabasePublishableKey),
  backendFlag,
  commercialBackendIntegrated,
  commercialReady:
    mode === 'commercial' &&
    backendFlag &&
    commercialBackendIntegrated &&
    Boolean(supabaseUrl && supabasePublishableKey),
});

export const commercialBlockers = [
  !runtimeConfig.hasSupabaseConfig ? 'Falta configurar Supabase para persistencia y autenticación.' : null,
  !runtimeConfig.backendFlag ? 'Falta habilitar explícitamente el backend comercial.' : null,
  !runtimeConfig.commercialBackendIntegrated ? 'La capa de datos autenticada todavía no está integrada al contexto operativo.' : null,
].filter((item): item is string => Boolean(item));
`);

write('src/components/system/ErrorBoundary.tsx', `import React from 'react';

interface State {
  hasError: boolean;
  message?: string;
}

export class ErrorBoundary extends React.Component<React.PropsWithChildren, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error.message };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[Central GO] Error no controlado', error, info);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <main className="min-h-screen bg-zinc-950 text-zinc-100 flex items-center justify-center p-6">
        <section className="w-full max-w-lg rounded-2xl border border-red-500/30 bg-zinc-900 p-6 shadow-2xl">
          <p className="text-xs font-black uppercase tracking-widest text-red-400">Central GO · recuperación segura</p>
          <h1 className="mt-2 text-xl font-black">La interfaz encontró un error inesperado</h1>
          <p className="mt-2 text-sm text-zinc-400">No continúes una operación crítica desde esta pantalla. Recarga la aplicación para recuperar un estado limpio.</p>
          {this.state.message && <p className="mt-3 rounded-lg bg-black/30 p-3 font-mono text-xs text-zinc-500">{this.state.message}</p>}
          <button onClick={() => window.location.reload()} className="mt-5 rounded-xl bg-amber-400 px-4 py-2.5 text-sm font-black text-zinc-950 hover:bg-amber-300">Recargar Central GO</button>
        </section>
      </main>
    );
  }
}
`);

write('src/components/system/CommercialGate.tsx', `import React from 'react';
import { commercialBlockers, runtimeConfig } from '../../config/runtime';

export const CommercialGate: React.FC<React.PropsWithChildren> = ({ children }) => {
  if (runtimeConfig.isCommercial && !runtimeConfig.commercialReady) {
    return (
      <main className="min-h-screen bg-zinc-950 text-zinc-100 flex items-center justify-center p-6">
        <section className="w-full max-w-2xl rounded-3xl border border-amber-400/30 bg-[#0d0d0f] p-7 shadow-2xl">
          <span className="rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-amber-300">Protección de producción activa</span>
          <h1 className="mt-4 text-2xl font-black">Central GO no abrirá datos demo como si fueran datos comerciales</h1>
          <p className="mt-2 text-sm leading-relaxed text-zinc-400">El modo comercial fue solicitado, pero todavía falta infraestructura obligatoria. La aplicación queda bloqueada de forma intencional para evitar carreras, usuarios o GPS ficticios en una central real.</p>
          <ul className="mt-5 space-y-2">
            {commercialBlockers.map((item) => <li key={item} className="rounded-xl border border-zinc-800 bg-zinc-900/70 px-4 py-3 text-sm text-zinc-300">• {item}</li>)}
          </ul>
        </section>
      </main>
    );
  }

  return (
    <>
      {runtimeConfig.isDemo && (
        <div className="fixed bottom-3 left-3 z-[120] rounded-full border border-amber-400/30 bg-zinc-950/95 px-3 py-1.5 text-[9px] font-black uppercase tracking-widest text-amber-300 shadow-xl backdrop-blur">
          Entorno demo · sin persistencia comercial
        </div>
      )}
      {children}
    </>
  );
};
`);

write('.env.example', `# Central GO runtime
VITE_APP_MODE=demo

# Se usarán cuando conectemos el backend comercial dedicado de Central GO.
VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE_KEY=
VITE_COMMERCIAL_BACKEND_ENABLED=false
`);

write('scripts/commercial-check.mjs', `import fs from 'node:fs';

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
`);

write('public/sw.js', `const CACHE_NAME = 'centralgo-commercial-v3';
const APP_SHELL = ['/', '/index.html', '/manifest.json', '/icon.svg'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) => Promise.all(names.filter((name) => name !== CACHE_NAME).map((name) => caches.delete(name))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  if (event.request.mode === 'navigate') {
    event.respondWith(fetch(event.request).catch(() => caches.match('/index.html')));
    return;
  }

  const requestUrl = new URL(event.request.url);
  if (requestUrl.origin !== self.location.origin) return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      const network = fetch(event.request).then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        }
        return response;
      });
      return cached ?? network;
    })
  );
});
`);

write('vercel.json', JSON.stringify({
  framework: 'vite',
  buildCommand: 'npm run build',
  outputDirectory: 'dist',
  headers: [
    {
      source: '/(.*)',
      headers: [
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        { key: 'X-Frame-Options', value: 'DENY' },
        { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
        { key: 'Permissions-Policy', value: 'geolocation=(self), camera=(), microphone=()' },
        { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
        { key: 'Content-Security-Policy', value: "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; connect-src 'self' https://router.project-osrm.org; font-src 'self' data:; worker-src 'self' blob:; manifest-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'" }
      ]
    },
    {
      source: '/sw.js',
      headers: [
        { key: 'Cache-Control', value: 'public, max-age=0, must-revalidate' },
        { key: 'Service-Worker-Allowed', value: '/' }
      ]
    }
  ]
}, null, 2) + '\n');

write('vite.config.ts', `import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

export default defineConfig(() => ({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
  build: {
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          if (id.includes('react') || id.includes('react-dom')) return 'react-core';
          if (id.includes('leaflet')) return 'maps';
          if (id.includes('recharts') || id.includes('d3-')) return 'charts';
          if (id.includes('lucide-react')) return 'icons';
          return 'vendor';
        },
      },
    },
  },
  server: {
    hmr: process.env.DISABLE_HMR !== 'true',
    watch: process.env.DISABLE_HMR === 'true' ? null : {},
  },
}));
`);

// Patch App.tsx with global safety components.
let app = fs.readFileSync('src/App.tsx', 'utf8');
if (!app.includes("./components/system/ErrorBoundary")) {
  app = app.replace(
    "import { registerServiceWorker } from './lib/pwa';",
    "import { registerServiceWorker } from './lib/pwa';\nimport { ErrorBoundary } from './components/system/ErrorBoundary';\nimport { CommercialGate } from './components/system/CommercialGate';"
  );
}
app = app.replace(
  /export default function App\(\) \{[\s\S]*?\n\}/,
  `export default function App() {\n  return (\n    <ErrorBoundary>\n      <CommercialGate>\n        <AppProvider>\n          <MainAppContent />\n        </AppProvider>\n      </CommercialGate>\n    </ErrorBoundary>\n  );\n}`
);
fs.writeFileSync('src/App.tsx', app);

// Restrict simulated GPS/movement to demo mode only.
let context = fs.readFileSync('src/context/AppContext.tsx', 'utf8');
if (!context.includes("../config/runtime")) {
  context = context.replace(
    "import { soundManager } from '../lib/audio';",
    "import { soundManager } from '../lib/audio';\nimport { runtimeConfig } from '../config/runtime';"
  );
}
const simulationMarker = '// Real-time Driver Simulation Loop';
const markerIndex = context.indexOf(simulationMarker);
if (markerIndex !== -1) {
  const effectIndex = context.indexOf('  useEffect(() => {', markerIndex);
  const intervalIndex = context.indexOf('    const interval = setInterval(() => {', effectIndex);
  if (effectIndex !== -1 && intervalIndex !== -1 && !context.slice(effectIndex, intervalIndex).includes('runtimeConfig.isDemo')) {
    context = context.slice(0, intervalIndex) + '    if (!runtimeConfig.isDemo) return;\n\n' + context.slice(intervalIndex);
  }
}
fs.writeFileSync('src/context/AppContext.tsx', context);

const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
pkg.version = '1.7.0';
pkg.scripts = {
  ...pkg.scripts,
  lint: 'tsc --noEmit',
  'check:commercial': 'node scripts/commercial-check.mjs',
  test: 'npm run lint && npm run check:commercial && npm run build'
};
pkg.description = 'Central GO 1.7 - base comercial endurecida, con guardas de producción, CI y seguridad HTTP.';
fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n');

write('.github/workflows/build-check.yml', `name: Calidad Central GO\n\non:\n  push:\n    branches: [main]\n  pull_request:\n    branches: [main]\n  workflow_dispatch:\n\npermissions:\n  contents: read\n\njobs:\n  quality:\n    runs-on: ubuntu-latest\n    timeout-minutes: 12\n    steps:\n      - name: Descargar código\n        uses: actions/checkout@v4\n      - name: Configurar Node\n        uses: actions/setup-node@v4\n        with:\n          node-version: 22\n          cache: npm\n      - name: Instalar dependencias reproducibles\n        run: npm ci --no-audit --no-fund\n      - name: TypeScript\n        run: npm run lint\n      - name: Reglas comerciales\n        run: npm run check:commercial\n      - name: Compilar producción\n        run: npm run build\n`);

write('docs/COMMERCIAL_READINESS.md', `# Central GO — preparación comercial\n\n## Estado actual\n\nLa interfaz, PWA, despacho, mapa, estados y flujos demo están protegidos por CI y compilan con TypeScript. El repositorio ya no reconstruye código desde capas ocultas durante el build.\n\n## Barreras deliberadas antes de producción\n\nCentral GO no debe activarse con \`VITE_APP_MODE=commercial\` hasta conectar una base de datos y autenticación dedicadas. El gate de producción bloqueará la aplicación para impedir que datos demo sean confundidos con datos reales.\n\nPendiente para producción real:\n\n- Proyecto Supabase dedicado a Central GO.\n- Autenticación de operadoras, conductores, administradores y propietario.\n- Row Level Security por empresa/central.\n- Persistencia de carreras, clientes, vehículos, conductores y auditoría.\n- Canal de GPS real del conductor (Realtime/Edge Function o API autenticada).\n- Backups, retención, política de privacidad y procedimiento de incidentes.\n- Pruebas E2E de carreras críticas antes de incorporar una central real.\n\n## Variables preparadas\n\nCopiar \`.env.example\` y configurar las variables únicamente en Vercel. Nunca versionar claves privadas.\n`);

const readmePath = 'README.md';
let readme = fs.readFileSync(readmePath, 'utf8');
if (!readme.includes('## Seguridad comercial')) {
  readme += `\n\n## Seguridad comercial\n\nLa rama principal ejecuta TypeScript, chequeos de preparación comercial y build de producción en cada cambio. El modo comercial permanece bloqueado hasta conectar autenticación y persistencia reales. Ver \`docs/COMMERCIAL_READINESS.md\`.\n`;
  fs.writeFileSync(readmePath, readme);
}

console.log('Hardening comercial aplicado a Central GO 1.7.0');

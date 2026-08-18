import React from 'react';

interface State {
  hasError: boolean;
  message?: string;
}

const CHUNK_RECOVERY_KEY = 'centralgo:chunk-recovery:last';
const isChunkLoadError = (error: Error) => /Failed to fetch dynamically imported module|Importing a module script failed|ChunkLoadError|Loading chunk|dynamically imported module/i.test(error.message || '');

async function recoverStaleBundle() {
  try {
    const lastAttempt = Number(sessionStorage.getItem(CHUNK_RECOVERY_KEY) || 0);
    if (Date.now() - lastAttempt < 30_000) return false;
    sessionStorage.setItem(CHUNK_RECOVERY_KEY, String(Date.now()));

    if ('caches' in window) {
      const names = await caches.keys();
      await Promise.all(names.filter((name) => name.startsWith('centralgo-')).map((name) => caches.delete(name)));
    }
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map((registration) => registration.update().catch(() => undefined)));
    }
  } catch (error) {
    console.warn('[Central GO] Recuperación de bundle parcial', error);
  }

  window.location.reload();
  return true;
}

export class ErrorBoundary extends React.Component<React.PropsWithChildren, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error.message };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[Central GO] Error no controlado', error, info);
    if (isChunkLoadError(error)) void recoverStaleBundle();
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    const staleChunk = Boolean(this.state.message && /Failed to fetch dynamically imported module|Importing a module script failed|ChunkLoadError|Loading chunk|dynamically imported module/i.test(this.state.message));

    return (
      <main className="min-h-screen bg-zinc-950 text-zinc-100 flex items-center justify-center p-6">
        <section className="w-full max-w-lg rounded-2xl border border-red-500/30 bg-zinc-900 p-6 shadow-2xl">
          <p className="text-xs font-black uppercase tracking-widest text-red-400">Central GO · recuperación segura</p>
          <h1 className="mt-2 text-xl font-black">{staleChunk ? 'Actualizando Central GO…' : 'La interfaz encontró un error inesperado'}</h1>
          <p className="mt-2 text-sm text-zinc-400">{staleChunk ? 'Detectamos una versión antigua de la interfaz. Estamos limpiando la caché y cargando automáticamente la versión actual.' : 'No continúes una operación crítica desde esta pantalla. Recarga la aplicación para recuperar un estado limpio.'}</p>
          {this.state.message && !staleChunk && <p className="mt-3 rounded-lg bg-black/30 p-3 font-mono text-xs text-zinc-500">{this.state.message}</p>}
          <button onClick={() => void recoverStaleBundle()} className="mt-5 rounded-xl bg-amber-400 px-4 py-2.5 text-sm font-black text-zinc-950 hover:bg-amber-300">{staleChunk ? 'Actualizar ahora' : 'Recargar Central GO'}</button>
        </section>
      </main>
    );
  }
}

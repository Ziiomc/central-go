import React from 'react';

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

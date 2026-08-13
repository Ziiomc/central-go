import React, { useState } from 'react';
import { Clock3, Loader2, LogOut, RefreshCw, ShieldCheck } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { AuthShell } from './AuthShell';

export const DriverApplicationStatusScreen: React.FC = () => {
  const { driverApplication, refreshIdentity, signOut } = useAuth();
  const [checking, setChecking] = useState(false);

  const checkStatus = async () => {
    setChecking(true);
    try {
      await refreshIdentity();
    } finally {
      setChecking(false);
    }
  };

  return (
    <AuthShell compact eyebrow="Solicitud protegida" title="Tu central revisará el acceso">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-amber-400/25 bg-amber-400/10 text-amber-500">
        <Clock3 className="h-7 w-7" />
      </div>
      <p className="cg-card-kicker mt-5 text-center">Conductor · aprobación pendiente</p>
      <h1 className="cg-card-title text-center">Solicitud enviada</h1>
      <p className="cg-card-copy text-center">
        Avisaremos a la administración de {driverApplication?.companyName || 'tu central'}. Hasta que te aprueben, no podrás ver viajes ni compartir tu ubicación.
      </p>

      <div className="mt-5 rounded-2xl border border-[var(--cg-border)] bg-[var(--cg-primary-soft)] p-4">
        <p className="flex items-center gap-2 text-xs font-black text-[var(--cg-text)]"><ShieldCheck className="h-4 w-4 text-[var(--cg-primary)]" /> Tus datos operativos siguen protegidos</p>
        <p className="mt-1 text-[10px] leading-relaxed text-[var(--cg-muted)]">Este control evita que alguien acceda a una flota solo por conocer el código de la central.</p>
      </div>

      <button type="button" disabled={checking} onClick={() => void checkStatus()} className="cg-primary-button mt-5">
        {checking ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
        {checking ? 'Consultando…' : 'Comprobar aprobación'}
      </button>
      <button type="button" onClick={() => void signOut()} className="cg-subtle-button mt-2 flex w-full items-center justify-center gap-2">
        <LogOut className="h-4 w-4" /> Cerrar sesión
      </button>
    </AuthShell>
  );
};


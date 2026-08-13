import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Clock3, FileDown, Loader2, LogOut, RefreshCw, ShieldCheck } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { AuthShell } from './AuthShell';

const formatRemaining = (milliseconds: number) => {
  if (milliseconds <= 0) return 'Revisión habilitada';
  const totalMinutes = Math.ceil(milliseconds / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours ? `${hours} h ` : ''}${minutes} min`;
};

export const PartnerApplicationStatusScreen: React.FC = () => {
  const { partnerApplication, refreshIdentity, signOut } = useAuth();
  const [checking, setChecking] = useState(false);
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30000);
    return () => window.clearInterval(timer);
  }, []);
  const remaining = useMemo(
    () => partnerApplication ? new Date(partnerApplication.eligibleReviewAt).getTime() - now : 0,
    [now, partnerApplication],
  );
  const rejected = partnerApplication?.status === 'rejected';

  const check = async () => {
    setChecking(true);
    try { await refreshIdentity(); } finally { setChecking(false); }
  };

  return (
    <AuthShell compact eyebrow="Programa comercial" title="Postulación con aprobación protegida">
      <div className={`mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border ${rejected ? 'border-rose-400/25 bg-rose-400/10 text-rose-400' : 'border-amber-400/25 bg-amber-400/10 text-amber-500'}`}>
        {rejected ? <AlertTriangle className="h-7 w-7" /> : <Clock3 className="h-7 w-7" />}
      </div>
      <p className="cg-card-kicker mt-5 text-center">Socio comercial · {rejected ? 'solicitud revisada' : 'revisión pendiente'}</p>
      <h1 className="cg-card-title text-center">{rejected ? 'Tu solicitud no fue aprobada' : 'Postulación recibida'}</h1>
      <p className="cg-card-copy text-center">
        {rejected
          ? partnerApplication?.rejectionReason || 'El superadministrador decidió no habilitar el acceso comercial.'
          : 'El acceso comercial no se activa automáticamente. El superadministrador revisará tu región y aceptación de responsabilidades.'}
      </p>

      {!rejected && (
        <div className="mt-5 rounded-2xl border border-[var(--cg-border)] bg-[var(--cg-primary-soft)] p-4 text-center">
          <p className="text-[10px] font-black uppercase tracking-widest text-[var(--cg-muted)]">Espera mínima obligatoria</p>
          <p className="mt-1 text-xl font-black text-[var(--cg-text)]">{formatRemaining(remaining)}</p>
          <p className="mt-1 text-[10px] leading-relaxed text-[var(--cg-muted)]">Cumplido el plazo, la aprobación seguirá dependiendo de la revisión del superadministrador.</p>
        </div>
      )}

      <a href="/docs/requisitos-socio-comercial-central-go.pdf" target="_blank" rel="noreferrer" className="cg-document-link mt-4">
        <FileDown className="h-4 w-4" /> Descargar responsabilidades aceptadas
      </a>
      <div className="mt-3 rounded-2xl border border-[var(--cg-border)] p-4">
        <p className="flex items-center gap-2 text-xs font-black text-[var(--cg-text)]"><ShieldCheck className="h-4 w-4 text-[var(--cg-primary)]" /> Acceso protegido por aprobación humana</p>
        <p className="mt-1 text-[10px] leading-relaxed text-[var(--cg-muted)]">Ninguna selección del formulario ni dato del perfil puede conceder permisos comerciales.</p>
      </div>
      {!rejected && <button type="button" disabled={checking} onClick={() => void check()} className="cg-primary-button mt-5">{checking ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}{checking ? 'Consultando…' : 'Comprobar estado'}</button>}
      <button type="button" onClick={() => void signOut()} className="cg-subtle-button mt-2 flex w-full items-center justify-center gap-2"><LogOut className="h-4 w-4" />Cerrar sesión</button>
    </AuthShell>
  );
};

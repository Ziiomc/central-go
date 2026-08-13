import React from 'react';
import { Clock3, RefreshCw } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { AuthShell } from './AuthShell';

export const PartnerApplicationStatusScreen: React.FC = () => {
  const { partnerApplication, refreshIdentity, signOut } = useAuth();
  const rejected = partnerApplication?.status === 'rejected';
  return <AuthShell compact eyebrow="Programa comercial" title="Revisión de socio comercial / regional">
    <div className="text-center">
      <Clock3 className="mx-auto h-8 w-8 text-amber-400" />
      <h1 className="cg-card-title mt-4">{rejected ? 'Solicitud no aprobada' : 'Postulación recibida'}</h1>
      <p className="cg-card-copy">{rejected ? (partnerApplication?.rejectionReason || 'La solicitud fue rechazada.') : 'El plazo habitual de revisión es de hasta 3 horas. Es una referencia de atención: el superadministrador puede aprobar o rechazar tu solicitud antes.'}</p>
      {!rejected && <button type="button" onClick={() => void refreshIdentity()} className="cg-primary-button mt-5"><RefreshCw className="h-4 w-4" />Comprobar estado</button>}
      <button type="button" onClick={() => void signOut()} className="cg-subtle-button mt-2 w-full">Cerrar sesión</button>
    </div>
  </AuthShell>;
};

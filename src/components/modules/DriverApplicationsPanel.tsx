import React, { useCallback, useEffect, useState } from 'react';
import { CarFront, Check, Clock3, ExternalLink, FileCheck2, Loader2, RefreshCw, ShieldCheck, UserRoundCheck, X } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import {
  loadPendingDriverApplications,
  loadPendingVehicleSubmissions,
  openDriverDocument,
  reviewDriverApplication,
  reviewDriverVehicle,
  type DriverApplicationRecord,
  type DriverDocumentRecord,
  type DriverVehicleProposal,
} from '../../lib/driverApplicationRepository';

const documentLabel: Record<string, string> = {
  identity_document: 'Identidad',
  driver_license: 'Licencia',
  profile_photo: 'Fotografía',
  vehicle_registration: 'Inscripción / padrón',
  vehicle_insurance: 'Seguro',
  technical_inspection: 'Revisión técnica',
  other: 'Otro documento',
};

const DocumentButtons: React.FC<{ documents: DriverDocumentRecord[]; onError: (message: string) => void }> = ({ documents, onError }) => (
  <div className="mt-3 flex flex-wrap gap-2">
    {documents.map((document) => (
      <button
        key={document.id}
        type="button"
        onClick={() => void openDriverDocument(document).catch((err) => onError(err instanceof Error ? err.message : 'No fue posible abrir el documento.'))}
        className="inline-flex items-center gap-1.5 rounded-lg border border-blue-500/25 bg-blue-500/10 px-2.5 py-2 text-[9px] font-black text-blue-200"
      >
        <FileCheck2 className="h-3.5 w-3.5" />{documentLabel[document.documentType] ?? document.originalName}<ExternalLink className="h-3 w-3" />
      </button>
    ))}
  </div>
);

export const DriverApplicationsPanel: React.FC<{ companyId: string }> = ({ companyId }) => {
  const { currentRole, vehicles } = useApp();
  const [applications, setApplications] = useState<DriverApplicationRecord[]>([]);
  const [vehicleProposals, setVehicleProposals] = useState<DriverVehicleProposal[]>([]);
  const [units, setUnits] = useState<Record<string, string>>({});
  const [vehicleIds, setVehicleIds] = useState<Record<string, string>>({});
  const [vehicleUnits, setVehicleUnits] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [nextApplications, nextVehicles] = await Promise.all([
        loadPendingDriverApplications(companyId),
        loadPendingVehicleSubmissions(companyId),
      ]);
      setApplications(nextApplications);
      setVehicleProposals(nextVehicles);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No fue posible cargar las solicitudes.');
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => { void load(); }, [load]);

  if (currentRole !== 'company_admin') return null;
  if (loading) return <div className="rounded-2xl border border-zinc-800 bg-[#0d0d0f] p-4 text-xs text-zinc-500"><Loader2 className="mr-2 inline h-4 w-4 animate-spin" />Consultando solicitudes y vehículos…</div>;
  if (!applications.length && !vehicleProposals.length && !error && !notice) return null;

  const reviewApplication = async (application: DriverApplicationRecord, approve: boolean) => {
    const unitNumber = units[application.id]?.trim();
    if (approve && !unitNumber) {
      setError(`Asigna un número de móvil a ${application.applicantName}.`);
      return;
    }
    setBusyId(application.id);
    setError('');
    setNotice('');
    try {
      await reviewDriverApplication({
        applicationId: application.id,
        approve,
        unitNumber,
        vehicleId: vehicleIds[application.id],
        rejectionReason: approve ? undefined : 'La central rechazó los antecedentes presentados.',
      });
      setNotice(approve ? `${application.applicantName} fue incorporado como conductor.` : `Solicitud de ${application.applicantName} rechazada.`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No fue posible revisar la solicitud.');
    } finally {
      setBusyId(null);
    }
  };

  const reviewVehicle = async (proposal: DriverVehicleProposal, approve: boolean) => {
    const unitNumber = vehicleUnits[proposal.id]?.trim();
    if (approve && !unitNumber) {
      setError(`Asigna un número de móvil al vehículo ${proposal.licensePlate}.`);
      return;
    }
    setBusyId(proposal.id);
    setError('');
    setNotice('');
    try {
      await reviewDriverVehicle({
        submissionId: proposal.id,
        approve,
        unitNumber,
        rejectionReason: approve ? undefined : 'El vehículo no cumple los requisitos actuales de la flota.',
      });
      setNotice(approve ? `Vehículo ${proposal.licensePlate} incorporado a la flota.` : `Vehículo ${proposal.licensePlate} rechazado.`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No fue posible revisar el vehículo.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section className="rounded-2xl border border-cyan-500/25 bg-cyan-500/[0.055] p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 text-xs font-black text-cyan-300"><UserRoundCheck className="h-4 w-4" /> Solicitudes documentadas</p>
          <p className="mt-1 text-[10px] text-zinc-500">Revisa identidad y licencia antes de aprobar. Los enlaces privados vencen automáticamente.</p>
        </div>
        <button type="button" onClick={() => void load()} className="rounded-lg border border-zinc-700 bg-zinc-900 p-2 text-zinc-400" title="Actualizar"><RefreshCw className="h-4 w-4" /></button>
      </div>

      {error && <div className="mt-3 rounded-xl border border-rose-500/25 bg-rose-500/10 p-3 text-xs text-rose-200">{error}</div>}
      {notice && <div className="mt-3 rounded-xl border border-emerald-500/25 bg-emerald-500/10 p-3 text-xs text-emerald-200">{notice}</div>}

      {applications.length > 0 && (
        <div className="mt-4 grid gap-3 xl:grid-cols-2">
          {applications.map((application) => (
            <article key={application.id} className="rounded-xl border border-zinc-800 bg-[#0d0d0f] p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-black text-white">{application.applicantName}</p>
                  <p className="mt-1 text-[10px] text-zinc-500">{application.phone || 'Sin teléfono'} · Documento {application.nationalIdNumber}</p>
                  <p className="mt-0.5 text-[10px] text-zinc-500">Licencia {application.licenseNumber} · {application.licenseCountryCode}</p>
                </div>
                <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/20 bg-amber-500/10 px-2 py-1 text-[8px] font-black uppercase text-amber-300"><Clock3 className="h-3 w-3" /> Pendiente</span>
              </div>
              {application.notes && <p className="mt-3 rounded-lg border border-zinc-800 bg-zinc-950/60 p-3 text-[10px] leading-relaxed text-zinc-400">{application.notes}</p>}
              <DocumentButtons documents={application.documents.filter((document) => ['identity_document', 'driver_license', 'profile_photo'].includes(document.documentType))} onError={setError} />
              {application.vehicleProposal && <div className="mt-3 rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 text-[10px] text-zinc-400"><CarFront className="mr-1.5 inline h-4 w-4 text-amber-300" />Propone {application.vehicleProposal.brand} {application.vehicleProposal.model} · {application.vehicleProposal.licensePlate}</div>}
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <input value={units[application.id] ?? ''} onChange={(event) => setUnits((current) => ({ ...current, [application.id]: event.target.value }))} placeholder="N.º de móvil para conductor" className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs text-white outline-none focus:border-cyan-400" />
                <select value={vehicleIds[application.id] ?? ''} onChange={(event) => setVehicleIds((current) => ({ ...current, [application.id]: event.target.value }))} className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs text-white outline-none focus:border-cyan-400">
                  <option value="">Sin vehículo existente</option>
                  {vehicles.filter((vehicle) => vehicle.status === 'active').map((vehicle) => <option key={vehicle.id} value={vehicle.id}>{vehicle.unitNumber} · {vehicle.licensePlate}</option>)}
                </select>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button type="button" disabled={busyId === application.id} onClick={() => void reviewApplication(application, false)} className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-rose-500/25 bg-rose-500/10 px-3 py-2 text-[10px] font-black text-rose-300 disabled:opacity-50"><X className="h-3.5 w-3.5" /> Rechazar</button>
                <button type="button" disabled={busyId === application.id} onClick={() => void reviewApplication(application, true)} className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-emerald-400/25 bg-emerald-500 px-3 py-2 text-[10px] font-black text-white disabled:opacity-50">{busyId === application.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />} Aprobar conductor</button>
              </div>
            </article>
          ))}
        </div>
      )}

      {vehicleProposals.length > 0 && (
        <div className="mt-5 border-t border-zinc-800 pt-5">
          <div className="flex items-center gap-2"><CarFront className="h-4 w-4 text-amber-300" /><h3 className="text-xs font-black text-white">Vehículos propuestos para la flota</h3></div>
          <div className="mt-3 grid gap-3 xl:grid-cols-2">
            {vehicleProposals.map((proposal) => {
              const driverApproved = proposal.applicationStatus === 'approved' && Boolean(proposal.driverId);
              return (
                <article key={proposal.id} className="rounded-xl border border-zinc-800 bg-[#0d0d0f] p-4">
                  <div className="flex items-start justify-between gap-3"><div><p className="text-sm font-black text-white">{proposal.brand} {proposal.model} · {proposal.year}</p><p className="mt-1 text-[10px] text-zinc-500">{proposal.licensePlate} · {proposal.registrationCountryCode} · {proposal.capacity} pasajeros · {proposal.applicantName}</p></div><span className="rounded-full border border-amber-500/20 bg-amber-500/10 px-2 py-1 text-[8px] font-black uppercase text-amber-300">Por validar</span></div>
                  <DocumentButtons documents={proposal.documents} onError={setError} />
                  {!driverApproved && <div className="mt-3 rounded-lg border border-blue-500/20 bg-blue-500/10 p-2.5 text-[9px] text-blue-200"><ShieldCheck className="mr-1 inline h-3.5 w-3.5" />Aprueba primero al conductor para incorporar el vehículo.</div>}
                  <input value={vehicleUnits[proposal.id] ?? ''} onChange={(event) => setVehicleUnits((current) => ({ ...current, [proposal.id]: event.target.value }))} placeholder="N.º de móvil para el vehículo" className="mt-3 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs text-white outline-none focus:border-cyan-400" />
                  <div className="mt-3 grid grid-cols-2 gap-2"><button type="button" disabled={busyId === proposal.id} onClick={() => void reviewVehicle(proposal, false)} className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-rose-500/25 bg-rose-500/10 px-3 py-2 text-[10px] font-black text-rose-300 disabled:opacity-50"><X className="h-3.5 w-3.5" />Rechazar vehículo</button><button type="button" disabled={!driverApproved || busyId === proposal.id} onClick={() => void reviewVehicle(proposal, true)} className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-emerald-400/25 bg-emerald-500 px-3 py-2 text-[10px] font-black text-white disabled:cursor-not-allowed disabled:opacity-40">{busyId === proposal.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}Incorporar</button></div>
                </article>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
};


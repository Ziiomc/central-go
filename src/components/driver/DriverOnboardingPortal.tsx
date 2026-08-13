import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BadgeCheck,
  Building2,
  Camera,
  CarFront,
  CheckCircle2,
  Clock3,
  FileCheck2,
  FileUp,
  Loader2,
  LogOut,
  MapPin,
  RefreshCw,
  Search,
  Send,
  ShieldCheck,
  X,
} from 'lucide-react';
import centralGoLogo from '../../assets/images/central-go-logo.svg';
import { useAuth } from '../../context/AuthContext';
import {
  loadMyDriverApplications,
  prepareDriverApplication,
  saveVehicleSubmission,
  searchCentrals,
  submitDriverApplication,
  uploadDriverDocument,
  type CentralDirectoryItem,
  type MyDriverApplication,
} from '../../lib/driverMarketplaceRepository';
import { ThemeToggle } from '../auth/ThemeToggle';
import { WorldCitySelect, WorldCountrySelect } from '../auth/WorldLocationPicker';

const statusStyle: Record<MyDriverApplication['status'], string> = {
  draft: 'border-zinc-700 bg-zinc-800/70 text-zinc-300',
  pending: 'border-amber-400/25 bg-amber-400/10 text-amber-300',
  approved: 'border-emerald-400/25 bg-emerald-400/10 text-emerald-300',
  rejected: 'border-rose-400/25 bg-rose-400/10 text-rose-300',
  withdrawn: 'border-zinc-700 bg-zinc-800/70 text-zinc-400',
};

const statusLabel: Record<MyDriverApplication['status'], string> = {
  draft: 'Borrador', pending: 'En revisión', approved: 'Aprobada', rejected: 'Rechazada', withdrawn: 'Retirada',
};

const FilePicker: React.FC<{
  label: string;
  detail: string;
  files: File[];
  onChange: (files: File[]) => void;
  required?: boolean;
}> = ({ label, detail, files, onChange, required = false }) => (
  <fieldset className={`cg-upload-card ${files.length ? 'cg-upload-card-ready' : ''}`}>
    <span className="cg-upload-icon">{files.length ? <FileCheck2 /> : <Camera />}</span>
    <span className="min-w-0 flex-1">
      <strong>{label}{required ? ' *' : ''}</strong>
      <small className="block truncate">{files.length ? `${files.length} archivo${files.length === 1 ? '' : 's'} · ${(files.reduce((total, file) => total + file.size, 0) / 1024 / 1024).toFixed(1)} MB` : detail}</small>
    </span>
    <span className="cg-upload-actions">
      <label><Camera /><span>Tomar foto</span><input className="sr-only" type="file" accept="image/jpeg,image/png,image/webp" capture="environment" onChange={(event) => { const file = event.target.files?.[0]; if (file) onChange([...files, file]); event.target.value = ''; }} /></label>
      <label><FileUp /><span>Adjuntar</span><input className="sr-only" type="file" multiple accept="application/pdf,image/jpeg,image/png,image/webp" onChange={(event) => { onChange(Array.from(event.target.files ?? [])); event.target.value = ''; }} /></label>
    </span>
  </fieldset>
);

export const DriverOnboardingPortal: React.FC = () => {
  const { authUser, profile, saasAccount, refreshIdentity, signOut } = useAuth();
  const [tab, setTab] = useState<'centrals' | 'applications'>('centrals');
  const [centrals, setCentrals] = useState<CentralDirectoryItem[]>([]);
  const [applications, setApplications] = useState<MyDriverApplication[]>([]);
  const [query, setQuery] = useState('');
  const [city, setCity] = useState(saasAccount?.city ?? '');
  const [countryCode, setCountryCode] = useState(saasAccount?.countryCode ?? 'CL');
  const [selectedCentral, setSelectedCentral] = useState<CentralDirectoryItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [progress, setProgress] = useState('');

  const [form, setForm] = useState({
    name: profile?.name ?? '',
    phone: profile?.phone ?? '',
    nationalId: '',
    licenseNumber: '',
    licenseCountryCode: saasAccount?.countryCode ?? 'CL',
    notes: '',
  });
  const [identityFiles, setIdentityFiles] = useState<File[]>([]);
  const [licenseFiles, setLicenseFiles] = useState<File[]>([]);
  const [withVehicle, setWithVehicle] = useState(false);
  const [vehicle, setVehicle] = useState({
    plate: '', brand: '', model: '', year: String(new Date().getFullYear()), color: '', capacity: '4',
    countryCode: saasAccount?.countryCode ?? 'CL', inspectionExpiry: '',
  });
  const [registrationFiles, setRegistrationFiles] = useState<File[]>([]);
  const [insuranceFiles, setInsuranceFiles] = useState<File[]>([]);
  const [inspectionFiles, setInspectionFiles] = useState<File[]>([]);

  const loadApplications = useCallback(async () => {
    setApplications(await loadMyDriverApplications());
  }, []);

  const runSearch = useCallback(async (override?: { countryCode?: string; city?: string; query?: string }) => {
    setLoading(true);
    setError('');
    try {
      const filters = override ?? { countryCode, city, query };
      setCentrals(await searchCentrals(filters));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No fue posible buscar centrales.');
    } finally {
      setLoading(false);
    }
  }, [city, countryCode, query]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    void Promise.all([
      searchCentrals({ countryCode: saasAccount?.countryCode ?? 'CL', city: saasAccount?.city ?? '', query: '' }),
      loadMyDriverApplications(),
    ]).then(([nextCentrals, nextApplications]) => {
      if (!active) return;
      setCentrals(nextCentrals);
      setApplications(nextApplications);
    }).catch((err) => {
      if (active) setError(err instanceof Error ? err.message : 'No fue posible abrir tu portal.');
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [saasAccount?.city, saasAccount?.countryCode]);

  const applicationByCompany = useMemo(
    () => new Map(applications.map((application) => [application.companyId, application])),
    [applications],
  );

  const resetApplication = () => {
    setSelectedCentral(null);
    setIdentityFiles([]);
    setLicenseFiles([]);
    setWithVehicle(false);
    setRegistrationFiles([]);
    setInsuranceFiles([]);
    setInspectionFiles([]);
    setProgress('');
  };

  const sendApplication = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedCentral || !authUser) return;
    if (!identityFiles.length || !licenseFiles.length) {
      setError('Adjunta tu documento de identidad y tu licencia.');
      return;
    }
    if (withVehicle && !registrationFiles.length) {
      setError('Adjunta el documento de inscripción o padrón del vehículo.');
      return;
    }
    setBusy(true);
    setError('');
    setNotice('');
    try {
      setProgress('Preparando solicitud segura…');
      const draft = await prepareDriverApplication({
        companyId: selectedCentral.id,
        applicantName: form.name,
        phone: form.phone,
        nationalIdNumber: form.nationalId,
        licenseNumber: form.licenseNumber,
        licenseCountryCode: form.licenseCountryCode,
        notes: form.notes,
      });

      let vehicleSubmissionId: string | undefined;
      if (withVehicle) {
        setProgress('Registrando antecedentes del vehículo…');
        vehicleSubmissionId = await saveVehicleSubmission({
          applicationId: draft.applicationId,
          userId: authUser.id,
          companyId: selectedCentral.id,
          licensePlate: vehicle.plate,
          brand: vehicle.brand,
          model: vehicle.model,
          year: Number(vehicle.year),
          color: vehicle.color,
          capacity: Number(vehicle.capacity),
          registrationCountryCode: vehicle.countryCode,
          technicalInspectionExpiry: vehicle.inspectionExpiry,
        });
      }

      setProgress('Protegiendo y adjuntando tu identidad…');
      for (const file of identityFiles) await uploadDriverDocument({ applicationId: draft.applicationId, userId: authUser.id, documentType: 'identity_document', countryCode: saasAccount?.countryCode ?? countryCode, file });
      setProgress('Adjuntando licencia de conducir…');
      for (const file of licenseFiles) await uploadDriverDocument({ applicationId: draft.applicationId, userId: authUser.id, documentType: 'driver_license', countryCode: form.licenseCountryCode, file });

      if (withVehicle && vehicleSubmissionId && registrationFiles.length) {
        setProgress('Adjuntando documentación del vehículo…');
        for (const file of registrationFiles) await uploadDriverDocument({ applicationId: draft.applicationId, vehicleSubmissionId, userId: authUser.id, documentType: 'vehicle_registration', countryCode: vehicle.countryCode, file });
        for (const file of insuranceFiles) await uploadDriverDocument({ applicationId: draft.applicationId, vehicleSubmissionId, userId: authUser.id, documentType: 'vehicle_insurance', countryCode: vehicle.countryCode, file });
        for (const file of inspectionFiles) await uploadDriverDocument({ applicationId: draft.applicationId, vehicleSubmissionId, userId: authUser.id, documentType: 'technical_inspection', countryCode: vehicle.countryCode, file });
      }

      setProgress('Enviando a la central…');
      await submitDriverApplication(draft.applicationId);
      await loadApplications();
      setNotice(`Solicitud enviada a ${selectedCentral.name}. La central revisará tu identidad, licencia y vehículo.`);
      setTab('applications');
      resetApplication();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No fue posible enviar la solicitud.');
    } finally {
      setBusy(false);
      setProgress('');
    }
  };

  const refreshAll = async () => {
    setBusy(true);
    setError('');
    try {
      await refreshIdentity();
      await loadApplications();
      await runSearch();
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="cg-driver-portal">
      <header className="cg-driver-portal-header">
        <a href="/driver" className="cg-brand"><img src={centralGoLogo} alt="" className="h-10 w-10 rounded-xl" /><span><strong>CENTRAL</strong> GO</span></a>
        <div className="flex items-center gap-2">
          <ThemeToggle compact />
          <button type="button" onClick={() => void signOut()} className="cg-subtle-button inline-flex items-center gap-2"><LogOut className="h-4 w-4" />Salir</button>
        </div>
      </header>

      <section className="cg-driver-hero">
        <div>
          <p className="cg-card-kicker">Portal independiente del conductor</p>
          <h1>Encuentra una central y postula con tus documentos</h1>
          <p>Tu cuenta ya está activa. El acceso a carreras, GPS y radio se habilitará cuando una central valide tus antecedentes.</p>
        </div>
        <div className="cg-driver-security"><ShieldCheck /><span><strong>Documentos privados</strong><small>Solo tú, la central elegida y el superadministrador pueden revisarlos.</small></span></div>
      </section>

      {(error || notice) && <div className={`cg-alert ${error ? 'cg-alert-error' : 'cg-alert-success'} mx-auto mt-4 max-w-6xl`}>{error || notice}</div>}

      <div className="cg-driver-tabs">
        <button type="button" data-active={tab === 'centrals'} onClick={() => setTab('centrals')}><Search />Buscar centrales</button>
        <button type="button" data-active={tab === 'applications'} onClick={() => setTab('applications')}><Clock3 />Mis solicitudes <span>{applications.length}</span></button>
        <button type="button" disabled={busy} onClick={() => void refreshAll()} className="ml-auto"><RefreshCw className={busy ? 'animate-spin' : ''} />Actualizar</button>
      </div>

      {tab === 'centrals' ? (
        <section className="cg-driver-content">
          <form onSubmit={(event) => { event.preventDefault(); void runSearch(); }} className="cg-central-search">
            <WorldCountrySelect value={countryCode} onChange={(nextCountryCode) => { setCountryCode(nextCountryCode); setCity(''); }} label="País de la central" />
            <WorldCitySelect countryCode={countryCode} value={city} onChange={setCity} label="Ciudad de la central" />
            <label className="cg-field"><span>Nombre o código</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Radio Taxi o CG-…" /></label>
            <button className="cg-primary-button" disabled={loading}>{loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}Buscar</button>
          </form>

          <div className="cg-central-results">
            {centrals.map((central) => {
              const application = applicationByCompany.get(central.id);
              const unavailable = application?.status === 'pending' || application?.status === 'approved';
              return (
                <article key={central.id} className="cg-central-card">
                  <span className="cg-central-logo"><Building2 /></span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2"><h2>{central.name}</h2><span className="cg-code-chip">{central.code}</span></div>
                    <p><MapPin /> {[central.city, central.countryCode].filter(Boolean).join(', ') || 'Ubicación por confirmar'}</p>
                    <small>La central revisará tus documentos antes de incorporarte a su operación.</small>
                  </div>
                  <button type="button" disabled={unavailable} onClick={() => { setSelectedCentral(central); setError(''); }} className="cg-apply-button">
                    {application?.status === 'pending' ? 'En revisión' : application?.status === 'approved' ? 'Aprobada' : application?.status === 'rejected' ? 'Volver a postular' : 'Postular'}
                  </button>
                </article>
              );
            })}
            {!loading && !centrals.length && <div className="cg-empty-state"><Building2 /><h2>No encontramos centrales con esos filtros</h2><p>Prueba quitando la ciudad o busca por el código que te entregó la central.</p></div>}
          </div>
        </section>
      ) : (
        <section className="cg-driver-content">
          <div className="grid gap-4 lg:grid-cols-2">
            {applications.map((application) => (
              <article key={application.id} className="cg-application-card">
                <div className="flex items-start justify-between gap-3">
                  <div><p className="cg-card-kicker">{application.companyCode}</p><h2>{application.companyName}</h2><p><MapPin /> {[application.companyCity, application.companyCountryCode].filter(Boolean).join(', ')}</p></div>
                  <span className={`cg-status-chip ${statusStyle[application.status]}`}>{application.status === 'approved' ? <CheckCircle2 /> : <Clock3 />}{statusLabel[application.status]}</span>
                </div>
                <div className="cg-application-summary"><span><BadgeCheck /> Licencia {application.licenseNumber}</span><span><FileCheck2 /> Identidad enviada</span></div>
                {application.status === 'pending' && <p className="cg-application-note">La central está validando tus antecedentes. Puedes seguir buscando, pero al aprobarse una solicitud las demás se retirarán automáticamente.</p>}
                {application.status === 'approved' && <p className="cg-application-note cg-application-note-success">Acceso aprobado. Pulsa Actualizar para entrar a la interfaz operativa.</p>}
                {application.status === 'rejected' && <p className="cg-application-note cg-application-note-error">{application.rejectionReason || 'La central rechazó esta solicitud. Puedes corregir los antecedentes y volver a postular.'}</p>}
              </article>
            ))}
            {!applications.length && <div className="cg-empty-state lg:col-span-2"><Send /><h2>Aún no has enviado solicitudes</h2><p>Busca una central y prepara tu documentación.</p></div>}
          </div>
        </section>
      )}

      {selectedCentral && (
        <div className="cg-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) resetApplication(); }}>
          <section className="cg-driver-application-modal" role="dialog" aria-modal="true" aria-labelledby="driver-application-title">
            <header>
              <div><p className="cg-card-kicker">Postulación a {selectedCentral.code}</p><h2 id="driver-application-title">{selectedCentral.name}</h2><p>Completa antecedentes válidos para tu país. Aceptamos fotos legibles o archivos PDF.</p></div>
              <button type="button" disabled={busy} onClick={resetApplication} aria-label="Cerrar"><X /></button>
            </header>
            <form onSubmit={sendApplication} className="cg-driver-application-form">
              <div className="cg-form-row">
                <label className="cg-field"><span>Nombre completo</span><input required value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} /></label>
                <label className="cg-field"><span>Teléfono</span><input required type="tel" value={form.phone} onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))} /></label>
              </div>
              <div className="cg-form-row">
                <label className="cg-field"><span>Cédula / documento de identidad</span><input required value={form.nationalId} onChange={(event) => setForm((current) => ({ ...current, nationalId: event.target.value.toUpperCase() }))} placeholder="RUT, DNI, pasaporte…" /></label>
                <label className="cg-field"><span>Número de licencia</span><input required value={form.licenseNumber} onChange={(event) => setForm((current) => ({ ...current, licenseNumber: event.target.value.toUpperCase() }))} /></label>
              </div>
              <WorldCountrySelect value={form.licenseCountryCode} onChange={(value) => setForm((current) => ({ ...current, licenseCountryCode: value }))} label="País que emitió la licencia" />
              <div className="cg-upload-grid">
                <FilePicker required label="Documento de identidad" detail="Fotos o PDF; puedes adjuntar frente y reverso" files={identityFiles} onChange={setIdentityFiles} />
                <FilePicker required label="Licencia de conducir" detail="Fotos claras o PDF vigente" files={licenseFiles} onChange={setLicenseFiles} />
              </div>
              <label className="cg-field"><span>Mensaje para la central (opcional)</span><textarea rows={3} maxLength={500} value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} placeholder="Experiencia, disponibilidad u otra información relevante" /></label>

              <label className="cg-vehicle-toggle"><input type="checkbox" checked={withVehicle} onChange={(event) => setWithVehicle(event.target.checked)} /><span><CarFront /><span><strong>También quiero proponer un vehículo</strong><small>La central decidirá si lo incorpora a la flota.</small></span></span></label>

              {withVehicle && (
                <div className="cg-vehicle-form">
                  <div className="cg-form-row">
                    <label className="cg-field"><span>Patente / matrícula</span><input required value={vehicle.plate} onChange={(event) => setVehicle((current) => ({ ...current, plate: event.target.value.toUpperCase() }))} /></label>
                    <WorldCountrySelect value={vehicle.countryCode} onChange={(value) => setVehicle((current) => ({ ...current, countryCode: value }))} label="País de inscripción" />
                  </div>
                  <div className="cg-form-row cg-form-row-3">
                    <label className="cg-field"><span>Marca</span><input required value={vehicle.brand} onChange={(event) => setVehicle((current) => ({ ...current, brand: event.target.value }))} /></label>
                    <label className="cg-field"><span>Modelo</span><input required value={vehicle.model} onChange={(event) => setVehicle((current) => ({ ...current, model: event.target.value }))} /></label>
                    <label className="cg-field"><span>Año</span><input required type="number" min="1950" max="2200" value={vehicle.year} onChange={(event) => setVehicle((current) => ({ ...current, year: event.target.value }))} /></label>
                  </div>
                  <div className="cg-form-row cg-form-row-3">
                    <label className="cg-field"><span>Color</span><input value={vehicle.color} onChange={(event) => setVehicle((current) => ({ ...current, color: event.target.value }))} /></label>
                    <label className="cg-field"><span>Capacidad</span><input required type="number" min="1" max="20" value={vehicle.capacity} onChange={(event) => setVehicle((current) => ({ ...current, capacity: event.target.value }))} /></label>
                    <label className="cg-field"><span>Vence revisión técnica</span><input type="date" value={vehicle.inspectionExpiry} onChange={(event) => setVehicle((current) => ({ ...current, inspectionExpiry: event.target.value }))} /></label>
                  </div>
                  <div className="cg-upload-grid">
                    <FilePicker required label="Inscripción / padrón" detail="Obligatorio para proponer el vehículo" files={registrationFiles} onChange={setRegistrationFiles} />
                    <FilePicker label="Seguro" detail="Opcional según el país" files={insuranceFiles} onChange={setInsuranceFiles} />
                    <FilePicker label="Revisión técnica" detail="Opcional según el país" files={inspectionFiles} onChange={setInspectionFiles} />
                  </div>
                </div>
              )}

              <div className="cg-document-privacy"><ShieldCheck /><p><strong>Privacidad documental</strong><span>Los archivos no son públicos. La central solo podrá revisarlos después de que envíes esta solicitud.</span></p></div>
              {progress && <div className="cg-alert cg-alert-info"><Loader2 className="mr-1.5 inline h-4 w-4 animate-spin" />{progress}</div>}
              <button disabled={busy} className="cg-primary-button">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}{busy ? 'Enviando antecedentes…' : 'Enviar solicitud protegida'}</button>
            </form>
          </section>
        </div>
      )}
    </main>
  );
};

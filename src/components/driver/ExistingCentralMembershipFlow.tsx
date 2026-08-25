import React, { useMemo, useState } from 'react';
import { BadgeCheck, Building2, CheckCircle2, LocateFixed, Loader2, Mail, MapPin, Search, ShieldCheck, UserRoundCheck, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { requestExistingCentralMembership } from '../../lib/existingCentralMembershipRepository';
import { searchCentrals, type CentralDirectoryItem } from '../../lib/driverMarketplaceRepository';
import { WorldCitySelect, WorldCountrySelect } from '../auth/WorldLocationPicker';

const distanceLabel = (distanceKm: number | null) => {
  if (distanceKm == null || !Number.isFinite(distanceKm)) return '';
  if (distanceKm < 1) return `${Math.max(1, Math.round(distanceKm * 1000))} m`;
  return `${distanceKm.toFixed(distanceKm < 10 ? 1 : 0)} km`;
};

export const ExistingCentralMembershipFlow: React.FC = () => {
  const { profile, saasAccount, authUser } = useAuth();
  const [open, setOpen] = useState(false);
  const [countryCode, setCountryCode] = useState(saasAccount?.countryCode ?? 'CL');
  const [city, setCity] = useState(saasAccount?.city ?? '');
  const [query, setQuery] = useState('');
  const [centrals, setCentrals] = useState<CentralDirectoryItem[]>([]);
  const [selected, setSelected] = useState<CentralDirectoryItem | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [form, setForm] = useState({
    name: profile?.name ?? '',
    phone: profile?.phone ?? '',
    nationalIdNumber: '',
    licenseNumber: '',
    unitNumber: '',
    notes: '',
  });

  const sorted = useMemo(() => [...centrals].sort((a, b) => {
    if (a.distanceKm == null && b.distanceKm == null) return a.name.localeCompare(b.name);
    if (a.distanceKm == null) return 1;
    if (b.distanceKm == null) return -1;
    return a.distanceKm - b.distanceKm;
  }), [centrals]);

  const runSearch = async (filters?: { lat?: number; lng?: number }) => {
    setLoading(true);
    setError('');
    try {
      setCentrals(await searchCentrals({
        countryCode,
        city: filters ? '' : city,
        query,
        lat: filters?.lat,
        lng: filters?.lng,
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No fue posible buscar centrales.');
    } finally {
      setLoading(false);
    }
  };

  const searchNearby = () => {
    if (!navigator.geolocation) {
      setError('Este dispositivo no permite obtener tu ubicación. Busca por país o ciudad.');
      return;
    }
    setLoading(true);
    setError('');
    navigator.geolocation.getCurrentPosition(
      (position) => void runSearch({ lat: position.coords.latitude, lng: position.coords.longitude }),
      () => { setLoading(false); setError('No pudimos obtener tu ubicación. Busca por país o ciudad.'); },
      { enableHighAccuracy: true, maximumAge: 30000, timeout: 12000 },
    );
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selected) return;
    if (form.name.trim().length < 2 || form.nationalIdNumber.trim().length < 3 || form.licenseNumber.trim().length < 3) {
      setError('Completa tu nombre, RUT/documento y número de licencia.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await requestExistingCentralMembership({
        companyId: selected.id,
        applicantName: form.name,
        phone: form.phone,
        nationalIdNumber: form.nationalIdNumber,
        licenseNumber: form.licenseNumber,
        claimedUnitNumber: form.unitNumber,
        notes: form.notes,
      });
      setNotice(`Solicitud enviada a ${selected.name}. La central verá tu nombre, RUT/documento y correo por separado antes de aprobarte.`);
      window.setTimeout(() => window.location.reload(), 900);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No fue posible enviar la solicitud.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => { setOpen(true); setError(''); setNotice(''); if (!centrals.length) void runSearch(); }}
        className="fixed bottom-20 right-4 z-[120] inline-flex max-w-[calc(100vw-2rem)] items-center gap-2 rounded-2xl border border-cyan-300/35 bg-[#07131f]/95 px-4 py-3 text-xs font-black text-cyan-100 shadow-2xl backdrop-blur-xl sm:bottom-6 sm:right-6"
      >
        <BadgeCheck className="h-4 w-4 text-cyan-300" /> Ya pertenezco a una central
      </button>

      {open && (
        <div className="fixed inset-0 z-[150] flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:p-4" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) setOpen(false); }}>
          <section className="max-h-[92vh] w-full overflow-y-auto rounded-t-3xl border border-cyan-500/25 bg-[#090d13] p-4 shadow-2xl sm:max-w-3xl sm:rounded-3xl sm:p-6">
            <header className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-cyan-300">Vinculación rápida</p>
                <h2 className="mt-1 text-xl font-black text-white">Ya pertenezco a una central</h2>
                <p className="mt-2 max-w-2xl text-xs leading-relaxed text-zinc-400">Busca la central donde ya trabajas. No tendrás que subir cédula, fotos ni documentos; solo escribe tus datos para que la central pueda identificarte correctamente.</p>
              </div>
              <button type="button" disabled={busy} onClick={() => setOpen(false)} className="rounded-xl border border-zinc-800 bg-zinc-950 p-2 text-zinc-400"><X className="h-4 w-4" /></button>
            </header>

            <div className="mt-4 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-3 text-[10px] leading-relaxed text-emerald-100">
              <ShieldCheck className="mr-1.5 inline h-4 w-4 text-emerald-300" /><strong>Identidad separada del correo.</strong> Tu nombre y RUT/documento serán los datos visibles del conductor; el correo queda solo como credencial de acceso.
            </div>

            {error && <div className="mt-3 rounded-xl border border-rose-500/25 bg-rose-500/10 p-3 text-xs text-rose-200">{error}</div>}
            {notice && <div className="mt-3 rounded-xl border border-emerald-500/25 bg-emerald-500/10 p-3 text-xs text-emerald-200"><CheckCircle2 className="mr-1.5 inline h-4 w-4" />{notice}</div>}

            {!selected ? (
              <>
                <div className="mt-5 grid gap-3 md:grid-cols-[1fr_1fr_1.2fr_auto]">
                  <WorldCountrySelect value={countryCode} onChange={(value) => { setCountryCode(value); setCity(''); setCentrals([]); }} label="País" />
                  <WorldCitySelect countryCode={countryCode} value={city} onChange={setCity} label="Ciudad" />
                  <label className="flex flex-col gap-1.5 text-[10px] font-bold text-zinc-400"><span>Nombre o código</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Nombre de la central" className="rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-3 text-xs text-white outline-none focus:border-cyan-400" /></label>
                  <button type="button" disabled={loading} onClick={() => void runSearch()} className="mt-auto inline-flex items-center justify-center gap-2 rounded-xl bg-cyan-500 px-4 py-3 text-xs font-black text-slate-950 disabled:opacity-50">{loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}Buscar</button>
                </div>
                <button type="button" disabled={loading} onClick={searchNearby} className="mt-3 inline-flex items-center gap-2 rounded-xl border border-cyan-500/25 bg-cyan-500/10 px-4 py-2.5 text-[10px] font-black text-cyan-200"><LocateFixed className="h-4 w-4" />Buscar las más cercanas con mi ubicación</button>

                <div className="mt-4 grid gap-2">
                  {sorted.slice(0, 20).map((central, index) => (
                    <button key={central.id} type="button" onClick={() => { setSelected(central); setError(''); }} className="flex items-center gap-3 rounded-2xl border border-zinc-800 bg-[#0d1118] p-3 text-left transition hover:border-cyan-500/40">
                      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-cyan-500/20 bg-cyan-500/10 text-cyan-300"><Building2 className="h-5 w-5" /></span>
                      <span className="min-w-0 flex-1"><strong className="block truncate text-sm text-white">{central.name}</strong><small className="mt-0.5 block text-[10px] text-zinc-500"><MapPin className="mr-1 inline h-3 w-3" />{[central.city, central.countryCode].filter(Boolean).join(', ')} · {central.code}</small></span>
                      {distanceLabel(central.distanceKm) && <span className="rounded-full border border-cyan-500/20 bg-cyan-500/10 px-2 py-1 text-[9px] font-black text-cyan-200">{index === 0 ? 'Más cerca · ' : ''}{distanceLabel(central.distanceKm)}</span>}
                    </button>
                  ))}
                  {!loading && !sorted.length && <div className="rounded-2xl border border-dashed border-zinc-800 p-6 text-center text-xs text-zinc-500">Busca por país/ciudad o usa tu ubicación para encontrar tu central.</div>}
                </div>
              </>
            ) : (
              <form onSubmit={submit} className="mt-5 space-y-4">
                <button type="button" onClick={() => setSelected(null)} className="flex w-full items-center gap-3 rounded-2xl border border-cyan-500/25 bg-cyan-500/5 p-3 text-left">
                  <span className="grid h-10 w-10 place-items-center rounded-xl bg-cyan-500/10 text-cyan-300"><Building2 className="h-5 w-5" /></span>
                  <span className="flex-1"><strong className="block text-sm text-white">{selected.name}</strong><small className="text-[10px] text-zinc-500">{selected.code} · {[selected.city, selected.countryCode].filter(Boolean).join(', ')}</small></span>
                  <span className="text-[9px] font-black text-cyan-300">Cambiar</span>
                </button>

                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="flex flex-col gap-1.5 text-[10px] font-bold text-zinc-400"><span>Nombre completo</span><input required value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} placeholder="Nombre y apellidos" className="rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-3 text-xs text-white outline-none focus:border-cyan-400" /></label>
                  <label className="flex flex-col gap-1.5 text-[10px] font-bold text-zinc-400"><span>RUT / documento de identidad</span><input required value={form.nationalIdNumber} onChange={(event) => setForm((current) => ({ ...current, nationalIdNumber: event.target.value.toUpperCase() }))} placeholder="Ej. 12.345.678-9" className="rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-3 text-xs text-white outline-none focus:border-cyan-400" /></label>
                  <label className="flex flex-col gap-1.5 text-[10px] font-bold text-zinc-400"><span>Teléfono</span><input type="tel" value={form.phone} onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))} className="rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-3 text-xs text-white outline-none focus:border-cyan-400" /></label>
                  <label className="flex flex-col gap-1.5 text-[10px] font-bold text-zinc-400"><span>Número de licencia</span><input required value={form.licenseNumber} onChange={(event) => setForm((current) => ({ ...current, licenseNumber: event.target.value.toUpperCase() }))} placeholder="Solo el número, no se adjunta documento" className="rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-3 text-xs text-white outline-none focus:border-cyan-400" /></label>
                  <label className="flex flex-col gap-1.5 text-[10px] font-bold text-zinc-400 sm:col-span-2"><span>Correo de acceso</span><div className="relative"><Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-600" /><input readOnly value={authUser?.email ?? ''} className="w-full rounded-xl border border-zinc-800 bg-zinc-900/70 py-3 pl-10 pr-3 text-xs text-zinc-400 outline-none" /></div><small className="font-normal text-zinc-600">El correo identifica tu cuenta, pero no reemplazará tu nombre ni tu RUT.</small></label>
                  <label className="flex flex-col gap-1.5 text-[10px] font-bold text-zinc-400 sm:col-span-2"><span>N.º de móvil actual (opcional)</span><input value={form.unitNumber} onChange={(event) => setForm((current) => ({ ...current, unitNumber: event.target.value }))} placeholder="Ej. 27" className="rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-3 text-xs text-white outline-none focus:border-cyan-400" /></label>
                </div>
                <label className="flex flex-col gap-1.5 text-[10px] font-bold text-zinc-400"><span>Mensaje para la central (opcional)</span><textarea rows={3} maxLength={500} value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} placeholder="Turno, móvil habitual u otro dato que ayude a reconocerte" className="rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-3 text-xs text-white outline-none focus:border-cyan-400" /></label>

                <div className="rounded-2xl border border-blue-500/20 bg-blue-500/5 p-3 text-[10px] leading-relaxed text-blue-100"><UserRoundCheck className="mr-1.5 inline h-4 w-4 text-blue-300" />La central recibirá <strong>nombre completo + RUT/documento + licencia + correo de cuenta</strong> de forma separada. Al aprobarte, tu móvil mostrará tu nombre, nunca el correo como nombre del conductor.</div>
                <button disabled={busy} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-3.5 text-xs font-black text-white disabled:opacity-50">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <BadgeCheck className="h-4 w-4" />}{busy ? 'Enviando vinculación…' : 'Solicitar vinculación sin documentos'}</button>
              </form>
            )}
          </section>
        </div>
      )}
    </>
  );
};

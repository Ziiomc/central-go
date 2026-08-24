import React, { useEffect, useState } from 'react';
import { Building2, LocateFixed, Loader2, LogOut, MapPin, RefreshCw, Send } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { searchCentrals, type CentralDirectoryItem } from '../../lib/driverMarketplaceRepositoryBase';
import { loadMyOperatorApplications, requestOperatorJoin, type OperatorApplication } from '../../lib/operatorRepository';

export const OperatorOnboardingPortal: React.FC = () => {
  const { profile, saasAccount, signOut } = useAuth();
  const [centrals, setCentrals] = useState<CentralDirectoryItem[]>([]);
  const [applications, setApplications] = useState<OperatorApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [locating, setLocating] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = async (coords?: { lat: number; lng: number }) => {
    setLoading(true); setError('');
    try {
      const [directory, own] = await Promise.all([
        searchCentrals({ countryCode: saasAccount?.countryCode ?? undefined, city: coords ? undefined : saasAccount?.city ?? undefined, ...coords }),
        loadMyOperatorApplications(),
      ]);
      setCentrals(directory); setApplications(own);
    } catch (err) { setError(err instanceof Error ? err.message : 'No fue posible cargar las centrales.'); }
    finally { setLoading(false); setLocating(false); }
  };

  useEffect(() => { void load(); }, [saasAccount?.countryCode, saasAccount?.city]);

  const useLocation = () => {
    if (!navigator.geolocation) { setError('Este dispositivo no permite obtener ubicación.'); return; }
    setLocating(true); setError('');
    navigator.geolocation.getCurrentPosition(
      (position) => void load({ lat: position.coords.latitude, lng: position.coords.longitude }),
      () => { setLocating(false); setError('No pudimos obtener tu ubicación. Puedes elegir una central de la lista.'); },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 },
    );
  };

  const request = async (central: CentralDirectoryItem) => {
    setBusyId(central.id); setError(''); setNotice('');
    try { await requestOperatorJoin(central.id); setNotice(`Solicitud enviada a ${central.name}. Su administración debe aprobarla.`); await load(); }
    catch (err) { setError(err instanceof Error ? err.message : 'No fue posible enviar la solicitud.'); }
    finally { setBusyId(null); }
  };

  const pending = applications.find((item) => item.status === 'pending');
  return <main className="min-h-screen bg-[#09090b] p-4 text-zinc-100 sm:p-8"><div className="mx-auto max-w-4xl space-y-6">
    <header className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-[10px] font-black uppercase tracking-[.22em] text-blue-400">Portal de operadora</p><h1 className="mt-2 text-3xl font-black">Hola, {profile?.name ?? 'operadora'}</h1><p className="mt-2 max-w-2xl text-sm text-zinc-400">Encuentra la central más cercana y solicita incorporarte. El acceso operativo comienza cuando la central aprueba la solicitud.</p></div><button onClick={() => void signOut()} className="flex items-center gap-2 rounded-xl border border-zinc-800 px-4 py-2 text-xs font-bold text-zinc-400"><LogOut className="h-4 w-4" />Salir</button></header>
    {pending && <section className="rounded-2xl border border-amber-500/25 bg-amber-500/10 p-5"><p className="text-[10px] font-black uppercase tracking-wider text-amber-300">Solicitud pendiente</p><h2 className="mt-1 font-black">{pending.companyName}</h2><p className="mt-1 text-xs text-amber-100/70">La administración de la central debe aprobar tu ingreso.</p></section>}
    {notice && <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 p-4 text-xs font-bold text-emerald-200">{notice}</div>}{error && <div className="rounded-xl border border-rose-500/25 bg-rose-500/10 p-4 text-xs font-bold text-rose-200">{error}</div>}
    <section className="rounded-3xl border border-zinc-800 bg-[#0d0d0f] p-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="flex items-center gap-2 text-lg font-black"><Building2 className="h-5 w-5 text-blue-400" />Centrales disponibles</h2><p className="mt-1 text-xs text-zinc-500">Activa la ubicación para ordenarlas por distancia real.</p></div><div className="flex gap-2"><button onClick={useLocation} disabled={locating} className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-black disabled:opacity-50">{locating?<Loader2 className="h-4 w-4 animate-spin"/>:<LocateFixed className="h-4 w-4"/>}Más cercana</button><button onClick={() => void load()} className="rounded-xl border border-zinc-800 p-2.5 text-zinc-400"><RefreshCw className="h-4 w-4" /></button></div></div>
      {loading ? <div className="mt-5 flex items-center gap-2 text-xs text-zinc-500"><Loader2 className="h-4 w-4 animate-spin" />Buscando centrales…</div> : <div className="mt-5 grid gap-3 sm:grid-cols-2">{centrals.map((central,index)=><article key={central.id} className={`rounded-2xl border p-4 ${index===0&&central.distanceKm!=null?'border-blue-500/40 bg-blue-500/[.06]':'border-zinc-800 bg-zinc-950/60'}`}><div className="flex items-start justify-between gap-3"><div><h3 className="font-black">{central.name}</h3><p className="mt-1 flex items-center gap-1 text-[10px] text-zinc-500"><MapPin className="h-3 w-3" />{central.city||central.countryCode}{central.distanceKm!=null?` · ${central.distanceKm} km`:''}</p></div>{index===0&&central.distanceKm!=null&&<span className="rounded-full bg-blue-500/15 px-2 py-1 text-[8px] font-black uppercase text-blue-300">Más cercana</span>}</div><button disabled={Boolean(pending)||busyId===central.id} onClick={()=>void request(central)} className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-blue-500/30 bg-blue-500/10 py-2.5 text-[10px] font-black text-blue-300 disabled:opacity-40">{busyId===central.id?<Loader2 className="h-4 w-4 animate-spin"/>:<Send className="h-4 w-4"/>}Solicitar unirme</button></article>)}</div>}
      {!loading&&!centrals.length&&<p className="mt-5 rounded-xl border border-zinc-800 p-5 text-center text-xs text-zinc-500">No encontramos centrales activas en esta zona.</p>}
    </section>
  </div></main>;
};

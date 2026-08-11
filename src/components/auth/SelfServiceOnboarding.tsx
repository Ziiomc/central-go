import React, { useMemo, useState } from 'react';
import { ArrowRight, Building2, Check, Loader2, MapPin, Phone, Store, UserRound } from 'lucide-react';
import { completeSelfServiceOnboarding } from '../../lib/saasAccessRepository';
import { useAuth } from '../../context/AuthContext';
import centralGoLogo from '../../assets/images/central-go-logo.svg';

type Kind = 'central' | 'sales_partner';

export const SelfServiceOnboarding: React.FC = () => {
  const { authUser, profile, refreshIdentity, signOut } = useAuth();
  const suggestedName = useMemo(() => profile?.name || authUser?.user_metadata?.full_name || authUser?.user_metadata?.name || '', [profile, authUser]);
  const [kind, setKind] = useState<Kind | null>(null);
  const [form, setForm] = useState({ name: suggestedName, phone: '', city: '', countryCode: 'CL', companyName: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!kind) return;
    setSaving(true); setError('');
    try {
      await completeSelfServiceOnboarding({
        accountKind: kind,
        name: form.name,
        phone: form.phone,
        city: form.city,
        countryCode: form.countryCode,
        companyName: kind === 'central' ? form.companyName : undefined,
      });
      await refreshIdentity();
      window.location.replace('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No fue posible crear tu cuenta.');
    } finally { setSaving(false); }
  };

  return (
    <main className="min-h-screen bg-[#070709] text-zinc-100 px-4 py-8 sm:py-12">
      <div className="mx-auto max-w-5xl">
        <header className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3"><img src={centralGoLogo} alt="Central GO" className="h-12 w-12 rounded-2xl border border-amber-400/60 bg-zinc-950 p-1" /><div><p className="text-[10px] font-black uppercase tracking-[.2em] text-amber-300">Central GO Oficial</p><p className="text-sm font-bold text-zinc-400">Configura tu cuenta en menos de 1 minuto</p></div></div>
          <button onClick={() => void signOut()} className="rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-[10px] font-bold text-zinc-400 hover:text-white">Salir</button>
        </header>

        <section className="mt-10 text-center">
          <span className="inline-flex rounded-full border border-emerald-500/25 bg-emerald-500/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-emerald-300">5 días gratis · sin tarjeta para comenzar</span>
          <h1 className="mx-auto mt-4 max-w-3xl text-3xl font-black tracking-tight text-white sm:text-5xl">¿Cómo vas a usar Central GO?</h1>
          <p className="mx-auto mt-3 max-w-2xl text-sm leading-relaxed text-zinc-400">Entra con todas las funciones disponibles durante cinco días. Después eliges cómo continuar.</p>
        </section>

        {!kind ? (
          <div className="mt-9 grid gap-4 md:grid-cols-2">
            <Choice icon={Building2} title="Soy una Central" detail="Despacho, mapa, flota, carreras, clientes, usuarios y app de conductores durante la prueba." bullets={['Panel operativo completo','5 días con funciones Enterprise','Luego eliges Start, Pro o Enterprise']} onClick={() => setKind('central')} accent="amber" />
            <Choice icon={Store} title="Soy Partner Comercial" detail="Panel para vender Central GO, registrar centrales, consultar planes, cartera y comisiones." bullets={['Acceso directo al panel comercial','Catálogo de precios sincronizado','Centrales referidas y comisiones']} onClick={() => setKind('sales_partner')} accent="blue" />
          </div>
        ) : (
          <form onSubmit={submit} className="mx-auto mt-9 max-w-2xl rounded-3xl border border-zinc-800 bg-[#0d0d0f] p-5 shadow-2xl sm:p-7">
            <div className="flex items-start justify-between gap-3 border-b border-zinc-800 pb-5"><div><p className="text-[10px] font-black uppercase tracking-wider text-amber-300">{kind === 'central' ? 'Registro de Central' : 'Registro de Partner Comercial'}</p><h2 className="mt-1 text-xl font-black text-white">Completa tus datos</h2></div><button type="button" onClick={() => setKind(null)} className="text-[10px] font-bold text-zinc-500 hover:text-white">Cambiar tipo</button></div>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <Field icon={UserRound} label="Tu nombre" value={form.name} onChange={(name) => setForm((p) => ({ ...p, name }))} placeholder="Nombre y apellido" required />
              <Field icon={Phone} label="Teléfono" value={form.phone} onChange={(phone) => setForm((p) => ({ ...p, phone }))} placeholder="+56 9..." />
              <Field icon={MapPin} label="Ciudad" value={form.city} onChange={(city) => setForm((p) => ({ ...p, city }))} placeholder="Linares" />
              <label className="block"><span className="mb-1.5 block text-[10px] font-black uppercase tracking-wider text-zinc-500">País</span><select value={form.countryCode} onChange={(e) => setForm((p) => ({ ...p, countryCode: e.target.value }))} className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-3 text-sm text-white outline-none focus:border-amber-400/60"><option value="CL">Chile</option><option value="AR">Argentina</option><option value="PE">Perú</option><option value="BO">Bolivia</option><option value="UY">Uruguay</option><option value="PY">Paraguay</option><option value="CO">Colombia</option><option value="MX">México</option></select></label>
            </div>

            {kind === 'central' && <div className="mt-4"><Field icon={Building2} label="Nombre de la central" value={form.companyName} onChange={(companyName) => setForm((p) => ({ ...p, companyName }))} placeholder="Ej: Radio Taxi Linares" required /></div>}

            <div className="mt-5 rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.06] p-4"><div className="flex gap-3"><div className="mt-0.5 rounded-full bg-emerald-500/15 p-1 text-emerald-300"><Check className="h-4 w-4" /></div><div><p className="text-xs font-black text-emerald-200">Tu prueba empieza al crear la cuenta</p><p className="mt-1 text-[10px] leading-relaxed text-zinc-500">Tendrás 5 días completos. No se borran tus datos cuando termina: simplemente se bloquea la operación hasta activar el servicio.</p></div></div></div>
            {error && <div className="mt-4 rounded-xl border border-rose-500/25 bg-rose-500/10 px-4 py-3 text-xs font-bold text-rose-200">{error}</div>}
            <button disabled={saving || !form.name.trim() || (kind === 'central' && !form.companyName.trim())} className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-amber-400 px-4 py-3.5 text-sm font-black text-zinc-950 shadow-lg shadow-amber-500/10 disabled:opacity-50">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}{saving ? 'Creando tu cuenta…' : 'Comenzar mis 5 días gratis'}</button>
          </form>
        )}
      </div>
    </main>
  );
};

const Choice: React.FC<{ icon: any; title: string; detail: string; bullets: string[]; onClick: () => void; accent: 'amber'|'blue' }> = ({ icon: Icon,title,detail,bullets,onClick,accent }) => {
  const tone = accent === 'amber' ? 'border-amber-400/25 hover:border-amber-400/60 bg-amber-400/[0.03]' : 'border-blue-500/25 hover:border-blue-500/60 bg-blue-500/[0.03]';
  const iconTone = accent === 'amber' ? 'text-amber-300 bg-amber-400/10 border-amber-400/20' : 'text-blue-300 bg-blue-500/10 border-blue-500/20';
  return <button onClick={onClick} className={`group rounded-3xl border p-6 text-left transition hover:-translate-y-0.5 hover:bg-zinc-900/80 ${tone}`}><div className={`inline-flex rounded-2xl border p-3 ${iconTone}`}><Icon className="h-7 w-7" /></div><h2 className="mt-5 text-2xl font-black text-white">{title}</h2><p className="mt-2 min-h-[48px] text-sm leading-relaxed text-zinc-400">{detail}</p><div className="mt-5 space-y-2">{bullets.map((item) => <div key={item} className="flex items-center gap-2 text-[11px] font-bold text-zinc-300"><Check className="h-3.5 w-3.5 text-emerald-400" />{item}</div>)}</div><div className="mt-6 flex items-center gap-2 text-xs font-black text-white">Elegir esta opción <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" /></div></button>;
};

const Field: React.FC<{ icon: any; label: string; value: string; onChange: (value: string) => void; placeholder: string; required?: boolean }> = ({ icon: Icon,label,value,onChange,placeholder,required }) => <label className="block"><span className="mb-1.5 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-zinc-500"><Icon className="h-3.5 w-3.5" />{label}</span><input required={required} value={value} onChange={(e)=>onChange(e.target.value)} placeholder={placeholder} className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-3 text-sm text-white outline-none focus:border-amber-400/60" /></label>;

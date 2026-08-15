import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowDownCircle,
  ArrowUpCircle,
  BadgeDollarSign,
  Building2,
  Check,
  Copy,
  Globe2,
  Loader2,
  MapPinned,
  MessageCircle,
  RefreshCw,
  Search,
  ShieldCheck,
  Trash2,
  TrendingUp,
  UserPlus,
  UsersRound,
  WalletCards,
  X,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import {
  archivePartnerProfile,
  changePartnerKind,
  inviteNetworkPartner,
  loadVisiblePartners,
  setPartnerStatus,
  type PartnerDirectoryItem,
} from '../../lib/partnerRepository';
import { money, NetworkKpi } from '../network/NetworkUi';
import { CommercialPartnerApplicationsPanel } from './CommercialPartnerApplicationsPanel';

const PRIMARY_OWNER_EMAIL = 'ziiomc3@gmail.com';

export const PartnersNetworkModule: React.FC = () => {
  const { currentRole } = useApp();
  const { authUser } = useAuth();
  const isSuper = currentRole === 'super_admin';
  const canManagePartners = isSuper && authUser?.email?.trim().toLowerCase() === PRIMARY_OWNER_EMAIL;
  const [partners, setPartners] = useState<PartnerDirectoryItem[]>([]);
  const [query, setQuery] = useState('');
  const [tier, setTier] = useState<'all' | 'regional' | 'sales'>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [inviteOpen, setInviteOpen] = useState(false);
  const [changingId, setChangingId] = useState<string | null>(null);
  const [roleTarget, setRoleTarget] = useState<PartnerDirectoryItem | null>(null);

  const reload = async () => {
    setLoading(true); setError('');
    try { setPartners(await loadVisiblePartners()); }
    catch (err) { setError(err instanceof Error ? err.message : 'No fue posible cargar los partners.'); }
    finally { setLoading(false); }
  };

  useEffect(() => { void reload(); }, []);

  const filtered = useMemo(() => partners.filter((partner) => {
    const matchesTier = tier === 'all' || partner.kind === tier;
    const q = query.trim().toLowerCase();
    const territory = partner.territories.map((item) => [item.city, item.region, item.countryCode].filter(Boolean).join(' ')).join(' ');
    return matchesTier && (!q || [partner.name, partner.email, partner.code, territory].join(' ').toLowerCase().includes(q));
  }), [partners, query, tier]);

  const activePartners = partners.filter((partner) => partner.active).length;
  const activeCentrals = partners.reduce((sum, partner) => sum + partner.activeCentralCount, 0);
  const monthlySales = partners.reduce((sum, partner) => sum + partner.monthlySales, 0);
  const available = partners.reduce((sum, partner) => sum + partner.availableCommission, 0);

  const toggleStatus = async (partner: PartnerDirectoryItem) => {
    if (!canManagePartners) return;
    setChangingId(partner.id); setError(''); setNotice('');
    try {
      await setPartnerStatus(partner.id, !partner.active);
      setNotice(`${partner.name}: ${partner.active ? 'partner y acceso suspendidos' : 'partner y acceso activados'}.`);
      await reload();
    } catch (err) { setError(err instanceof Error ? err.message : 'No fue posible cambiar el estado del partner.'); }
    finally { setChangingId(null); }
  };

  const deleteProfile = async (partner: PartnerDirectoryItem) => {
    if (!canManagePartners) return;
    const answer = window.prompt(`Vas a eliminar el perfil operativo de ${partner.name}.\n\nSu acceso quedará bloqueado y desaparecerá del directorio, pero el historial financiero se conservará.\n\nEscribe ELIMINAR para confirmar.`);
    if (answer?.trim().toUpperCase() !== 'ELIMINAR') return;
    setChangingId(partner.id); setError(''); setNotice('');
    try {
      await archivePartnerProfile(partner.id);
      setNotice(`${partner.name}: perfil eliminado del acceso operativo. El historial financiero fue conservado.`);
      await reload();
    } catch (err) { setError(err instanceof Error ? err.message : 'No fue posible eliminar el perfil del partner.'); }
    finally { setChangingId(null); }
  };

  const saveRoleChange = async (partner: PartnerDirectoryItem, nextKind: 'regional' | 'sales', parentPartnerId: string | null) => {
    if (!canManagePartners) return;
    setChangingId(partner.id); setError(''); setNotice('');
    try {
      const result = await changePartnerKind(partner.id, nextKind, parentPartnerId);
      const reassigned = Number(result?.reassignedChildren ?? 0);
      setNotice(`${partner.name}: ahora es ${nextKind === 'regional' ? 'Partner regional' : 'Partner comercial'}${reassigned ? ` · ${reassigned} comercial(es) reasignados` : ''}. La comisión configurada se mantuvo sin cambios.`);
      setRoleTarget(null);
      await reload();
    } catch (err) { setError(err instanceof Error ? err.message : 'No fue posible cambiar el nivel del partner.'); }
    finally { setChangingId(null); }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div><div className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-purple-300 mb-2"><UsersRound className="w-3.5 h-3.5" />Programa Internacional de Partners Central GO</div><h1 className="text-2xl md:text-3xl font-black text-white tracking-tight">{isSuper ? 'Partners y territorios' : 'Mi equipo comercial'}</h1><p className="text-xs text-zinc-400 mt-1">Directorio real, cartera atribuida y comisiones vinculadas a ventas efectivamente registradas.</p></div>
        <div className="flex gap-2"><button onClick={() => void reload()} disabled={loading} className="px-4 py-3 rounded-xl bg-zinc-900 border border-zinc-800 text-xs font-bold text-zinc-300 flex items-center gap-2 disabled:opacity-50"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />Actualizar</button>{isSuper && <button onClick={() => setInviteOpen(true)} className="px-5 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-black text-white flex items-center gap-2"><MessageCircle className="w-4 h-4" />Agregar socio por WhatsApp</button>}</div>
      </div>

      {canManagePartners && <div className="rounded-2xl border border-orange-500/25 bg-orange-500/[0.055] p-4"><div className="flex items-start gap-3"><ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-orange-300"/><div><p className="text-xs font-black text-white">Control exclusivo del Administrador Global</p><p className="mt-1 text-[10px] leading-relaxed text-zinc-400">Sólo tu cuenta puede suspender, reactivar, ascender, degradar o eliminar perfiles de partners. Las acciones críticas quedan registradas en auditoría.</p></div></div></div>}

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <NetworkKpi label="Partners activos" value={String(activePartners)} detail={`${partners.length} registrados visibles`} icon={UsersRound} accent="purple" />
        <NetworkKpi label="Centrales activas" value={String(activeCentrals)} detail="Atribuidas a estos partners" icon={Building2} accent="blue" />
        <NetworkKpi label="Valor mensual cartera" value={money(monthlySales)} detail="Equivalente mensual de suscripciones" icon={TrendingUp} accent="emerald" />
        <NetworkKpi label="Comisión disponible" value={money(available)} detail="Lista para liquidación" icon={WalletCards} accent="amber" />
      </div>

      {error && <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-xs font-bold text-rose-200">{error}</div>}
      {notice && <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-xs font-bold text-emerald-200">{notice}</div>}
      {loading && <div className="flex items-center gap-2 rounded-xl border border-blue-500/20 bg-blue-500/5 px-4 py-3 text-xs font-bold text-blue-300"><Loader2 className="h-4 w-4 animate-spin" />Sincronizando partners…</div>}

      {isSuper && <CommercialPartnerApplicationsPanel onApproved={() => void reload()} />}

      <div className="grid xl:grid-cols-[.72fr_1.28fr] gap-5">
        <section className="rounded-2xl border border-zinc-800 bg-[#0d0d0f] p-5 shadow-xl">
          <div className="flex items-center justify-between gap-3"><div><h2 className="font-extrabold text-white">Estructura territorial</h2><p className="mt-1 text-[10px] text-zinc-500">Regional → comerciales → centrales atribuidas.</p></div><div className="rounded-xl border border-purple-500/20 bg-purple-500/10 p-2 text-purple-300"><Globe2 className="h-5 w-5" /></div></div>
          <div className="mt-5 space-y-3">
            {partners.filter((partner) => partner.kind === 'regional').map((regional) => {
              const children = partners.filter((partner) => partner.parentPartnerId === regional.id);
              const territory = regional.territories[0];
              return <div key={regional.id} className="rounded-2xl border border-purple-500/20 bg-purple-500/[0.04] p-3"><div className="flex items-center justify-between gap-3"><div className="min-w-0"><p className="truncate text-xs font-black text-white">{regional.name}</p><p className="mt-0.5 truncate text-[9px] text-zinc-500">{territory ? [territory.city, territory.region, territory.countryCode].filter(Boolean).join(' · ') : 'Territorio por configurar'}</p></div><span className="rounded-lg border border-purple-500/20 bg-purple-500/10 px-2 py-1 text-[9px] font-black text-purple-300">{children.length} comerciales</span></div>{children.length > 0 && <div className="mt-3 space-y-2 border-l border-zinc-800 pl-3">{children.map((child) => <div key={child.id} className="flex items-center justify-between gap-2 rounded-xl border border-zinc-800 bg-zinc-950/60 p-2.5"><div className="min-w-0"><p className="truncate text-[10px] font-bold text-zinc-300">{child.name}</p><p className="text-[8px] text-zinc-600">{child.activeCentralCount}/{child.centralCount} centrales activas</p></div><span className="text-[9px] font-black text-amber-300">{child.commissionPercent}%</span></div>)}</div>}</div>;
            })}
            {!loading && partners.filter((partner) => partner.kind === 'regional').length === 0 && <div className="rounded-xl border border-zinc-800 bg-zinc-950/50 p-6 text-center text-[10px] text-zinc-500">Aún no hay partners regionales configurados.</div>}
          </div>
          <div className="mt-5 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3.5 text-[10px] leading-relaxed text-emerald-200/80">Las comisiones se originan por suscripciones de clientes. Central GO no paga por reclutar partners.</div>
        </section>

        <section className="rounded-2xl border border-zinc-800 bg-[#0d0d0f] shadow-xl overflow-hidden">
          <div className="p-4 border-b border-zinc-800 flex flex-col lg:flex-row lg:items-center justify-between gap-3"><div className="flex gap-1.5">{[['all','Todos'],['regional','Regionales'],['sales','Comerciales']].map(([id,label]) => <button key={id} onClick={() => setTier(id as typeof tier)} className={`px-3 py-2 rounded-lg text-[10px] font-extrabold border ${tier===id?'bg-purple-500/10 border-purple-500/30 text-purple-300':'border-zinc-800 bg-zinc-950 text-zinc-500'}`}>{label}</button>)}</div><label className="relative min-w-[250px]"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600" /><input value={query} onChange={(e)=>setQuery(e.target.value)} placeholder="Buscar partner, código o territorio..." className="w-full pl-9 pr-3 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white outline-none focus:border-purple-500/50" /></label></div>
          <div className="overflow-x-auto"><table className="w-full min-w-[1080px]"><thead className="bg-zinc-950/50"><tr>{['Partner','Nivel / territorio','Centrales','Cartera mensual','Comisión','Saldo','Estado',canManagePartners?'Control global':''].map((h)=><th key={h} className="p-3 text-left text-[9px] font-black uppercase tracking-widest text-zinc-600 border-b border-zinc-800">{h}</th>)}</tr></thead><tbody>{filtered.map((partner) => { const territory=partner.territories[0]; const childCount=partners.filter((item)=>item.parentPartnerId===partner.id).length; return <tr key={partner.id} className="border-b border-zinc-900 hover:bg-zinc-900/35"><td className="p-3"><p className="text-xs font-black text-white">{partner.name}</p><p className="mt-0.5 text-[9px] text-zinc-600">{partner.email} · {partner.code}</p></td><td className="p-3"><p className={`text-[10px] font-black ${partner.kind==='regional'?'text-purple-300':'text-amber-300'}`}>{partner.kind==='regional'?'Partner regional':'Partner comercial'}</p><p className="mt-0.5 text-[9px] text-zinc-600">{territory?[territory.city,territory.region,territory.countryCode].filter(Boolean).join(', '):partner.parentName?`Regional: ${partner.parentName}`:'Sin territorio'}</p></td><td className="p-3"><p className="text-sm font-black text-white">{partner.activeCentralCount}<span className="text-[9px] text-zinc-600">/{partner.centralCount}</span></p><p className="text-[9px] text-zinc-600">activas</p></td><td className="p-3"><p className="text-[11px] font-black text-white">{money(partner.monthlySales)}</p></td><td className="p-3"><p className="text-[11px] font-black text-amber-300">{partner.commissionPercent}%</p></td><td className="p-3"><p className="text-[10px] font-black text-emerald-300">{money(partner.availableCommission)}</p><p className="text-[9px] text-zinc-600">+ {money(partner.pendingCommission)} pendiente</p></td><td className="p-3"><span className={`rounded-full border px-2.5 py-1 text-[9px] font-black uppercase ${partner.active?'border-emerald-500/25 bg-emerald-500/10 text-emerald-300':'border-rose-500/25 bg-rose-500/10 text-rose-300'}`}>{partner.active?'Activo':'Suspendido'}</span></td><td className="p-3">{canManagePartners&&<div className="flex min-w-[230px] flex-wrap gap-1.5"><button disabled={changingId===partner.id} onClick={() => void toggleStatus(partner)} className={`rounded-lg border px-2.5 py-2 text-[9px] font-black disabled:opacity-40 ${partner.active?'border-rose-500/20 bg-rose-500/10 text-rose-300':'border-emerald-500/20 bg-emerald-500/10 text-emerald-300'}`}>{partner.active?'Suspender':'Activar'}</button><button disabled={changingId===partner.id} onClick={() => setRoleTarget(partner)} className={`flex items-center gap-1 rounded-lg border px-2.5 py-2 text-[9px] font-black disabled:opacity-40 ${partner.kind==='sales'?'border-purple-500/25 bg-purple-500/10 text-purple-300':'border-amber-500/25 bg-amber-500/10 text-amber-300'}`}>{partner.kind==='sales'?<ArrowUpCircle className="h-3.5 w-3.5"/>:<ArrowDownCircle className="h-3.5 w-3.5"/>}{partner.kind==='sales'?'Ascender a regional':'Degradar a comercial'}</button><button disabled={changingId===partner.id||childCount>0} onClick={() => void deleteProfile(partner)} title={childCount>0?'Primero debes reasignar sus partners comerciales':'Eliminar perfil y bloquear acceso'} className="flex items-center gap-1 rounded-lg border border-red-500/25 bg-red-500/10 px-2.5 py-2 text-[9px] font-black text-red-300 disabled:cursor-not-allowed disabled:opacity-35"><Trash2 className="h-3.5 w-3.5"/>Eliminar perfil</button></div>}</td></tr>; })}</tbody></table>{!loading&&filtered.length===0&&<div className="p-12 text-center text-xs text-zinc-500">No hay partners que coincidan con este filtro.</div>}</div>
        </section>
      </div>

      <section className="grid md:grid-cols-3 gap-4"><Info icon={MapPinned} title="Territorios claros" detail="Regional y comerciales quedan vinculados a una estructura real en la base." /><Info icon={BadgeDollarSign} title="Comisiones trazables" detail="Pendiente, disponible y pagada se separan por estado contable." /><Info icon={ShieldCheck} title="Control protegido" detail="Los cambios de nivel, suspensión y eliminación están reservados a la cuenta propietaria." /></section>

      {inviteOpen && isSuper && <InvitePartnerModal partners={partners} onClose={() => setInviteOpen(false)} onCreated={(message) => { setNotice(message); void reload(); }} onError={setError} />}
      {roleTarget && canManagePartners && <PartnerRoleModal target={roleTarget} partners={partners} busy={changingId===roleTarget.id} onClose={() => setRoleTarget(null)} onSave={(kind,parentId)=>void saveRoleChange(roleTarget,kind,parentId)} />}
    </div>
  );
};

const Info: React.FC<{ icon: any; title: string; detail: string }> = ({ icon: Icon,title,detail }) => <div className="p-4 rounded-2xl bg-[#0d0d0f] border border-zinc-800 flex items-start gap-3"><div className="p-2.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-300"><Icon className="w-4 h-4" /></div><div><p className="text-xs font-black text-white">{title}</p><p className="text-[10px] text-zinc-500 mt-1 leading-relaxed">{detail}</p></div></div>;

const PartnerRoleModal: React.FC<{ target:PartnerDirectoryItem; partners:PartnerDirectoryItem[]; busy:boolean; onClose:()=>void; onSave:(kind:'regional'|'sales',parentId:string|null)=>void }> = ({target,partners,busy,onClose,onSave}) => {
  const nextKind: 'regional'|'sales' = target.kind==='sales'?'regional':'sales';
  const children=partners.filter((partner)=>partner.parentPartnerId===target.id);
  const regionals=partners.filter((partner)=>partner.kind==='regional'&&partner.active&&partner.id!==target.id);
  const [parentId,setParentId]=useState('');
  const needsReplacement=nextKind==='sales'&&children.length>0;
  const canSave=!busy&&(!needsReplacement||Boolean(parentId));
  return <div className="fixed inset-0 z-[95] flex items-center justify-center bg-black/80 p-4 backdrop-blur-md"><section className="w-full max-w-lg rounded-3xl border border-zinc-700 bg-[#0d0d0f] p-6 shadow-2xl"><div className="flex items-start justify-between gap-3"><div><p className="text-[9px] font-black uppercase tracking-widest text-orange-300">Control exclusivo · Administrador Global</p><h2 className="mt-2 text-xl font-black text-white">{nextKind==='regional'?'Ascender a Partner regional':'Degradar a Partner comercial'}</h2><p className="mt-1 text-xs text-zinc-500">{target.name} · {target.email}</p></div><button type="button" onClick={onClose} disabled={busy} className="rounded-xl border border-zinc-800 bg-zinc-900 p-2 text-zinc-400 disabled:opacity-40"><X className="h-4 w-4"/></button></div>{nextKind==='regional'?<div className="mt-5 rounded-2xl border border-purple-500/20 bg-purple-500/5 p-4 text-xs leading-relaxed text-zinc-300">El perfil pasará a <strong className="text-purple-300">Partner regional</strong> y dejará de depender de su regional actual. Su porcentaje de comisión configurado no se modificará automáticamente.</div>:<div className="mt-5 space-y-3"><div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4 text-xs leading-relaxed text-zinc-300">El perfil pasará a <strong className="text-amber-300">Partner comercial</strong>. {children.length>0?`Actualmente tiene ${children.length} comercial(es) bajo su estructura; debes indicar a qué regional se reasignarán.`:'Puedes asignarle un Partner regional responsable ahora o dejarlo sin regional.'}</div><label className="block"><span className="mb-1.5 block text-[10px] font-black uppercase text-zinc-500">Nuevo Partner regional {needsReplacement?'· obligatorio':''}</span><select value={parentId} onChange={(e)=>setParentId(e.target.value)} className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-3 text-sm text-white"><option value="">{needsReplacement?'Selecciona un regional':'Sin regional asignado'}</option>{regionals.map((partner)=><option key={partner.id} value={partner.id}>{partner.name}</option>)}</select></label>{needsReplacement&&regionals.length===0&&<div className="rounded-xl border border-rose-500/25 bg-rose-500/10 p-3 text-[10px] font-bold text-rose-200">No existe otro Partner regional activo. Primero asciende a otro comercial a regional para poder reasignar esta estructura.</div>}</div>}<div className="mt-6 grid grid-cols-2 gap-3"><button type="button" onClick={onClose} disabled={busy} className="rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-xs font-black text-zinc-300 disabled:opacity-40">Cancelar</button><button type="button" onClick={()=>onSave(nextKind,nextKind==='sales'?(parentId||null):null)} disabled={!canSave} className={`flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-xs font-black text-white disabled:opacity-40 ${nextKind==='regional'?'bg-purple-600':'bg-amber-600'}`}>{busy?<Loader2 className="h-4 w-4 animate-spin"/>:nextKind==='regional'?<ArrowUpCircle className="h-4 w-4"/>:<ArrowDownCircle className="h-4 w-4"/>}{busy?'Guardando…':nextKind==='regional'?'Confirmar ascenso':'Confirmar cambio'}</button></div></section></div>;
};

const InvitePartnerModal: React.FC<{ partners: PartnerDirectoryItem[]; onClose: () => void; onCreated: (message: string) => void; onError: (message: string) => void }> = ({ partners,onClose,onCreated,onError }) => {
  const [saving,setSaving]=useState(false);
  const [activationUrl,setActivationUrl]=useState('');
  const [createdName,setCreatedName]=useState('');
  const [copied,setCopied]=useState(false);
  const [form,setForm]=useState({ name:'', email:'', kind:'sales' as 'regional'|'sales', code:'', commission:'25', parentPartnerId:'', countryCode:'CL', region:'', city:'' });
  const regionals=partners.filter((partner)=>partner.kind==='regional'&&partner.active);
  const changeKind=(kind:'regional'|'sales')=>setForm((prev)=>({...prev,kind,commission:kind==='regional'?'5':'25',parentPartnerId:''}));
  const submit=async(e:React.FormEvent)=>{ e.preventDefault(); setSaving(true); setCopied(false); onError(''); try { const result=await inviteNetworkPartner({ name:form.name,email:form.email,kind:form.kind,code:form.code,commissionPercent:Number(form.commission),parentPartnerId:form.kind==='sales'?(form.parentPartnerId||null):null,countryCode:form.countryCode,region:form.region,city:form.city,redirectTo:`${window.location.origin}/`,delivery:'whatsapp' }); if(!result.activationUrl) throw new Error('El partner fue creado, pero no se recibió el enlace de activación.'); setActivationUrl(result.activationUrl); setCreatedName(form.name); onCreated(result.message); } catch(err){ onError(err instanceof Error?err.message:'No fue posible crear el partner.'); } finally{ setSaving(false); } };
  const message=activationUrl?`Hola ${createdName}, te invitamos como Socio Comercial de Central GO. Abre este enlace privado para activar tu acceso y crear tu contraseña:\n\n${activationUrl}\n\nPor seguridad, no compartas este enlace con otras personas.`:'';
  const openWhatsApp=()=>{ if(!message)return; window.open(`https://wa.me/?text=${encodeURIComponent(message)}`,'_blank','noopener,noreferrer'); };
  const copyLink=async()=>{ if(!activationUrl)return; await navigator.clipboard.writeText(activationUrl); setCopied(true); window.setTimeout(()=>setCopied(false),2000); };

  if(activationUrl) return <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/80 p-4 backdrop-blur-md"><section className="w-full max-w-lg rounded-3xl border border-emerald-500/30 bg-[#0d0d0f] p-6 shadow-2xl"><div className="flex items-start justify-between gap-3"><div className="flex items-center gap-3"><div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/10 p-3 text-emerald-300"><Check className="h-6 w-6"/></div><div><p className="text-[9px] font-black uppercase tracking-widest text-emerald-300">Socio creado correctamente</p><h2 className="mt-1 text-xl font-black text-white">Comparte su acceso por WhatsApp</h2></div></div><button type="button" onClick={onClose} className="rounded-xl border border-zinc-800 bg-zinc-900 p-2 text-zinc-400"><X className="h-4 w-4" /></button></div><p className="mt-5 text-xs leading-relaxed text-zinc-400">Este enlace permite a <strong className="text-white">{createdName}</strong> entrar a Central GO y crear su propia contraseña. No necesita esperar ningún correo.</p><div className="mt-4 break-all rounded-xl border border-zinc-800 bg-zinc-950 p-3 text-[10px] leading-relaxed text-zinc-500">{activationUrl}</div><div className="mt-5 grid gap-3 sm:grid-cols-2"><button type="button" onClick={openWhatsApp} className="flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3.5 text-xs font-black text-white hover:bg-emerald-500"><MessageCircle className="h-4 w-4"/>Enviar por WhatsApp</button><button type="button" onClick={()=>void copyLink()} className="flex items-center justify-center gap-2 rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3.5 text-xs font-black text-zinc-200">{copied?<Check className="h-4 w-4 text-emerald-300"/>:<Copy className="h-4 w-4"/>}{copied?'Enlace copiado':'Copiar enlace'}</button></div><div className="mt-4 rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-[10px] leading-relaxed text-amber-200/80"><strong>Importante:</strong> es un enlace privado de autenticación. Compártelo únicamente con el socio indicado y evita publicarlo en grupos.</div></section></div>;

  return <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/80 p-4 backdrop-blur-md"><form onSubmit={submit} className="w-full max-w-xl max-h-[92vh] overflow-y-auto rounded-3xl border border-zinc-700 bg-[#0d0d0f] p-6 shadow-2xl"><div className="flex items-start justify-between gap-3"><div><p className="text-[9px] font-black uppercase tracking-widest text-emerald-300">Acceso directo · sin depender del correo</p><h2 className="mt-2 text-xl font-black text-white">Agregar socio por WhatsApp</h2><p className="mt-1 text-xs text-zinc-500">Central GO creará la cuenta y te entregará un enlace privado para compartir.</p></div><button type="button" onClick={onClose} className="rounded-xl border border-zinc-800 bg-zinc-900 p-2 text-zinc-400"><X className="h-4 w-4" /></button></div><div className="mt-5 grid gap-4 sm:grid-cols-2"><Field label="Nombre" value={form.name} onChange={(v)=>setForm((p)=>({...p,name:v}))} /><Field label="Correo de acceso" type="email" value={form.email} onChange={(v)=>setForm((p)=>({...p,email:v}))} /><label className="block"><span className="mb-1.5 block text-[10px] font-black uppercase text-zinc-500">Tipo</span><select value={form.kind} onChange={(e)=>changeKind(e.target.value as 'regional'|'sales')} className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-3 text-sm text-white"><option value="regional">Partner regional</option><option value="sales">Partner comercial</option></select></label><Field label="Código" value={form.code} onChange={(v)=>setForm((p)=>({...p,code:v.toUpperCase().replace(/[^A-Z0-9-]/g,'')}))} /><Field label="Comisión %" type="number" value={form.commission} onChange={(v)=>setForm((p)=>({...p,commission:v}))} />{form.kind==='sales'&&<label className="block"><span className="mb-1.5 block text-[10px] font-black uppercase text-zinc-500">Regional responsable</span><select value={form.parentPartnerId} onChange={(e)=>setForm((p)=>({...p,parentPartnerId:e.target.value}))} className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-3 text-sm text-white"><option value="">Sin regional</option>{regionals.map((p)=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label>}<Field label="País (código)" value={form.countryCode} onChange={(v)=>setForm((p)=>({...p,countryCode:v.toUpperCase().slice(0,2)}))} /><Field label="Región" value={form.region} onChange={(v)=>setForm((p)=>({...p,region:v}))} /><Field label="Ciudad" value={form.city} onChange={(v)=>setForm((p)=>({...p,city:v}))} /><div className="sm:col-span-2 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3 text-[10px] leading-relaxed text-emerald-200/80"><strong>No se enviará ningún email.</strong> El correo se usa como nombre de acceso. Al crear el socio recibirás aquí mismo un enlace privado para enviárselo por WhatsApp; al abrirlo, él definirá su contraseña.</div></div><button disabled={saving} className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-xs font-black text-white disabled:opacity-50">{saving?<Loader2 className="h-4 w-4 animate-spin"/>:<UserPlus className="h-4 w-4"/>}{saving?'Creando acceso seguro…':'Crear socio y generar link de WhatsApp'}</button></form></div>;
};

const Field: React.FC<{ label:string; value:string; onChange:(value:string)=>void; type?:string }> = ({label,value,onChange,type='text'}) => <label className="block"><span className="mb-1.5 block text-[10px] font-black uppercase text-zinc-500">{label}</span><input required type={type} value={value} onChange={(e)=>onChange(e.target.value)} className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-3 text-sm text-white outline-none focus:border-purple-500/50" /></label>;

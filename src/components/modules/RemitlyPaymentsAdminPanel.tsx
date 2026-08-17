import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, ExternalLink, FileSearch, Loader2, RefreshCw, Save, ShieldCheck, WalletCards, XCircle } from 'lucide-react';
import {
  createRemitlyProofUrl,
  loadRemitlyAdminRequests,
  loadRemitlyPaymentConfig,
  reviewRemitlyPayment,
  saveRemitlyPaymentConfig,
  type RemitlyAdminRequest,
  type RemitlyPaymentConfig,
} from '../../lib/remitlyPaymentRepository';

const money = (value: number) => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(value);
const date = (value: string | null) => value ? new Intl.DateTimeFormat('es-CL', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : '—';

const empty: RemitlyPaymentConfig = { enabled: false, displayName: 'Remitly', recipientName: '', payTag: '', destinationLabel: '', paymentUrl: null, websiteUrl: null, instructions: '' };

export const RemitlyPaymentsAdminPanel: React.FC = () => {
  const [config, setConfig] = useState<RemitlyPaymentConfig>(empty);
  const [requests, setRequests] = useState<RemitlyAdminRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const reload = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const [cfg, queue] = await Promise.all([loadRemitlyPaymentConfig(), loadRemitlyAdminRequests()]);
      setConfig(cfg); setRequests(queue);
    } catch (err) { setError(err instanceof Error ? err.message : 'No fue posible cargar Remitly.'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void reload(); }, [reload]);

  const pending = useMemo(() => requests.filter((r) => r.status === 'payment_sent'), [requests]);
  const recent = useMemo(() => requests.filter((r) => r.status !== 'payment_sent').slice(0, 8), [requests]);

  const save = async () => {
    setSaving(true); setError(''); setMessage('');
    try {
      const next = await saveRemitlyPaymentConfig({
        enabled: config.enabled,
        recipientName: config.recipientName,
        payTag: config.payTag,
        destinationLabel: config.destinationLabel,
        paymentUrl: config.paymentUrl || '',
        instructions: config.instructions,
      });
      setConfig(next); setMessage('Configuración de Remitly guardada.');
    } catch (err) { setError(err instanceof Error ? err.message : 'No pudimos guardar Remitly.'); }
    finally { setSaving(false); }
  };

  const openProof = async (request: RemitlyAdminRequest) => {
    if (!request.proofPath) return;
    setBusyId(request.id); setError('');
    try { window.open(await createRemitlyProofUrl(request.proofPath), '_blank', 'noopener,noreferrer'); }
    catch (err) { setError(err instanceof Error ? err.message : 'No pudimos abrir el comprobante.'); }
    finally { setBusyId(null); }
  };

  const review = async (request: RemitlyAdminRequest, approve: boolean) => {
    const wording = approve ? 'CONFIRMAR' : 'RECHAZAR';
    const note = window.prompt(`${approve ? 'Confirma únicamente si verificaste que el dinero fue recibido.' : 'Indica por qué se rechaza el pago.'}\n\nEscribe ${wording} para continuar${approve ? '' : ' y agrega el motivo después de dos puntos (opcional)'}.`);
    if (!note) return;
    const upper = note.toUpperCase();
    if (!upper.startsWith(wording)) return;
    const detail = note.includes(':') ? note.split(':').slice(1).join(':').trim() : '';
    setBusyId(request.id); setError(''); setMessage('');
    try {
      await reviewRemitlyPayment({ requestId: request.id, approve, notes: detail });
      setMessage(approve ? `${request.invoiceCode}: pago aprobado y plan activado.` : `${request.invoiceCode}: pago rechazado.`);
      await reload();
    } catch (err) { setError(err instanceof Error ? err.message : 'No pudimos revisar el pago.'); }
    finally { setBusyId(null); }
  };

  return (
    <section className="cg-panel-card p-5 md:p-7">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <span className="cg-eyebrow"><WalletCards className="h-3.5 w-3.5"/> Pago internacional manual</span>
          <h2 className="mt-3 text-2xl font-black tracking-tight text-[var(--cg-text)]">Remitly</h2>
          <p className="mt-2 max-w-2xl text-xs leading-6 text-[var(--cg-muted)]">El cliente paga fuera de Central GO, adjunta su comprobante y la suscripción se activa solo cuando el Administrador Global confirma que el dinero llegó.</p>
        </div>
        <div className={`cg-status-badge ${config.enabled ? 'is-online' : ''}`}><span/>{config.enabled ? 'Habilitado' : 'Deshabilitado'}</div>
      </div>

      {(message || error) && <div className={`mt-4 cg-inline-notice ${error ? 'is-error' : 'is-success'}`}>{error ? <XCircle className="h-4 w-4"/> : <CheckCircle2 className="h-4 w-4"/>}<span>{error || message}</span></div>}

      <div className="mt-5 grid gap-4 xl:grid-cols-[.9fr_1.1fr]">
        <div className="rounded-2xl border border-[var(--cg-border)] bg-[var(--cg-bg-soft)] p-4">
          <div className="flex items-center justify-between gap-3"><p className="text-xs font-black text-[var(--cg-text)]">Cuenta receptora</p><label className="flex items-center gap-2 text-[10px] font-bold text-[var(--cg-muted)]"><input type="checkbox" checked={config.enabled} onChange={(e)=>setConfig((p)=>({...p,enabled:e.target.checked}))}/> Activa</label></div>
          <div className="mt-4 grid gap-3">
            <Field label="Nombre del receptor" value={config.recipientName} onChange={(v)=>setConfig((p)=>({...p,recipientName:v}))}/>
            <Field label="Pay Tag" value={config.payTag} onChange={(v)=>setConfig((p)=>({...p,payTag:v}))}/>
            <Field label="Destino visible" value={config.destinationLabel} onChange={(v)=>setConfig((p)=>({...p,destinationLabel:v}))}/>
            <Field label="Enlace compartido de Remitly (opcional)" value={config.paymentUrl || ''} onChange={(v)=>setConfig((p)=>({...p,paymentUrl:v||null}))} placeholder="Pega aquí el enlace de tu Pay Tag o solicitud"/>
            <label><span className="text-[9px] font-black uppercase tracking-widest text-[var(--cg-muted)]">Instrucciones</span><textarea rows={3} value={config.instructions} onChange={(e)=>setConfig((p)=>({...p,instructions:e.target.value}))} className="mt-1.5 w-full resize-none rounded-xl border border-[var(--cg-border)] bg-[var(--cg-bg)] px-3 py-3 text-xs text-[var(--cg-text)] outline-none"/></label>
          </div>
          <button onClick={()=>void save()} disabled={saving} className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-xs font-black text-white disabled:opacity-50">{saving?<Loader2 className="h-4 w-4 animate-spin"/>:<Save className="h-4 w-4"/>}{saving?'Guardando…':'Guardar Remitly'}</button>
        </div>

        <div className="rounded-2xl border border-[var(--cg-border)] bg-[var(--cg-bg-soft)] p-4">
          <div className="flex items-center justify-between gap-3"><div><p className="text-xs font-black text-[var(--cg-text)]">Pagos esperando validación</p><p className="mt-1 text-[10px] text-[var(--cg-muted)]">{pending.length} comprobante(s) pendiente(s)</p></div><button onClick={()=>void reload()} disabled={loading} className="cg-quiet-button"><RefreshCw className={`h-4 w-4 ${loading?'animate-spin':''}`}/>Actualizar</button></div>
          <div className="mt-4 space-y-3">
            {pending.map((request)=><PaymentCard key={request.id} request={request} busy={busyId===request.id} onProof={()=>void openProof(request)} onApprove={()=>void review(request,true)} onReject={()=>void review(request,false)}/>) }
            {!loading && pending.length===0 && <div className="rounded-xl border border-dashed border-[var(--cg-border)] p-7 text-center text-[10px] text-[var(--cg-muted)]"><ShieldCheck className="mx-auto mb-2 h-6 w-6"/>No hay pagos Remitly pendientes de validación.</div>}
          </div>
        </div>
      </div>

      {recent.length>0 && <div className="mt-5"><p className="mb-3 text-[9px] font-black uppercase tracking-widest text-[var(--cg-muted)]">Actividad reciente</p><div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">{recent.map((r)=><div key={r.id} className="rounded-xl border border-[var(--cg-border)] bg-[var(--cg-bg-soft)] p-3"><div className="flex items-center justify-between gap-2"><p className="truncate text-[10px] font-black text-[var(--cg-text)]">{r.invoiceCode}</p><span className={`text-[9px] font-black ${r.status==='approved'?'text-emerald-400':r.status==='rejected'?'text-rose-400':'text-amber-400'}`}>{r.status==='approved'?'Aprobado':r.status==='rejected'?'Rechazado':'Pendiente'}</span></div><p className="mt-1 truncate text-[9px] text-[var(--cg-muted)]">{r.companyName} · {money(r.amountClp)}</p></div>)}</div></div>}
    </section>
  );
};

const Field = ({label,value,onChange,placeholder}: {label:string;value:string;onChange:(v:string)=>void;placeholder?:string}) => <label><span className="text-[9px] font-black uppercase tracking-widest text-[var(--cg-muted)]">{label}</span><input value={value} onChange={(e)=>onChange(e.target.value)} placeholder={placeholder} className="mt-1.5 w-full rounded-xl border border-[var(--cg-border)] bg-[var(--cg-bg)] px-3 py-3 text-xs text-[var(--cg-text)] outline-none"/></label>;

const PaymentCard = ({request,busy,onProof,onApprove,onReject}:{request:RemitlyAdminRequest;busy:boolean;onProof:()=>void;onApprove:()=>void;onReject:()=>void}) => <article className="rounded-2xl border border-amber-500/20 bg-amber-500/[0.045] p-4"><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><p className="text-sm font-black text-[var(--cg-text)]">{request.companyName}</p><p className="mt-1 text-[9px] text-[var(--cg-muted)]">{request.invoiceCode} · {request.userEmail}</p><p className="mt-2 text-lg font-black text-amber-300">{money(request.amountClp)}</p><p className="text-[9px] text-[var(--cg-muted)]">{request.planName} · {request.billingCycle==='annual'?'Anual':'Mensual'} · enviado {date(request.submittedAt)}</p>{request.senderReference&&<p className="mt-2 text-[10px] font-bold text-[var(--cg-text)]">Ref: {request.senderReference}</p>}</div><button disabled={busy||!request.proofPath} onClick={onProof} className="cg-quiet-button"><FileSearch className="h-4 w-4"/>Ver comprobante<ExternalLink className="h-3.5 w-3.5"/></button></div><div className="mt-4 grid grid-cols-2 gap-2"><button disabled={busy} onClick={onReject} className="flex items-center justify-center gap-2 rounded-xl border border-rose-500/25 bg-rose-500/10 px-3 py-2.5 text-[10px] font-black text-rose-300 disabled:opacity-50"><XCircle className="h-4 w-4"/>Rechazar</button><button disabled={busy} onClick={onApprove} className="flex items-center justify-center gap-2 rounded-xl bg-emerald-500 px-3 py-2.5 text-[10px] font-black text-zinc-950 disabled:opacity-50">{busy?<Loader2 className="h-4 w-4 animate-spin"/>:<CheckCircle2 className="h-4 w-4"/>}Confirmar recibido</button></div></article>;

import React, { useMemo, useState } from 'react';
import { CheckCircle2, ClipboardCopy, ExternalLink, FileUp, Loader2, ShieldCheck, X } from 'lucide-react';
import { submitRemitlyPaymentRequest, type RemitlyPaymentRequest } from '../../lib/remitlyPaymentRepository';

const money = (value: number) => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(value);

export const RemitlyPaymentPanel: React.FC<{
  request: RemitlyPaymentRequest;
  onClose: () => void;
  onSubmitted: () => void;
}> = ({ request, onClose, onSubmitted }) => {
  const [reference, setReference] = useState(request.senderReference || '');
  const [notes, setNotes] = useState('');
  const [proof, setProof] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(request.status === 'payment_sent');
  const config = request.config;
  const remitlyUrl = config.paymentUrl || config.websiteUrl || 'https://www.remitly.com/';
  const fileLabel = useMemo(() => proof?.name || 'Adjuntar comprobante (JPG, PNG, WEBP o PDF)', [proof]);

  const copyPayTag = async () => {
    if (!config.payTag) return;
    await navigator.clipboard.writeText(config.payTag);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  const submit = async () => {
    if (!proof) { setError('Adjunta el comprobante de Remitly para enviar el pago a revisión.'); return; }
    if (reference.trim().length < 3) { setError('Ingresa la referencia o identificador de la transferencia.'); return; }
    setSaving(true); setError('');
    try {
      await submitRemitlyPaymentRequest({ requestId: request.requestId, senderReference: reference.trim(), proof, customerNotes: notes.trim() });
      setSent(true);
      onSubmitted();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No pudimos enviar el comprobante.');
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-[230] overflow-y-auto bg-black/90 p-3 backdrop-blur-xl" role="dialog" aria-modal="true">
      <div className="mx-auto my-5 w-full max-w-2xl rounded-3xl border border-blue-500/25 bg-[#0b0b0e] shadow-2xl shadow-black/70">
        <header className="flex items-start justify-between gap-4 border-b border-zinc-800 p-5 md:p-6">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-blue-500/25 bg-blue-500/10 px-3 py-1 text-[9px] font-black uppercase tracking-[.16em] text-blue-300"><ShieldCheck className="h-3.5 w-3.5"/> Pago internacional</div>
            <h2 className="mt-3 text-2xl font-black text-white">Pagar con Remitly</h2>
            <p className="mt-1 text-xs leading-relaxed text-zinc-400">Central GO registrará tu factura y esperará la validación del Administrador Global antes de activar el plan.</p>
          </div>
          <button onClick={onClose} className="rounded-xl border border-zinc-800 bg-zinc-950 p-2 text-zinc-400 hover:text-white"><X className="h-5 w-5"/></button>
        </header>

        <div className="space-y-5 p-5 md:p-6">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-zinc-800 bg-zinc-950/70 p-4"><p className="text-[9px] font-black uppercase tracking-widest text-zinc-500">Factura</p><p className="mt-1 text-lg font-black text-white">{request.invoiceCode}</p><p className="mt-1 text-[10px] text-zinc-500">{request.planName || request.planCode} · {request.billingCycle === 'annual' ? 'Anual' : 'Mensual'}</p></div>
            <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.06] p-4"><p className="text-[9px] font-black uppercase tracking-widest text-emerald-400/70">Monto a pagar</p><p className="mt-1 text-2xl font-black text-emerald-300">{money(request.amountClp)}</p><p className="mt-1 text-[10px] text-zinc-500">Monto de la factura en CLP. Remitly mostrará la conversión aplicable al remitente.</p></div>
          </div>

          <section className="rounded-2xl border border-blue-500/20 bg-blue-500/[0.05] p-4">
            <p className="text-[9px] font-black uppercase tracking-widest text-blue-300">Datos del receptor</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div><p className="text-[9px] text-zinc-600">Nombre</p><p className="text-sm font-black text-white">{config.recipientName || 'Receptor Central GO'}</p></div>
              <div><p className="text-[9px] text-zinc-600">Destino</p><p className="text-sm font-black text-white">{config.destinationLabel || 'Cuenta configurada en Remitly'}</p></div>
            </div>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <button type="button" onClick={() => void copyPayTag()} className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-blue-500/25 bg-blue-500/10 px-4 py-3 text-xs font-black text-blue-200"><ClipboardCopy className="h-4 w-4"/>{copied ? 'Pay Tag copiado' : `Copiar ${config.payTag || 'Pay Tag'}`}</button>
              <a href={remitlyUrl} target="_blank" rel="noreferrer" className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-xs font-black text-white hover:bg-blue-500">Abrir Remitly <ExternalLink className="h-4 w-4"/></a>
            </div>
            <p className="mt-3 text-[10px] leading-relaxed text-zinc-500">{config.instructions || 'Completa el pago en Remitly y vuelve a Central GO para adjuntar el comprobante.'}</p>
          </section>

          {sent ? (
            <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/10 p-5 text-center">
              <CheckCircle2 className="mx-auto h-9 w-9 text-emerald-300"/>
              <h3 className="mt-3 text-lg font-black text-white">Pago enviado a revisión</h3>
              <p className="mt-2 text-xs leading-relaxed text-zinc-400">El Administrador Global revisará el comprobante y confirmará que el dinero haya sido recibido. El plan se activa únicamente después de esa aprobación.</p>
              <button onClick={onClose} className="mt-4 rounded-xl bg-emerald-500 px-5 py-3 text-xs font-black text-zinc-950">Entendido</button>
            </div>
          ) : (
            <section className="space-y-3 rounded-2xl border border-zinc-800 bg-zinc-950/50 p-4">
              <div><label className="text-[9px] font-black uppercase tracking-widest text-zinc-500">Referencia de Remitly</label><input value={reference} onChange={(e)=>setReference(e.target.value)} placeholder="Ej. número o identificador de la transferencia" className="mt-1.5 w-full rounded-xl border border-zinc-800 bg-black px-3 py-3 text-sm text-white outline-none focus:border-blue-500/50"/></div>
              <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-zinc-700 bg-black/40 p-4 text-xs font-bold text-zinc-400 hover:border-blue-500/40 hover:text-zinc-200"><FileUp className="h-5 w-5 text-blue-300"/><span className="min-w-0 truncate">{fileLabel}</span><input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" className="hidden" onChange={(e)=>setProof(e.target.files?.[0] || null)}/></label>
              <div><label className="text-[9px] font-black uppercase tracking-widest text-zinc-500">Nota opcional</label><textarea value={notes} onChange={(e)=>setNotes(e.target.value)} maxLength={500} rows={2} placeholder="Información adicional para revisar el pago" className="mt-1.5 w-full resize-none rounded-xl border border-zinc-800 bg-black px-3 py-3 text-sm text-white outline-none focus:border-blue-500/50"/></div>
              {error && <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-[10px] font-bold text-rose-200">{error}</div>}
              <button type="button" disabled={saving} onClick={() => void submit()} className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-3.5 text-xs font-black text-zinc-950 disabled:opacity-50">{saving ? <Loader2 className="h-4 w-4 animate-spin"/> : <CheckCircle2 className="h-4 w-4"/>}{saving ? 'Enviando comprobante…' : 'Ya pagué · enviar comprobante'}</button>
            </section>
          )}

          <p className="text-center text-[9px] leading-relaxed text-zinc-600">Remitly es un proveedor externo. Central GO no considera un pago aprobado hasta que el Administrador Global confirme la recepción real del dinero.</p>
        </div>
      </div>
    </div>
  );
};

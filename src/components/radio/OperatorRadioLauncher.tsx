import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Edit3, Loader2, RadioTower, Save, Send, Users, X } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { playVHFRadioChirp, speakVHFDispatch } from '../../lib/audioService';
import { sendDriverRadioBroadcast, sendDriverRadioMessage } from '../../lib/driverOperations';

const DEFAULT_PRESET = 'Atención móviles: mantenerse atentos a la central y reportar cualquier novedad.';
const presetStorageKey = (companyId: string) => `centralgo:operator-radio-preset:v1:${companyId}`;

export const OperatorRadioLauncher: React.FC = () => {
  const { currentRole, currentCompany, drivers, addAuditLog, soundMuted } = useApp();
  const [open, setOpen] = useState(false);
  const [recipient, setRecipient] = useState('all');
  const [message, setMessage] = useState('');
  const [preset, setPreset] = useState(DEFAULT_PRESET);
  const [presetDraft, setPresetDraft] = useState(DEFAULT_PRESET);
  const [editingPreset, setEditingPreset] = useState(false);
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');

  const allowed = ['operator', 'company_admin', 'super_admin'].includes(currentRole) && currentCompany.id !== 'network';
  const eligibleDrivers = useMemo(() => drivers
    .filter((driver) => Boolean(driver.userId) && driver.status !== 'offline')
    .sort((a, b) => a.unitNumber.localeCompare(b.unitNumber, 'es', { numeric: true })), [drivers]);

  useEffect(() => {
    if (!allowed) return;
    try {
      const saved = window.localStorage.getItem(presetStorageKey(currentCompany.id));
      const next = saved?.trim() || DEFAULT_PRESET;
      setPreset(next);
      setPresetDraft(next);
    } catch {
      setPreset(DEFAULT_PRESET);
      setPresetDraft(DEFAULT_PRESET);
    }
  }, [allowed, currentCompany.id]);

  useEffect(() => {
    const close = () => setOpen(false);
    const handleHardwareBack = (event: Event) => {
      if (!open) return;
      const detail = (event as CustomEvent<{ handled?: boolean }>).detail;
      setOpen(false);
      if (detail) detail.handled = true;
    };
    window.addEventListener('centralgo:escape', close);
    window.addEventListener('centralgo:hardware-back', handleHardwareBack);
    return () => {
      window.removeEventListener('centralgo:escape', close);
      window.removeEventListener('centralgo:hardware-back', handleHardwareBack);
    };
  }, [open]);

  if (!allowed) return null;

  const savePreset = () => {
    const clean = presetDraft.trim();
    if (!clean) return;
    setPreset(clean);
    setPresetDraft(clean);
    setEditingPreset(false);
    try { window.localStorage.setItem(presetStorageKey(currentCompany.id), clean); } catch { /* local preference only */ }
  };

  const transmit = async () => {
    const clean = message.trim();
    if (!clean || sending) return;
    setSending(true);
    setError('');
    setStatus('');
    try {
      let delivered = 1;
      let destination = '';
      if (recipient === 'all') {
        delivered = await sendDriverRadioBroadcast(currentCompany.id, eligibleDrivers, clean);
        destination = `todos los móviles con app (${delivered})`;
      } else {
        const driver = eligibleDrivers.find((item) => item.id === recipient);
        if (!driver) throw new Error('El móvil seleccionado ya no está disponible para radio digital.');
        await sendDriverRadioMessage(currentCompany.id, driver, clean);
        destination = `Móvil ${driver.unitNumber}`;
      }
      playVHFRadioChirp();
      if (!soundMuted) void speakVHFDispatch(clean);
      addAuditLog('TRANSMISION_VHF', `Radio digital enviada a ${destination}: "${clean}"`);
      setStatus(recipient === 'all' ? `Mensaje enviado a ${delivered} móvil${delivered === 1 ? '' : 'es'}.` : 'Mensaje enviado.');
      setMessage('');
      window.setTimeout(() => setStatus(''), 3200);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No fue posible enviar el mensaje de radio.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="absolute right-3 top-3 z-[1200] flex max-w-[calc(100%-1.5rem)] flex-col items-end">
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex h-10 items-center gap-2 rounded-xl border border-cyan-200/35 bg-[#07131d]/95 px-3 text-[10px] font-black text-cyan-100 shadow-xl shadow-black/50 backdrop-blur-xl transition hover:bg-cyan-400/15 active:scale-[.98]"
          aria-expanded={false}
          title="Abrir mensajes de radio"
        >
          <RadioTower className="h-4 w-4 text-cyan-300" />
          Radio
        </button>
      ) : (
        <section className="w-[min(390px,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-cyan-400/30 bg-[#07131d]/97 shadow-2xl shadow-black/75 backdrop-blur-xl">
          <header className="flex items-center justify-between border-b border-white/10 px-3 py-2.5">
            <div className="flex items-center gap-2">
              <span className="grid h-8 w-8 place-items-center rounded-xl bg-cyan-400/10 text-cyan-200"><RadioTower className="h-4 w-4" /></span>
              <div>
                <p className="text-[9px] font-black uppercase tracking-[.16em] text-cyan-300">Central → móviles</p>
                <p className="text-xs font-black text-white">Mensajes de radio</p>
              </div>
            </div>
            <button type="button" onClick={() => setOpen(false)} className="grid h-8 w-8 place-items-center rounded-lg text-zinc-500 hover:bg-white/10 hover:text-white" aria-label="Cerrar radio"><X className="h-4 w-4" /></button>
          </header>

          <div className="space-y-3 p-3">
            <label className="block space-y-1.5">
              <span className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-[.14em] text-zinc-400"><Users className="h-3.5 w-3.5" />Destinatario</span>
              <select value={recipient} onChange={(event) => setRecipient(event.target.value)} className="h-9 w-full rounded-xl border border-white/10 bg-black/25 px-2.5 text-[10px] font-bold text-white outline-none focus:border-cyan-300/40">
                <option value="all">Todos los móviles con app ({eligibleDrivers.length})</option>
                {eligibleDrivers.map((driver) => <option key={driver.id} value={driver.id}>Móvil {driver.unitNumber} · {driver.name}</option>)}
              </select>
            </label>

            <div className="rounded-xl border border-amber-300/15 bg-amber-300/[.05] p-2.5">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[9px] font-black uppercase tracking-[.13em] text-amber-200">Mensaje predeterminado</p>
                  {!editingPreset && <p className="mt-1 line-clamp-2 text-[10px] leading-relaxed text-zinc-300">{preset}</p>}
                </div>
                <button type="button" onClick={() => setEditingPreset((value) => !value)} className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-white/10 bg-black/20 text-zinc-400 hover:text-white" title="Configurar mensaje predeterminado"><Edit3 className="h-3.5 w-3.5" /></button>
              </div>
              {editingPreset && (
                <div className="mt-2 space-y-2">
                  <textarea value={presetDraft} onChange={(event) => setPresetDraft(event.target.value)} rows={3} className="w-full resize-none rounded-lg border border-white/10 bg-black/25 px-2.5 py-2 text-[10px] text-white outline-none focus:border-amber-300/35" />
                  <button type="button" onClick={savePreset} disabled={!presetDraft.trim()} className="flex h-8 items-center gap-1.5 rounded-lg bg-amber-300 px-2.5 text-[9px] font-black text-zinc-950 disabled:opacity-40"><Save className="h-3.5 w-3.5" />Guardar predeterminado</button>
                </div>
              )}
              {!editingPreset && <button type="button" onClick={() => setMessage(preset)} className="mt-2 h-8 rounded-lg border border-amber-300/25 bg-amber-300/10 px-2.5 text-[9px] font-black text-amber-100 hover:bg-amber-300/15">Usar predeterminado</button>}
            </div>

            <label className="block space-y-1.5">
              <span className="text-[9px] font-black uppercase tracking-[.14em] text-zinc-400">Mensaje</span>
              <textarea
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                rows={3}
                placeholder="Escribe un mensaje para un móvil o para toda la flota…"
                className="w-full resize-none rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-[11px] leading-relaxed text-white outline-none placeholder:text-zinc-600 focus:border-cyan-300/40"
              />
            </label>

            {error && <div className="rounded-xl border border-rose-400/20 bg-rose-400/10 px-3 py-2 text-[10px] font-semibold text-rose-100">{error}</div>}
            {status && <div className="flex items-center gap-2 rounded-xl border border-emerald-400/20 bg-emerald-400/10 px-3 py-2 text-[10px] font-bold text-emerald-100"><CheckCircle2 className="h-4 w-4" />{status}</div>}

            <button
              type="button"
              onClick={() => void transmit()}
              disabled={sending || !message.trim() || (recipient === 'all' && eligibleDrivers.length === 0)}
              className="flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-cyan-300 text-[10px] font-black text-slate-950 transition hover:bg-cyan-200 disabled:opacity-40"
            >
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              {sending ? 'Enviando…' : recipient === 'all' ? 'Enviar a todos' : 'Enviar mensaje'}
            </button>
          </div>
        </section>
      )}
    </div>
  );
};

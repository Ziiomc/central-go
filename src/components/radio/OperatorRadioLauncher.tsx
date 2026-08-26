import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { CheckCircle2, Loader2, Mic, RadioTower, Send, Users, X } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { playVHFRadioChirp, speakVHFDispatch } from '../../lib/audioService';
import { sendDriverRadioBroadcast, sendDriverRadioMessage } from '../../lib/driverOperations';
import { createPrivateRadioChannel, sendRadioVoiceFrame } from '../../lib/realtimeRadio';
import { requireSupabase } from '../../lib/supabase';

const VOICE_SEGMENT_MS = 720;
const VOICE_MIME_TYPES = [
  'audio/webm;codecs=opus',
  'audio/mp4;codecs=mp4a.40.2',
  'audio/mp4',
  'audio/webm',
];

const supportedVoiceMime = () => {
  if (typeof MediaRecorder === 'undefined') return '';
  return VOICE_MIME_TYPES.find((type) => MediaRecorder.isTypeSupported(type)) ?? '';
};

const recordVoiceSegment = (stream: MediaStream, mimeType: string): Promise<Blob> => new Promise((resolve, reject) => {
  try {
    const options: MediaRecorderOptions = mimeType ? { mimeType, audioBitsPerSecond: 24000 } : { audioBitsPerSecond: 24000 };
    const recorder = new MediaRecorder(stream, options);
    const parts: BlobPart[] = [];
    recorder.ondataavailable = (event) => { if (event.data.size) parts.push(event.data); };
    recorder.onerror = () => reject(new Error('El micrófono interrumpió la transmisión.'));
    recorder.onstop = () => resolve(new Blob(parts, { type: recorder.mimeType || mimeType || 'audio/webm' }));
    recorder.start();
    window.setTimeout(() => { if (recorder.state !== 'inactive') recorder.stop(); }, VOICE_SEGMENT_MS);
  } catch (error) {
    reject(error);
  }
});

export const OperatorRadioLauncher: React.FC = () => {
  const { currentRole, currentCompany, drivers, addAuditLog, soundMuted } = useApp();
  const [open, setOpen] = useState(false);
  const [recipient, setRecipient] = useState('all');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [voiceConnected, setVoiceConnected] = useState(false);
  const [voiceTransmitting, setVoiceTransmitting] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);
  const radioChannelRef = useRef<RealtimeChannel | null>(null);
  const microphoneRef = useRef<MediaStream | null>(null);
  const pttHeldRef = useRef(false);
  const sequenceRef = useRef(0);

  const allowed = ['operator', 'company_admin', 'super_admin'].includes(currentRole) && currentCompany.id !== 'network';
  const eligibleDrivers = useMemo(() => drivers
    .filter((driver) => Boolean(driver.userId) && driver.status !== 'offline')
    .sort((a, b) => a.unitNumber.localeCompare(b.unitNumber, 'es', { numeric: true })), [drivers]);

  useEffect(() => {
    if (!allowed) {
      setPortalTarget(null);
      return;
    }
    const locate = () => setPortalTarget(document.querySelector('.cg-map-panel .cg-live-map') as HTMLElement | null);
    locate();
    const observer = new MutationObserver(locate);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [allowed]);

  useEffect(() => {
    if (!allowed || !currentCompany.id || currentCompany.id === 'network') return;
    setVoiceConnected(false);
    const channel = createPrivateRadioChannel(currentCompany.id);
    radioChannelRef.current = channel;
    channel.subscribe((channelStatus) => {
      setVoiceConnected(channelStatus === 'SUBSCRIBED');
      if (channelStatus === 'CHANNEL_ERROR') setError('La radio de voz no pudo abrir el canal seguro.');
    });
    return () => {
      pttHeldRef.current = false;
      microphoneRef.current?.getTracks().forEach((track) => track.stop());
      microphoneRef.current = null;
      if (radioChannelRef.current === channel) radioChannelRef.current = null;
      void requireSupabase().removeChannel(channel);
    };
  }, [allowed, currentCompany.id]);

  useEffect(() => {
    const close = () => { pttHeldRef.current = false; setOpen(false); };
    const handleHardwareBack = (event: Event) => {
      if (!open) return;
      const detail = (event as CustomEvent<{ handled?: boolean }>).detail;
      pttHeldRef.current = false;
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

  useEffect(() => {
    if (!voiceTransmitting) return;
    const release = () => { pttHeldRef.current = false; };
    window.addEventListener('pointerup', release, true);
    window.addEventListener('pointercancel', release, true);
    window.addEventListener('blur', release);
    return () => {
      window.removeEventListener('pointerup', release, true);
      window.removeEventListener('pointercancel', release, true);
      window.removeEventListener('blur', release);
    };
  }, [voiceTransmitting]);

  if (!allowed || !portalTarget) return null;

  const transmitText = async () => {
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

  const stopPtt = () => { pttHeldRef.current = false; };

  const startPtt = async (event: React.PointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    if (voiceTransmitting || !voiceConnected) return;
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setError('Este navegador no permite usar el micrófono como radio en tiempo real.');
      return;
    }
    const selectedDriver = recipient === 'all' ? null : eligibleDrivers.find((item) => item.id === recipient);
    if (recipient !== 'all' && !selectedDriver) {
      setError('El móvil seleccionado ya no está conectado.');
      return;
    }
    const channel = radioChannelRef.current;
    if (!channel) {
      setError('La radio todavía está reconectando.');
      return;
    }

    setError('');
    setStatus('');
    pttHeldRef.current = true;
    setVoiceTransmitting(true);
    const streamId = crypto.randomUUID();
    sequenceRef.current = 0;
    const targetDriverId = selectedDriver?.id ?? null;
    const destination = selectedDriver ? `Móvil ${selectedDriver.unitNumber}` : 'todos los móviles conectados';

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 },
      });
      microphoneRef.current = stream;
      if (!pttHeldRef.current) return;
      const preferredMime = supportedVoiceMime();
      while (pttHeldRef.current) {
        const segment = await recordVoiceSegment(stream, preferredMime);
        if (!segment.size) continue;
        await sendRadioVoiceFrame(channel, {
          streamId,
          sequence: sequenceRef.current++,
          sentAt: Date.now(),
          mimeType: segment.type || preferredMime || 'audio/webm',
          targetDriverId,
        }, await segment.arrayBuffer());
      }
      addAuditLog('RADIO_VOZ_PTT', `Transmitió audio en vivo a ${destination}.`);
      setStatus(`Transmisión finalizada · ${destination}.`);
      window.setTimeout(() => setStatus(''), 2600);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No fue posible transmitir audio en vivo.');
    } finally {
      pttHeldRef.current = false;
      microphoneRef.current?.getTracks().forEach((track) => track.stop());
      microphoneRef.current = null;
      setVoiceTransmitting(false);
    }
  };

  return createPortal(
    <div className="absolute bottom-3 right-3 z-[1200] flex max-w-[calc(100%-1.5rem)] flex-col items-end gap-2">
      {open && <section className="w-[min(400px,calc(100vw-2rem))] max-h-[355px] overflow-y-auto rounded-2xl border border-cyan-400/30 bg-[#07131d]/97 shadow-2xl shadow-black/75 backdrop-blur-xl">
        <header className="sticky top-0 z-10 flex items-center justify-between border-b border-white/10 bg-[#07131d]/98 px-3 py-2.5">
          <div className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-xl bg-cyan-400/10 text-cyan-200"><RadioTower className="h-4 w-4" /></span>
            <div><p className="text-[9px] font-black uppercase tracking-[.16em] text-cyan-300">Central → móviles</p><p className="text-xs font-black text-white">Radio en tiempo real</p></div>
          </div>
          <button type="button" onClick={() => { stopPtt(); setOpen(false); }} className="grid h-8 w-8 place-items-center rounded-lg text-zinc-500 hover:bg-white/10 hover:text-white" aria-label="Cerrar radio"><X className="h-4 w-4" /></button>
        </header>

        <div className="space-y-3 p-3">
          <label className="block space-y-1.5">
            <span className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-[.14em] text-zinc-400"><Users className="h-3.5 w-3.5" />Destinatario</span>
            <select value={recipient} disabled={voiceTransmitting} onChange={(event) => setRecipient(event.target.value)} className="h-9 w-full rounded-xl border border-white/10 bg-black/25 px-2.5 text-[10px] font-bold text-white outline-none focus:border-cyan-300/40 disabled:opacity-50">
              <option value="all">Todos los móviles con app ({eligibleDrivers.length})</option>
              {eligibleDrivers.map((driver) => <option key={driver.id} value={driver.id}>Móvil {driver.unitNumber} · {driver.name}</option>)}
            </select>
          </label>

          <div className="rounded-2xl border border-rose-400/20 bg-rose-400/[.06] p-3 text-center">
            <p className="text-[9px] font-black uppercase tracking-[.15em] text-rose-200">Push to talk · voz directa</p>
            <button
              type="button"
              onPointerDown={(event) => void startPtt(event)}
              onPointerUp={stopPtt}
              onPointerCancel={stopPtt}
              onContextMenu={(event) => event.preventDefault()}
              disabled={!voiceConnected && !voiceTransmitting}
              className={`mx-auto mt-2 flex h-20 w-20 touch-none select-none items-center justify-center rounded-full border-4 shadow-xl transition disabled:opacity-40 ${voiceTransmitting ? 'scale-110 border-rose-200 bg-rose-500 text-white shadow-rose-900/40' : 'border-rose-400/40 bg-rose-500/15 text-rose-200 active:scale-110 active:bg-rose-500 active:text-white'}`}
              aria-label="Mantén presionado para hablar"
            >
              <Mic className={`h-8 w-8 ${voiceTransmitting ? 'animate-pulse' : ''}`} />
            </button>
            <p className="mt-2 text-[10px] font-black text-white">{voiceTransmitting ? 'HABLANDO · suelta para cortar' : voiceConnected ? 'Mantén presionado para hablar' : 'Conectando radio segura…'}</p>
            <p className="mt-1 text-[9px] text-zinc-500">El audio llega a los choferes como una radio, sin convertirlo en texto.</p>
          </div>

          <label className="block space-y-1.5"><span className="text-[9px] font-black uppercase tracking-[.14em] text-zinc-400">Mensaje escrito opcional</span><textarea value={message} onChange={(event) => setMessage(event.target.value)} rows={2} placeholder="También puedes enviar un mensaje escrito…" className="w-full resize-none rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-[11px] leading-relaxed text-white outline-none placeholder:text-zinc-600 focus:border-cyan-300/40" /></label>

          {error && <div className="rounded-xl border border-rose-400/20 bg-rose-400/10 px-3 py-2 text-[10px] font-semibold text-rose-100">{error}</div>}
          {status && <div className="flex items-center gap-2 rounded-xl border border-emerald-400/20 bg-emerald-400/10 px-3 py-2 text-[10px] font-bold text-emerald-100"><CheckCircle2 className="h-4 w-4" />{status}</div>}

          <button type="button" onClick={() => void transmitText()} disabled={sending || !message.trim() || (recipient === 'all' && eligibleDrivers.length === 0)} className="flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-cyan-300/25 bg-cyan-300/10 text-[10px] font-black text-cyan-100 transition hover:bg-cyan-300/15 disabled:opacity-40">
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}{sending ? 'Enviando…' : recipient === 'all' ? 'Enviar escrito a todos' : 'Enviar mensaje escrito'}
          </button>
        </div>
      </section>}

      <button type="button" onClick={() => setOpen((value) => !value)} className={`flex h-11 items-center gap-2 rounded-xl border px-3 text-[10px] font-black shadow-xl shadow-black/50 backdrop-blur-xl transition active:scale-[.98] ${open ? 'border-cyan-300/50 bg-cyan-300 text-slate-950' : 'border-cyan-200/35 bg-[#07131d]/95 text-cyan-100 hover:bg-cyan-400/15'}`} aria-expanded={open} title="Abrir radio de la central"><RadioTower className="h-4 w-4" />Radio</button>
    </div>,
    portalTarget,
  );
};

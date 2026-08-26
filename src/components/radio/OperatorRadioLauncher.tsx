import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { useApp } from '../../context/AppContext';
import { rememberAddressHistory, searchAddressHistory, seedAddressHistoryFromTrips } from '../../lib/addressHistoryCache';
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

const isAddressInput = (target: EventTarget | null): target is HTMLInputElement => {
  if (!(target instanceof HTMLInputElement)) return false;
  return target.placeholder === 'Dirección de retiro'
    || target.placeholder === 'Opcional · si queda vacío se usa taxímetro';
};

const setReactInputValue = (input: HTMLInputElement, value: string) => {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
  setter?.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
};

export const OperatorRadioLauncher: React.FC = () => {
  const { currentRole, currentCompany, trips, addAuditLog } = useApp();
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);
  const [voiceTransmitting, setVoiceTransmitting] = useState(false);
  const radioChannelRef = useRef<RealtimeChannel | null>(null);
  const microphoneRef = useRef<MediaStream | null>(null);
  const pttHeldRef = useRef(false);
  const sequenceRef = useRef(0);

  const allowed = ['operator', 'company_admin', 'super_admin'].includes(currentRole) && currentCompany.id !== 'network';

  useEffect(() => {
    if (!allowed) {
      setPortalTarget(null);
      return;
    }
    const locate = () => setPortalTarget(document.querySelector('.cg-map-panel > div:first-child') as HTMLElement | null);
    locate();
    const observer = new MutationObserver(locate);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [allowed]);

  useEffect(() => {
    if (!allowed || !currentCompany.id || currentCompany.id === 'network') return;
    const channel = createPrivateRadioChannel(currentCompany.id);
    radioChannelRef.current = channel;
    channel.subscribe();
    return () => {
      pttHeldRef.current = false;
      microphoneRef.current?.getTracks().forEach((track) => track.stop());
      microphoneRef.current = null;
      if (radioChannelRef.current === channel) radioChannelRef.current = null;
      void requireSupabase().removeChannel(channel);
    };
  }, [allowed, currentCompany.id]);

  useEffect(() => {
    if (!allowed || !currentCompany.id || currentCompany.id === 'network') return;
    seedAddressHistoryFromTrips(currentCompany.id, trips);
  }, [allowed, currentCompany.id, trips]);

  useEffect(() => {
    if (!allowed) return;
    const styleId = 'centralgo-operator-layer-fix';
    let style = document.getElementById(styleId) as HTMLStyleElement | null;
    if (!style) {
      style = document.createElement('style');
      style.id = styleId;
      style.textContent = '.cg-operator-grid>aside:first-child>div:first-child{position:relative;z-index:1600!important}.cg-operator-grid>aside:first-child>div:nth-child(2){position:relative;z-index:1}';
      document.head.appendChild(style);
    }
    return () => style?.remove();
  }, [allowed]);

  useEffect(() => {
    if (!allowed || !currentCompany.id || currentCompany.id === 'network') return;
    const companyId = currentCompany.id;

    const removePanels = (except?: HTMLElement | null) => {
      document.querySelectorAll<HTMLElement>('[data-cg-address-cache-suggestions="1"]').forEach((panel) => {
        if (panel !== except) panel.remove();
      });
    };

    const renderSuggestions = (input: HTMLInputElement) => {
      const parent = input.parentElement;
      if (!parent) return;
      const existing = parent.querySelector<HTMLElement>('[data-cg-address-cache-suggestions="1"]');
      const matches = searchAddressHistory(companyId, input.value, 6)
        .filter((item) => item.address.trim().toLocaleLowerCase('es-CL') !== input.value.trim().toLocaleLowerCase('es-CL'));

      if (!matches.length) {
        existing?.remove();
        return;
      }

      const panel = existing ?? document.createElement('div');
      panel.dataset.cgAddressCacheSuggestions = '1';
      panel.setAttribute('role', 'listbox');
      Object.assign(panel.style, {
        marginTop: '6px',
        overflow: 'hidden',
        border: '1px solid rgba(59,130,246,.22)',
        borderRadius: '12px',
        background: '#09090b',
        boxShadow: '0 16px 38px rgba(0,0,0,.32)',
      });
      panel.replaceChildren();

      matches.forEach((item) => {
        const option = document.createElement('div');
        option.setAttribute('role', 'option');
        option.tabIndex = -1;
        Object.assign(option.style, {
          cursor: 'pointer',
          padding: '9px 11px',
          borderBottom: '1px solid rgba(63,63,70,.55)',
          color: '#e4e4e7',
          fontSize: '11px',
          fontWeight: '700',
          lineHeight: '1.3',
        });
        option.textContent = item.address;
        option.title = `${item.uses} uso${item.uses === 1 ? '' : 's'} anterior${item.uses === 1 ? '' : 'es'}`;
        option.addEventListener('mouseenter', () => { option.style.background = 'rgba(59,130,246,.10)'; });
        option.addEventListener('mouseleave', () => { option.style.background = 'transparent'; });
        option.addEventListener('pointerdown', (event) => {
          event.preventDefault();
          setReactInputValue(input, item.address);
          rememberAddressHistory(companyId, [item.address]);
          panel.remove();
          input.focus();
        });
        panel.appendChild(option);
      });

      if (!existing) parent.appendChild(panel);
      removePanels(panel);
    };

    const onInput = (event: Event) => { if (isAddressInput(event.target)) renderSuggestions(event.target); };
    const onFocus = (event: FocusEvent) => { if (isAddressInput(event.target)) renderSuggestions(event.target); };
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest('[data-cg-address-cache-suggestions="1"]')) return;
      if (target instanceof HTMLInputElement && isAddressInput(target)) return;
      removePanels();
    };
    const onSubmit = (event: SubmitEvent) => {
      const form = event.target as HTMLFormElement | null;
      if (!form) return;
      const origin = form.querySelector<HTMLInputElement>('input[placeholder="Dirección de retiro"]');
      const destination = form.querySelector<HTMLInputElement>('input[placeholder="Opcional · si queda vacío se usa taxímetro"]');
      rememberAddressHistory(companyId, [origin?.value ?? '', destination?.value ?? '']);
    };

    document.addEventListener('input', onInput);
    document.addEventListener('focusin', onFocus);
    document.addEventListener('pointerdown', onPointerDown, true);
    document.addEventListener('submit', onSubmit, true);
    return () => {
      document.removeEventListener('input', onInput);
      document.removeEventListener('focusin', onFocus);
      document.removeEventListener('pointerdown', onPointerDown, true);
      document.removeEventListener('submit', onSubmit, true);
      removePanels();
    };
  }, [allowed, currentCompany.id]);

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

  const stopPtt = () => { pttHeldRef.current = false; };

  const startPtt = async (event: React.PointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    if (voiceTransmitting || !navigator.mediaDevices?.getUserMedia) return;
    pttHeldRef.current = true;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 },
      });
      microphoneRef.current = stream;

      if (!pttHeldRef.current || typeof MediaRecorder === 'undefined') return;
      const channel = radioChannelRef.current;
      if (!channel) return;

      setVoiceTransmitting(true);
      const streamId = crypto.randomUUID();
      sequenceRef.current = 0;
      const preferredMime = supportedVoiceMime();

      while (pttHeldRef.current) {
        const segment = await recordVoiceSegment(stream, preferredMime);
        if (!segment.size) continue;
        await sendRadioVoiceFrame(channel, {
          streamId,
          sequence: sequenceRef.current++,
          sentAt: Date.now(),
          mimeType: segment.type || preferredMime || 'audio/webm',
          targetDriverId: null,
        }, await segment.arrayBuffer());
      }

      addAuditLog('RADIO_VOZ_PTT', 'Transmitió audio PTT a los móviles conectados.');
    } catch (error) {
      console.warn('[Central GO] PTT no disponible:', error);
    } finally {
      pttHeldRef.current = false;
      microphoneRef.current?.getTracks().forEach((track) => track.stop());
      microphoneRef.current = null;
      setVoiceTransmitting(false);
    }
  };

  if (!allowed || !portalTarget) return null;

  return createPortal(
    <button
      type="button"
      onPointerDown={(event) => void startPtt(event)}
      onPointerUp={stopPtt}
      onPointerCancel={stopPtt}
      onContextMenu={(event) => event.preventDefault()}
      className={`h-9 min-w-12 touch-none select-none rounded-xl border px-3 text-[10px] font-black tracking-[.08em] text-white shadow-lg transition active:scale-95 ${voiceTransmitting ? 'border-red-200 bg-red-500 shadow-red-950/50' : 'border-red-400/45 bg-red-600 hover:bg-red-500'}`}
      title="Mantén presionado para hablar. La primera vez el navegador pedirá permiso de micrófono."
      aria-label="PTT: mantén presionado para hablar"
    >
      PTT
    </button>,
    portalTarget,
  );
};

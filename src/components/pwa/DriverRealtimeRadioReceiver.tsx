import React, { useEffect, useRef, useState } from 'react';
import { Radio, Volume2 } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { playVHFRadioChirp } from '../../lib/audioService';
import {
  createPrivateRadioChannel,
  decodeRadioVoiceFrame,
  RADIO_VOICE_EVENT,
  type DecodedRadioVoiceFrame,
} from '../../lib/realtimeRadio';
import { requireSupabase } from '../../lib/supabase';

type QueuedFrame = DecodedRadioVoiceFrame;

export const DriverRealtimeRadioReceiver: React.FC = () => {
  const { currentCompany, currentUser, drivers, soundMuted } = useApp();
  const ownDriver = drivers.find((driver) => driver.userId === currentUser.id);
  const queueRef = useRef<QueuedFrame[]>([]);
  const playingRef = useRef(false);
  const playerRef = useRef<HTMLAudioElement | null>(null);
  const lastStreamRef = useRef<string | null>(null);
  const [live, setLive] = useState(false);
  const [needsTap, setNeedsTap] = useState(false);
  const [connected, setConnected] = useState(false);

  const playNext = async () => {
    if (playingRef.current || soundMuted) return;
    const frame = queueRef.current.shift();
    if (!frame) {
      setLive(false);
      return;
    }
    const blob = new Blob([frame.audio], { type: frame.meta.mimeType });
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    playerRef.current = audio;
    playingRef.current = true;
    const finish = () => {
      URL.revokeObjectURL(url);
      if (playerRef.current === audio) playerRef.current = null;
      playingRef.current = false;
      if (queueRef.current.length) void playNext();
      else window.setTimeout(() => setLive(false), 550);
    };
    audio.onended = finish;
    audio.onerror = finish;
    try {
      await audio.play();
      setNeedsTap(false);
    } catch {
      playingRef.current = false;
      playerRef.current = null;
      URL.revokeObjectURL(url);
      queueRef.current.unshift(frame);
      setNeedsTap(true);
    }
  };

  useEffect(() => {
    if (!ownDriver || !currentCompany.id || currentCompany.id === 'network') return;
    queueRef.current = [];
    playerRef.current?.pause();
    playerRef.current = null;
    playingRef.current = false;
    setLive(false);
    setNeedsTap(false);

    const channel = createPrivateRadioChannel(currentCompany.id)
      .on('broadcast', { event: RADIO_VOICE_EVENT }, ({ payload }) => {
        const frame = decodeRadioVoiceFrame(payload);
        if (!frame) return;
        if (frame.meta.targetDriverId && frame.meta.targetDriverId !== ownDriver.id) return;
        if (Date.now() - frame.meta.sentAt > 15000) return;
        if (soundMuted) return;
        if (lastStreamRef.current !== frame.meta.streamId) {
          lastStreamRef.current = frame.meta.streamId;
          setLive(true);
          playVHFRadioChirp();
          if ('vibrate' in navigator) navigator.vibrate([80, 45, 120]);
        }
        queueRef.current.push(frame);
        if (queueRef.current.length > 14) queueRef.current.splice(0, queueRef.current.length - 14);
        void playNext();
      })
      .subscribe((status) => setConnected(status === 'SUBSCRIBED'));

    return () => {
      setConnected(false);
      queueRef.current = [];
      playingRef.current = false;
      playerRef.current?.pause();
      playerRef.current = null;
      void requireSupabase().removeChannel(channel);
    };
  }, [currentCompany.id, ownDriver?.id, soundMuted]);

  if (!ownDriver || (!live && !needsTap)) return null;

  return (
    <div className="pointer-events-none fixed inset-x-3 bottom-[5.3rem] z-[145] flex justify-center">
      <button
        type="button"
        onClick={() => { setNeedsTap(false); void playNext(); }}
        className={`pointer-events-auto flex min-h-12 max-w-sm items-center gap-3 rounded-2xl border px-4 py-2.5 shadow-2xl backdrop-blur-xl ${needsTap ? 'border-amber-300/40 bg-amber-950/95 text-amber-100' : 'border-cyan-300/35 bg-[#06151e]/95 text-cyan-50'}`}
      >
        <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${live ? 'bg-rose-500/15 text-rose-300' : 'bg-cyan-400/10 text-cyan-200'}`}>
          {needsTap ? <Volume2 className="h-4 w-4" /> : <Radio className="h-4 w-4 animate-pulse" />}
        </span>
        <span className="min-w-0 text-left">
          <span className="block text-[9px] font-black uppercase tracking-[.16em]">{needsTap ? 'Audio pendiente' : 'Radio en vivo · Central'}</span>
          <span className="mt-0.5 block text-[10px] font-semibold opacity-75">{needsTap ? 'Toca para escuchar la transmisión.' : connected ? 'Recibiendo voz de la operadora…' : 'Reconectando radio…'}</span>
        </span>
      </button>
    </div>
  );
};

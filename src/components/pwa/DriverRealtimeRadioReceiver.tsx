import React, { useEffect, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import { playVHFRadioChirp, primeRadioAudio } from '../../lib/audioService';
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
  const blockedRef = useRef(false);
  const playerRef = useRef<HTMLAudioElement | null>(null);
  const lastStreamRef = useRef<string | null>(null);

  const playNext = async () => {
    if (playingRef.current || blockedRef.current || soundMuted) return;
    const frame = queueRef.current.shift();
    if (!frame) return;

    const blob = new Blob([frame.audio], { type: frame.meta.mimeType });
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    audio.preload = 'auto';
    audio.volume = 1;
    playerRef.current = audio;
    playingRef.current = true;

    const finish = () => {
      URL.revokeObjectURL(url);
      if (playerRef.current === audio) playerRef.current = null;
      playingRef.current = false;
      if (queueRef.current.length) void playNext();
    };

    audio.onended = finish;
    audio.onerror = finish;

    try {
      await audio.play();
      blockedRef.current = false;
    } catch {
      playingRef.current = false;
      if (playerRef.current === audio) playerRef.current = null;
      URL.revokeObjectURL(url);
      queueRef.current.unshift(frame);
      blockedRef.current = true;
    }
  };

  useEffect(() => {
    if (!ownDriver || !currentCompany.id || currentCompany.id === 'network') return;

    queueRef.current = [];
    blockedRef.current = false;
    playerRef.current?.pause();
    playerRef.current = null;
    playingRef.current = false;

    const resumeQueuedAudio = () => {
      if (soundMuted || !queueRef.current.length) return;
      blockedRef.current = false;
      void primeRadioAudio();
      void playNext();
    };

    window.addEventListener('pointerdown', resumeQueuedAudio, { passive: true });
    window.addEventListener('touchstart', resumeQueuedAudio, { passive: true });
    window.addEventListener('keydown', resumeQueuedAudio);
    window.addEventListener('pageshow', resumeQueuedAudio);
    document.addEventListener('visibilitychange', resumeQueuedAudio);

    const channel = createPrivateRadioChannel(currentCompany.id)
      .on('broadcast', { event: RADIO_VOICE_EVENT }, ({ payload }) => {
        const frame = decodeRadioVoiceFrame(payload);
        if (!frame) return;
        if (frame.meta.targetDriverId && frame.meta.targetDriverId !== ownDriver.id) return;
        if (Date.now() - frame.meta.sentAt > 15000) return;
        if (soundMuted) return;

        if (lastStreamRef.current !== frame.meta.streamId) {
          lastStreamRef.current = frame.meta.streamId;
          void primeRadioAudio();
          playVHFRadioChirp();
          if ('vibrate' in navigator) navigator.vibrate([80, 45, 120]);
        }

        queueRef.current.push(frame);
        if (queueRef.current.length > 14) {
          queueRef.current.splice(0, queueRef.current.length - 14);
        }

        if (!blockedRef.current) void playNext();
      })
      .subscribe();

    return () => {
      queueRef.current = [];
      blockedRef.current = false;
      playingRef.current = false;
      playerRef.current?.pause();
      playerRef.current = null;
      window.removeEventListener('pointerdown', resumeQueuedAudio);
      window.removeEventListener('touchstart', resumeQueuedAudio);
      window.removeEventListener('keydown', resumeQueuedAudio);
      window.removeEventListener('pageshow', resumeQueuedAudio);
      document.removeEventListener('visibilitychange', resumeQueuedAudio);
      void requireSupabase().removeChannel(channel);
    };
  }, [currentCompany.id, ownDriver?.id, soundMuted]);

  return null;
};

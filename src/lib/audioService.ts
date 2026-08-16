// Web Audio API & Speech Synthesis for Central GO radio dispatch
import { installDriverTripButtonBehavior } from './driverUiBehavior';
import {
  DRIVER_RADIO_AUDIO_CHANGE_EVENT,
  installDriverRadioAudioPreferenceControl,
  isDriverRadioAudioEnabled,
} from './driverRadioPreferences';

let audioCtx: AudioContext | null = null;
let sosLoopTimer: number | null = null;
let speechBusy = false;
let unlockHandlersInstalled = false;

type SpeechJob = { text: string; resolve: () => void };
const speechQueue: SpeechJob[] = [];
let activeSpeechJob: SpeechJob | null = null;

function getAudioContext(): AudioContext {
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    audioCtx = new AudioContextClass();
  }
  if (audioCtx.state === 'suspended') void audioCtx.resume();
  return audioCtx;
}

const driverRadioAudioDisabled = () =>
  typeof window !== 'undefined' &&
  window.location.pathname.startsWith('/driver') &&
  !isDriverRadioAudioEnabled();

const stopQueuedRadioSpeech = () => {
  try {
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
  } catch {}
  activeSpeechJob?.resolve();
  activeSpeechJob = null;
  speechBusy = false;
  while (speechQueue.length) speechQueue.shift()?.resolve();
};

/** Call from a user gesture to unlock audio on restrictive browsers. */
export async function primeRadioAudio(): Promise<boolean> {
  try {
    const ctx = getAudioContext();
    if (ctx.state === 'suspended') await ctx.resume();
    if ('speechSynthesis' in window) {
      window.speechSynthesis.getVoices();
      if (window.speechSynthesis.paused) window.speechSynthesis.resume();
      // Prime speech only when the queue is idle. This avoids a silent unlock
      // utterance getting in front of a real operator message.
      if (!speechBusy && !window.speechSynthesis.speaking && !window.speechSynthesis.pending) {
        const silent = new SpeechSynthesisUtterance('\u00a0');
        silent.volume = 0;
        silent.rate = 2;
        window.speechSynthesis.speak(silent);
      }
    }
    return ctx.state === 'running';
  } catch (error) {
    console.warn('Central GO audio unlock failed:', error);
    return false;
  }
}

function installAudioUnlockHandlers() {
  if (unlockHandlersInstalled || typeof window === 'undefined' || typeof document === 'undefined') return;
  unlockHandlersInstalled = true;
  const unlock = () => {
    void primeRadioAudio();
    try { if ('speechSynthesis' in window && window.speechSynthesis.paused) window.speechSynthesis.resume(); } catch {}
  };
  window.addEventListener('pointerdown', unlock, { passive: true });
  window.addEventListener('touchstart', unlock, { passive: true });
  window.addEventListener('keydown', unlock);
  window.addEventListener('pageshow', unlock);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') unlock();
  });
}

/** Realistic VHF radio mic click / roger beep. */
export function playVHFRadioChirp() {
  try {
    const ctx = getAudioContext();
    const bufferSize = Math.floor(ctx.sampleRate * 0.10);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const output = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) output[i] = Math.random() * 2 - 1;

    const whiteNoise = ctx.createBufferSource();
    whiteNoise.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 1800;
    filter.Q.value = 3;
    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.24, ctx.currentTime);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.10);
    whiteNoise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(ctx.destination);
    whiteNoise.start();

    const osc = ctx.createOscillator();
    const oscGain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1280, ctx.currentTime + 0.04);
    osc.frequency.setValueAtTime(860, ctx.currentTime + 0.10);
    oscGain.gain.setValueAtTime(0, ctx.currentTime);
    oscGain.gain.setValueAtTime(0.30, ctx.currentTime + 0.035);
    oscGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18);
    osc.connect(oscGain);
    oscGain.connect(ctx.destination);
    osc.start(ctx.currentTime + 0.035);
    osc.stop(ctx.currentTime + 0.18);
  } catch (err) {
    console.warn('Audio play error:', err);
  }
}

/** A short, professional two-tone emergency pattern. */
export function playSOSSiren() {
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;
    const master = ctx.createGain();
    master.gain.setValueAtTime(0.0001, now);
    master.gain.exponentialRampToValueAtTime(0.32, now + 0.03);
    master.gain.setValueAtTime(0.32, now + 0.92);
    master.gain.exponentialRampToValueAtTime(0.001, now + 1.16);
    master.connect(ctx.destination);

    [0, 0.42].forEach((offset) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(760, now + offset);
      osc.frequency.linearRampToValueAtTime(1120, now + offset + 0.18);
      osc.frequency.linearRampToValueAtTime(760, now + offset + 0.34);
      gain.gain.setValueAtTime(0.001, now + offset);
      gain.gain.exponentialRampToValueAtTime(0.7, now + offset + 0.02);
      gain.gain.setValueAtTime(0.7, now + offset + 0.30);
      gain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.37);
      osc.connect(gain);
      gain.connect(master);
      osc.start(now + offset);
      osc.stop(now + offset + 0.38);
    });
  } catch (err) {
    console.warn('SOS alarm play error:', err);
  }
}

export function startSOSAlarm() {
  if (sosLoopTimer !== null) return;
  playSOSSiren();
  sosLoopTimer = window.setInterval(playSOSSiren, 1900);
}

export function stopSOSAlarm() {
  if (sosLoopTimer !== null) {
    window.clearInterval(sosLoopTimer);
    sosLoopTimer = null;
  }
}

function chooseSpanishVoice() {
  const voices = window.speechSynthesis.getVoices();
  const feminineNames = /Paulina|Catalina|Monica|Mónica|Laura|Elvira|Dalia|Helena|Sabina|Paloma|Luciana|Soledad|Google.*español/i;
  return [...voices].sort((a,b)=>{
    const score=(voice:SpeechSynthesisVoice)=>(/es-CL/i.test(voice.lang)?80:/^es/i.test(voice.lang)?45:0)+(feminineNames.test(voice.name)?35:0)+(voice.localService?5:0);
    return score(b)-score(a);
  }).find((voice)=>/^es/i.test(voice.lang));
}

function processSpeechQueue() {
  if (speechBusy || !speechQueue.length || !('speechSynthesis' in window)) return;
  if (driverRadioAudioDisabled()) {
    while (speechQueue.length) speechQueue.shift()?.resolve();
    return;
  }

  const job = speechQueue.shift()!;
  activeSpeechJob = job;
  speechBusy = true;
  void primeRadioAudio();
  playVHFRadioChirp();

  window.setTimeout(() => {
    if (driverRadioAudioDisabled()) {
      activeSpeechJob = null;
      speechBusy = false;
      job.resolve();
      processSpeechQueue();
      return;
    }
    try {
      const utterance = new SpeechSynthesisUtterance(job.text);
      utterance.lang = 'es-CL';
      utterance.rate = 0.96;
      utterance.pitch = 1.06;
      utterance.volume = 1;
      const voice = chooseSpanishVoice();
      if (voice) utterance.voice = voice;

      let finished = false;
      const finish = () => {
        if (finished) return;
        finished = true;
        if (activeSpeechJob === job) activeSpeechJob = null;
        speechBusy = false;
        job.resolve();
        window.setTimeout(processSpeechQueue, 130);
      };
      utterance.onend = finish;
      utterance.onerror = (event) => {
        console.warn('Central GO speech synthesis warning:', event.error);
        finish();
      };

      if (window.speechSynthesis.paused) window.speechSynthesis.resume();
      window.speechSynthesis.speak(utterance);
    } catch (err) {
      console.warn('Speech synthesis error:', err);
      activeSpeechJob = null;
      speechBusy = false;
      job.resolve();
      processSpeechQueue();
    }
  }, 210);
}

/**
 * Speaks a dispatch at maximum browser voice volume using a FIFO queue.
 * Calls can arrive simultaneously; each Promise resolves after its message finishes.
 */
export function speakVHFDispatch(text: string, muted: boolean = false): Promise<void> {
  if (muted || driverRadioAudioDisabled() || !text.trim() || !('speechSynthesis' in window)) return Promise.resolve();
  return new Promise<void>((resolve) => {
    speechQueue.push({ text: text.trim(), resolve });
    processSpeechQueue();
  });
}

export function getVHFQueueLength() {
  return speechQueue.length + (speechBusy ? 1 : 0);
}

if (typeof window !== 'undefined') {
  installAudioUnlockHandlers();
  installDriverTripButtonBehavior();
  installDriverRadioAudioPreferenceControl();
  window.addEventListener(DRIVER_RADIO_AUDIO_CHANGE_EVENT, ((event: Event) => {
    const enabled = Boolean((event as CustomEvent<{ enabled?: boolean }>).detail?.enabled);
    if (!enabled) stopQueuedRadioSpeech();
    else void primeRadioAudio();
  }) as EventListener);
}

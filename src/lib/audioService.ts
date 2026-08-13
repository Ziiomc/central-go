// Web Audio API & Speech Synthesis for Central GO radio dispatch

let audioCtx: AudioContext | null = null;
let sosLoopTimer: number | null = null;
let speechBusy = false;

type SpeechJob = { text: string; resolve: () => void };
const speechQueue: SpeechJob[] = [];

function getAudioContext(): AudioContext {
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    audioCtx = new AudioContextClass();
  }
  if (audioCtx.state === 'suspended') void audioCtx.resume();
  return audioCtx;
}

/** Call from a user gesture to unlock audio on restrictive browsers. */
export async function primeRadioAudio(): Promise<boolean> {
  try {
    const ctx = getAudioContext();
    if (ctx.state === 'suspended') await ctx.resume();
    if ('speechSynthesis' in window) {
      window.speechSynthesis.getVoices();
      const silent = new SpeechSynthesisUtterance('');
      silent.volume = 0;
      window.speechSynthesis.speak(silent);
    }
    return ctx.state === 'running';
  } catch (error) {
    console.warn('Central GO audio unlock failed:', error);
    return false;
  }
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
  const job = speechQueue.shift()!;
  speechBusy = true;
  playVHFRadioChirp();

  window.setTimeout(() => {
    try {
      const utterance = new SpeechSynthesisUtterance(job.text);
      utterance.lang = 'es-CL';
      utterance.rate = 0.96;
      utterance.pitch = 1.06;
      utterance.volume = 1;
      const voice = chooseSpanishVoice();
      if (voice) utterance.voice = voice;

      const finish = () => {
        speechBusy = false;
        job.resolve();
        window.setTimeout(processSpeechQueue, 130);
      };
      utterance.onend = finish;
      utterance.onerror = finish;

      if (window.speechSynthesis.paused) window.speechSynthesis.resume();
      // Do not cancel existing speech: Central GO keeps a strict FIFO queue so
      // simultaneous taxi messages are reproduced one after another.
      window.speechSynthesis.speak(utterance);
    } catch (err) {
      console.warn('Speech synthesis error:', err);
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
  if (muted || !text.trim() || !('speechSynthesis' in window)) return Promise.resolve();
  return new Promise<void>((resolve) => {
    speechQueue.push({ text: text.trim(), resolve });
    processSpeechQueue();
  });
}

export function getVHFQueueLength() {
  return speechQueue.length + (speechBusy ? 1 : 0);
}

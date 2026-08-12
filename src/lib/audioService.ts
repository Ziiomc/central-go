// Web Audio API & Speech Synthesis for Central GO radio dispatch

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext {
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    audioCtx = new AudioContextClass();
  }
  if (audioCtx.state === 'suspended') {
    void audioCtx.resume();
  }
  return audioCtx;
}

/** Call from a user gesture to unlock audio on restrictive mobile browsers. */
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

/** Simulates a realistic VHF radio mic click / roger beep. */
export function playVHFRadioChirp() {
  try {
    const ctx = getAudioContext();
    const bufferSize = ctx.sampleRate * 0.10;
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

export function playSOSSiren() {
  try {
    const ctx = getAudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(800, ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(1400, ctx.currentTime + 0.25);
    osc.frequency.linearRampToValueAtTime(800, ctx.currentTime + 0.5);
    gain.gain.setValueAtTime(0.28, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.5);
  } catch (err) {
    console.warn('SOS Siren play error:', err);
  }
}

/** Speaks a dispatch at maximum browser voice volume. Device media volume still applies. */
export function speakVHFDispatch(text: string, muted: boolean = false) {
  if (muted || !('speechSynthesis' in window)) return;
  try {
    playVHFRadioChirp();
    setTimeout(() => {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'es-CL';
      utterance.rate = 1.0;
      utterance.pitch = 0.96;
      utterance.volume = 1;
      const voices = window.speechSynthesis.getVoices();
      const esVoice = voices.find((v) => /es-CL/i.test(v.lang)) ?? voices.find((v) => /^es/i.test(v.lang));
      if (esVoice) utterance.voice = esVoice;
      window.speechSynthesis.speak(utterance);
    }, 220);
  } catch (err) {
    console.warn('Speech synthesis error:', err);
  }
}

// Web Audio API & Speech Synthesis for Chilean Radio Taxi Dispatch Console

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext {
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    audioCtx = new AudioContextClass();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

/**
 * Simulates a realistic VHF Radio Mic Click / Roger Beep sound
 */
export function playVHFRadioChirp() {
  try {
    const ctx = getAudioContext();

    // 1. White Noise burst (Static burst)
    const bufferSize = ctx.sampleRate * 0.08; // 80ms
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const output = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }

    const whiteNoise = ctx.createBufferSource();
    whiteNoise.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 1800; // Radio bandpass
    filter.Q.value = 3;

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.12, ctx.currentTime);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);

    whiteNoise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(ctx.destination);
    whiteNoise.start();

    // 2. Dual Beep (MDC-1200 / Quik-Call II style VHF chirp)
    const osc = ctx.createOscillator();
    const oscGain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(1200, ctx.currentTime + 0.04);
    osc.frequency.setValueAtTime(800, ctx.currentTime + 0.08);

    oscGain.gain.setValueAtTime(0, ctx.currentTime);
    oscGain.gain.setValueAtTime(0.15, ctx.currentTime + 0.04);
    oscGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.14);

    osc.connect(oscGain);
    oscGain.connect(ctx.destination);
    osc.start(ctx.currentTime + 0.04);
    osc.stop(ctx.currentTime + 0.14);
  } catch (err) {
    console.warn('Audio play error:', err);
  }
}

/**
 * Simulates SOS Emergency Siren
 */
export function playSOSSiren() {
  try {
    const ctx = getAudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(800, ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(1400, ctx.currentTime + 0.25);
    osc.frequency.linearRampToValueAtTime(800, ctx.currentTime + 0.5);

    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.5);
  } catch (err) {
    console.warn('SOS Siren play error:', err);
  }
}

/**
 * Speaks a VHF Dispatch message in Spanish (Chilean voice accent if available)
 */
export function speakVHFDispatch(text: string, muted: boolean = false) {
  if (muted || !('speechSynthesis' in window)) return;

  try {
    // First play radio chirp
    playVHFRadioChirp();

    setTimeout(() => {
      window.speechSynthesis.cancel(); // cancel previous
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'es-CL'; // Spanish Chile
      utterance.rate = 1.05; // Radio operator speed
      utterance.pitch = 1.0;

      // Select Spanish voice if available
      const voices = window.speechSynthesis.getVoices();
      const esVoice = voices.find((v) => v.lang.includes('es') || v.lang.includes('CL'));
      if (esVoice) utterance.voice = esVoice;

      window.speechSynthesis.speak(utterance);
    }, 180);
  } catch (err) {
    console.warn('Speech synthesis error:', err);
  }
}

// Web Audio API Sound Synthesizer for Central GO

const readMutedPreference = () => {
  if (typeof window === 'undefined') return false;
  try { return window.localStorage.getItem('centralgo:sound-muted') === '1'; }
  catch { return false; }
};

class SoundManager {
  private ctx: AudioContext | null = null;
  private muted: boolean = readMutedPreference();

  private initCtx() {
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
  }

  public toggleMute(): boolean {
    this.muted = !this.muted;
    try { window.localStorage.setItem('centralgo:sound-muted', this.muted ? '1' : '0'); }
    catch { /* The sound still toggles when private storage is unavailable. */ }
    return this.muted;
  }

  public isMuted(): boolean {
    return this.muted;
  }

  /** Unlocks the notification context from a user gesture on mobile browsers. */
  public async prime(): Promise<boolean> {
    this.initCtx();
    if (!this.ctx) return false;
    try {
      if (this.ctx.state === 'suspended') await this.ctx.resume();
      const oscillator = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      gain.gain.value = 0;
      oscillator.connect(gain);
      gain.connect(this.ctx.destination);
      oscillator.start();
      oscillator.stop(this.ctx.currentTime + 0.01);
      return this.ctx.state === 'running';
    } catch {
      return false;
    }
  }

  /**
   * Firma sonora de nueva carrera.
   * Dos campanadas cortas, cálidas y modernas, con armónicos suaves para que
   * se distingan dentro del vehículo sin sonar agresivas ni parecer una alarma.
   */
  public playDispatchChime() {
    if (this.muted) return;
    this.initCtx();
    if (!this.ctx) return;

    const ctx = this.ctx;
    const now = ctx.currentTime;
    const master = ctx.createGain();
    const compressor = ctx.createDynamicsCompressor();
    const highShelf = ctx.createBiquadFilter();

    compressor.threshold.setValueAtTime(-18, now);
    compressor.knee.setValueAtTime(16, now);
    compressor.ratio.setValueAtTime(3.2, now);
    compressor.attack.setValueAtTime(0.004, now);
    compressor.release.setValueAtTime(0.24, now);

    highShelf.type = 'highshelf';
    highShelf.frequency.setValueAtTime(2600, now);
    highShelf.gain.setValueAtTime(-2.5, now);

    master.gain.setValueAtTime(0.0001, now);
    master.gain.exponentialRampToValueAtTime(0.9, now + 0.025);
    master.gain.setValueAtTime(0.9, now + 1.45);
    master.gain.exponentialRampToValueAtTime(0.0001, now + 2.0);
    master.connect(highShelf);
    highShelf.connect(compressor);
    compressor.connect(ctx.destination);

    const playTone = (
      frequency: number,
      offset: number,
      duration: number,
      peak: number,
      type: OscillatorType = 'sine',
      detune = 0,
    ) => {
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      const start = now + offset;
      oscillator.type = type;
      oscillator.frequency.setValueAtTime(frequency, start);
      oscillator.detune.setValueAtTime(detune, start);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(peak, start + 0.018);
      gain.gain.exponentialRampToValueAtTime(Math.max(0.018, peak * 0.34), start + Math.min(0.2, duration * 0.34));
      gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
      oscillator.connect(gain);
      gain.connect(master);
      oscillator.start(start);
      oscillator.stop(start + duration + 0.02);
    };

    const bell = (frequency: number, offset: number, peak: number) => {
      playTone(frequency, offset, 0.72, peak, 'sine');
      playTone(frequency * 2, offset + 0.006, 0.48, peak * 0.22, 'sine', 2);
      playTone(frequency * 3, offset + 0.012, 0.30, peak * 0.075, 'sine', -3);
    };

    // Primera llamada: ascenso limpio y reconocible.
    bell(587.33, 0.00, 0.28); // D5
    bell(739.99, 0.13, 0.24); // F#5
    bell(880.00, 0.28, 0.22); // A5

    // Segunda llamada: confirma la solicitud sin convertirse en una sirena.
    bell(739.99, 0.78, 0.25);
    bell(880.00, 0.93, 0.23);
    bell(1174.66, 1.09, 0.20); // D6

    // Pulso corto de apoyo para parlantes pequeños y cabinas ruidosas.
    [0.0, 0.78].forEach((offset) => {
      playTone(420, offset, 0.12, 0.11, 'triangle');
    });
  }

  // Driver arrived notification ding
  public playArrivalDing() {
    if (this.muted) return;
    this.initCtx();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(523.25, now); // C5
    osc.frequency.setValueAtTime(659.25, now + 0.12); // E5
    osc.frequency.setValueAtTime(783.99, now + 0.24); // G5

    gain.gain.setValueAtTime(0.4, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.6);
  }

  // Emergency SOS Siren Alert sound for Central Operator
  public playSOSAlarm() {
    if (this.muted) return;
    this.initCtx();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;

    // Alternating two-tone emergency siren
    for (let i = 0; i < 3; i++) {
      const startTime = now + i * 0.4;

      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(960, startTime);
      osc.frequency.setValueAtTime(700, startTime + 0.2);

      gain.gain.setValueAtTime(0.4, startTime);
      gain.gain.exponentialRampToValueAtTime(0.05, startTime + 0.38);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(startTime);
      osc.stop(startTime + 0.38);
    }
  }

  // Radio Mic Click / Roger Beep sound (simulates VHF radio end of transmission)
  public playRadioRogerBeep() {
    if (this.muted) return;
    this.initCtx();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(2475, now); // Quindar pitch 2475Hz
    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.18);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.18);
  }
}

export const soundManager = new SoundManager();

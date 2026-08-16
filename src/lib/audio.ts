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
   * Nueva carrera: pulso tipo radar/sonar, suave y armónico.
   * Tiene un eco corto y limpio para que la solicitud se sienta "entrando"
   * sin parecer una alarma ni cansar al conductor cuando se repite.
   */
  public playDispatchChime() {
    if (this.muted) return;
    this.initCtx();
    if (!this.ctx) return;

    const ctx = this.ctx;
    const now = ctx.currentTime;
    const dry = ctx.createGain();
    const wet = ctx.createGain();
    const delay = ctx.createDelay(0.8);
    const feedback = ctx.createGain();
    const echoFilter = ctx.createBiquadFilter();
    const compressor = ctx.createDynamicsCompressor();
    const master = ctx.createGain();

    dry.gain.setValueAtTime(0.78, now);
    wet.gain.setValueAtTime(0.34, now);
    delay.delayTime.setValueAtTime(0.19, now);
    feedback.gain.setValueAtTime(0.24, now);
    echoFilter.type = 'lowpass';
    echoFilter.frequency.setValueAtTime(2800, now);
    echoFilter.Q.setValueAtTime(0.7, now);

    compressor.threshold.setValueAtTime(-20, now);
    compressor.knee.setValueAtTime(18, now);
    compressor.ratio.setValueAtTime(2.8, now);
    compressor.attack.setValueAtTime(0.006, now);
    compressor.release.setValueAtTime(0.26, now);

    master.gain.setValueAtTime(0.0001, now);
    master.gain.exponentialRampToValueAtTime(0.62, now + 0.018);
    master.gain.setValueAtTime(0.62, now + 0.5);
    master.gain.exponentialRampToValueAtTime(0.0001, now + 1.25);

    dry.connect(master);
    wet.connect(master);
    delay.connect(echoFilter);
    echoFilter.connect(wet);
    echoFilter.connect(feedback);
    feedback.connect(delay);
    master.connect(compressor);
    compressor.connect(ctx.destination);

    const ping = (
      frequency: number,
      offset: number,
      duration: number,
      peak: number,
      harmonic = 1,
      detune = 0,
    ) => {
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      const start = now + offset;
      oscillator.type = harmonic === 1 ? 'sine' : 'triangle';
      oscillator.frequency.setValueAtTime(frequency * harmonic, start);
      oscillator.frequency.exponentialRampToValueAtTime(frequency * harmonic * 1.035, start + 0.12);
      oscillator.detune.setValueAtTime(detune, start);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(peak, start + 0.012);
      gain.gain.exponentialRampToValueAtTime(Math.max(0.008, peak * 0.22), start + 0.16);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
      oscillator.connect(gain);
      gain.connect(dry);
      gain.connect(delay);
      oscillator.start(start);
      oscillator.stop(start + duration + 0.03);
    };

    // Cuerpo grave muy suave: hace que el radar se perciba también en parlantes pequeños.
    ping(392.00, 0.00, 0.42, 0.075, 1); // G4

    // Pulso principal y armónicos: sensación de radar moderno con espacio/eco.
    ping(783.99, 0.015, 0.58, 0.22, 1); // G5
    ping(783.99, 0.022, 0.42, 0.055, 2, 3);
    ping(987.77, 0.16, 0.52, 0.14, 1); // B5
    ping(1174.66, 0.29, 0.44, 0.095, 1); // D6
  }

  /** Confirmación corta al iniciar el viaje: ascendente, limpia y positiva. */
  public playTripStartConfirmation() {
    if (this.muted) return;
    this.initCtx();
    if (!this.ctx) return;

    const ctx = this.ctx;
    const now = ctx.currentTime;
    const master = ctx.createGain();
    const compressor = ctx.createDynamicsCompressor();
    master.gain.setValueAtTime(0.0001, now);
    master.gain.exponentialRampToValueAtTime(0.72, now + 0.015);
    master.gain.setValueAtTime(0.72, now + 0.34);
    master.gain.exponentialRampToValueAtTime(0.0001, now + 0.72);
    compressor.threshold.setValueAtTime(-18, now);
    compressor.knee.setValueAtTime(14, now);
    compressor.ratio.setValueAtTime(2.5, now);
    master.connect(compressor);
    compressor.connect(ctx.destination);

    const tone = (frequency: number, offset: number, duration: number, peak: number) => {
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      const start = now + offset;
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(frequency, start);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(peak, start + 0.018);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
      oscillator.connect(gain);
      gain.connect(master);
      oscillator.start(start);
      oscillator.stop(start + duration + 0.02);
    };

    tone(523.25, 0.00, 0.32, 0.17); // C5
    tone(659.25, 0.09, 0.36, 0.19); // E5
    tone(783.99, 0.19, 0.44, 0.21); // G5
    tone(1567.98, 0.205, 0.30, 0.035); // brillo armónico
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

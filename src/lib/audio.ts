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
      this.ctx.resume();
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

  // Firma sonora de nueva carrera: cálida, reconocible y clara aun con ruido de cabina.
  public playDispatchChime() {
    if (this.muted) return;
    this.initCtx();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const master = this.ctx.createGain();
    const compressor = this.ctx.createDynamicsCompressor();
    compressor.threshold.setValueAtTime(-20, now);
    compressor.knee.setValueAtTime(18, now);
    compressor.ratio.setValueAtTime(4, now);
    compressor.attack.setValueAtTime(0.006, now);
    compressor.release.setValueAtTime(0.32, now);
    master.gain.setValueAtTime(0.001, now);
    master.gain.exponentialRampToValueAtTime(0.76, now + 0.025);
    master.gain.exponentialRampToValueAtTime(0.001, now + 1.65);
    master.connect(compressor);
    compressor.connect(this.ctx.destination);
    [
      {frequency:392,offset:0,duration:.62,type:'sine' as OscillatorType,gain:.12},
      {frequency:659.25,offset:0,duration:.78,type:'sine' as OscillatorType,gain:.27},
      {frequency:880,offset:.12,duration:.86,type:'triangle' as OscillatorType,gain:.17},
      {frequency:1174.66,offset:.27,duration:.92,type:'sine' as OscillatorType,gain:.16},
      {frequency:1567.98,offset:.48,duration:.88,type:'sine' as OscillatorType,gain:.1},
    ].forEach(tone=>{
      const osc=this.ctx!.createOscillator(),gain=this.ctx!.createGain(),start=now+tone.offset;
      osc.type=tone.type;osc.frequency.setValueAtTime(tone.frequency,start);
      gain.gain.setValueAtTime(.001,start);gain.gain.exponentialRampToValueAtTime(tone.gain,start+.035);gain.gain.exponentialRampToValueAtTime(.001,start+tone.duration);
      osc.connect(gain);gain.connect(master);osc.start(start);osc.stop(start+tone.duration);
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

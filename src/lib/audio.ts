// Web Audio API Sound Synthesizer for Royal Dispatch

class SoundManager {
  private ctx: AudioContext | null = null;
  private muted: boolean = false;

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
    return this.muted;
  }

  public isMuted(): boolean {
    return this.muted;
  }

  // Firma sonora breve: campana de tres tonos, clara aun con ruido de cabina.
  public playDispatchChime() {
    if (this.muted) return;
    this.initCtx();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const master = this.ctx.createGain();
    master.gain.setValueAtTime(0.72, now);
    master.gain.exponentialRampToValueAtTime(0.001, now + 1.15);
    master.connect(this.ctx.destination);
    [
      {frequency:659.25,offset:0,duration:.42,type:'sine' as OscillatorType,gain:.34},
      {frequency:987.77,offset:.13,duration:.56,type:'triangle' as OscillatorType,gain:.22},
      {frequency:1318.51,offset:.31,duration:.72,type:'sine' as OscillatorType,gain:.18},
    ].forEach(tone=>{
      const osc=this.ctx!.createOscillator(),gain=this.ctx!.createGain(),start=now+tone.offset;
      osc.type=tone.type;osc.frequency.setValueAtTime(tone.frequency,start);
      gain.gain.setValueAtTime(.001,start);gain.gain.exponentialRampToValueAtTime(tone.gain,start+.025);gain.gain.exponentialRampToValueAtTime(.001,start+tone.duration);
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

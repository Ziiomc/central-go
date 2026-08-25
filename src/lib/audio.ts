// Web Audio API Sound Synthesizer for Central GO
const readMutedPreference=()=>{if(typeof window==='undefined')return false;try{return window.localStorage.getItem('centralgo:sound-muted')==='1';}catch{return false;}};
class SoundManager{
 private ctx:AudioContext|null=null;private muted=readMutedPreference();
 private initCtx(){if(!this.ctx&&typeof window!=='undefined'){const AudioCtx=window.AudioContext||(window as unknown as{webkitAudioContext:typeof AudioContext}).webkitAudioContext;if(AudioCtx)this.ctx=new AudioCtx();}if(this.ctx&&this.ctx.state==='suspended')void this.ctx.resume();}
 public toggleMute(){this.muted=!this.muted;try{window.localStorage.setItem('centralgo:sound-muted',this.muted?'1':'0');}catch{}return this.muted;}
 public isMuted(){return this.muted;}
 public async prime(){this.initCtx();if(!this.ctx)return false;try{if(this.ctx.state==='suspended')await this.ctx.resume();const o=this.ctx.createOscillator(),g=this.ctx.createGain();g.gain.value=0;o.connect(g);g.connect(this.ctx.destination);o.start();o.stop(this.ctx.currentTime+.01);return this.ctx.state==='running';}catch{return false;}}
 private simpleSequence(notes:Array<[number,number,number,number]>,wave:OscillatorType='sine',masterPeak=.7){if(this.muted)return;this.initCtx();if(!this.ctx)return;const c=this.ctx,n=c.currentTime,m=c.createGain(),comp=c.createDynamicsCompressor();m.gain.setValueAtTime(masterPeak,n);comp.threshold.setValueAtTime(-18,n);comp.ratio.setValueAtTime(3,n);m.connect(comp);comp.connect(c.destination);notes.forEach(([f,o,d,p])=>{const osc=c.createOscillator(),g=c.createGain(),s=n+o;osc.type=wave;osc.frequency.setValueAtTime(f,s);g.gain.setValueAtTime(.0001,s);g.gain.exponentialRampToValueAtTime(p,s+.012);g.gain.exponentialRampToValueAtTime(.0001,s+d);osc.connect(g);g.connect(m);osc.start(s);osc.stop(s+d+.02);});}
 public playDispatchChime(){this.simpleSequence([[392,0,.42,.1],[784,.02,.58,.24],[988,.16,.52,.16],[1175,.29,.44,.11]],'sine',.75);}
 /** Reserva: alarma deliberadamente más presente que el aviso normal, audible en parlantes de oficina. */
 public playReservationAlarm(){this.simpleSequence([[880,0,.28,.34],[1175,.20,.30,.38],[880,.48,.28,.34],[1397,.68,.42,.42]],'square',.95);}
 public playTripStartConfirmation(){this.simpleSequence([[523,0,.32,.17],[659,.09,.36,.19],[784,.19,.44,.21]],'sine',.72);}
 public playArrivalDing(){this.simpleSequence([[523,0,.28,.3],[659,.12,.3,.3],[784,.24,.36,.3]],'triangle',.7);}
 public playSOSAlarm(){this.simpleSequence([[960,0,.38,.4],[700,.4,.38,.4],[960,.8,.38,.4]],'sawtooth',.95);}
 public playRadioRogerBeep(){this.simpleSequence([[2475,0,.18,.2]],'sine',.7);}
}
export const soundManager=new SoundManager();

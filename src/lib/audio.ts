// Web Audio API Sound Synthesizer for Central GO
const readMutedPreference=()=>{if(typeof window==='undefined')return false;try{return window.localStorage.getItem('centralgo:sound-muted')==='1';}catch{return false;}};
class SoundManager{
 private ctx:AudioContext|null=null;private muted=readMutedPreference();
 private initCtx(){if(!this.ctx&&typeof window!=='undefined'){const AudioCtx=window.AudioContext||(window as unknown as{webkitAudioContext:typeof AudioContext}).webkitAudioContext;if(AudioCtx)this.ctx=new AudioCtx();}if(this.ctx&&this.ctx.state==='suspended')void this.ctx.resume();}
 public toggleMute(){this.muted=!this.muted;try{window.localStorage.setItem('centralgo:sound-muted',this.muted?'1':'0');}catch{}return this.muted;}
 public isMuted(){return this.muted;}
 public async prime(){this.initCtx();if(!this.ctx)return false;try{if(this.ctx.state==='suspended')await this.ctx.resume();const o=this.ctx.createOscillator(),g=this.ctx.createGain();g.gain.value=0;o.connect(g);g.connect(this.ctx.destination);o.start();o.stop(this.ctx.currentTime+.01);return this.ctx.state==='running';}catch{return false;}}
 private simpleSequence(notes:Array<[number,number,number,number]>,wave:OscillatorType='sine',masterPeak=.7){if(this.muted)return;this.initCtx();if(!this.ctx)return;const c=this.ctx,n=c.currentTime,m=c.createGain(),comp=c.createDynamicsCompressor();m.gain.setValueAtTime(masterPeak,n);comp.threshold.setValueAtTime(-22,n);comp.knee.setValueAtTime(12,n);comp.ratio.setValueAtTime(4,n);m.connect(comp);comp.connect(c.destination);notes.forEach(([f,o,d,p])=>{const osc=c.createOscillator(),g=c.createGain(),s=n+o;osc.type=wave;osc.frequency.setValueAtTime(f,s);g.gain.setValueAtTime(.0001,s);g.gain.exponentialRampToValueAtTime(p,s+.018);g.gain.setValueAtTime(p,s+Math.max(.03,d*.38));g.gain.exponentialRampToValueAtTime(.0001,s+d);osc.connect(g);g.connect(m);osc.start(s);osc.stop(s+d+.03);});}
 /** Aviso de nueva carrera: tres notas suaves, limpio y corto para turnos largos. */
 public playDispatchChime(){
  this.simpleSequence([[659.25,0,.46,.13],[783.99,.13,.52,.115],[1046.5,.29,.66,.095]],'sine',.52);
 }
 /** Alarma de reserva claramente distinta: doble ráfaga larga y potente. */
 public playReservationAlarm(){
  this.simpleSequence([[880,0,.46,.55],[1175,.18,.5,.58],[880,.72,.46,.55],[1319,.9,.58,.6],[880,1.58,.46,.55],[1175,1.76,.5,.58],[1480,2.32,.7,.62]],'square',1);
  if(typeof navigator!=='undefined'&&'vibrate'in navigator)navigator.vibrate([300,120,300,180,500]);
 }
 public playReservationAlarmOnce(key:string){
  if(this.muted)return false;
  const storageKey=`centralgo:reservation-alarm:v2:${key}`;
  try{const previous=Number(window.localStorage.getItem(storageKey)||0);if(previous&&Date.now()-previous<24*60*60*1000)return false;window.localStorage.setItem(storageKey,String(Date.now()));}catch{}
  this.playReservationAlarm();
  return true;
 }
 public playTripStartConfirmation(){this.simpleSequence([[523,0,.32,.17],[659,.09,.36,.19],[784,.19,.44,.21]],'sine',.72);}
 public playArrivalDing(){this.simpleSequence([[523,0,.28,.3],[659,.12,.3,.3],[784,.24,.36,.3]],'triangle',.7);}
 public playSOSAlarm(){this.simpleSequence([[960,0,.38,.4],[700,.4,.38,.4],[960,.8,.38,.4]],'sawtooth',.95);}
 public playRadioRogerBeep(){this.simpleSequence([[2475,0,.18,.2]],'sine',.7);}
}
export const soundManager=new SoundManager();

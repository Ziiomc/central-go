const COVER_KEY='centralgo:driver-cover-zone';
const GPS_KEY='centralgo-driver-gps-wanted';

const text=(node:Element|null)=>(node?.textContent||'').trim().toLowerCase();

/**
 * Agrega un control simple para el conductor que queda cubriendo una zona.
 * No altera carreras activas: sólo reutiliza el flujo oficial de DISPONIBLE y
 * mantiene GPS solicitado para que la central conserve el punto en el mapa.
 */
export function registerDriverCoverageMode(){
 if(typeof window==='undefined'||typeof document==='undefined')return;
 let observer:MutationObserver|null=null;
 let timer:number|null=null;

 const install=()=>{
  const app=document.querySelector<HTMLElement>('.cg-driver-app');
  if(!app)return;
  if(app.querySelector('[data-centralgo-cover-zone]'))return;

  const buttons=Array.from(app.querySelectorAll<HTMLButtonElement>('button'));
  const availableButton=buttons.find(button=>text(button).includes('disponible'));
  if(!availableButton)return;
  const host=availableButton.parentElement;
  if(!(host instanceof HTMLElement))return;

  const button=document.createElement('button');
  button.type='button';
  button.setAttribute('data-centralgo-cover-zone','true');
  button.className='col-span-full mt-1 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-cyan-400/30 bg-cyan-400/10 px-3 py-2 text-[10px] font-black text-cyan-200 shadow-sm transition active:scale-[.99]';
  const refreshLabel=()=>{
   const active=window.localStorage.getItem(COVER_KEY)==='1';
   button.innerHTML=active?'📍 CUBRIENDO ESTA ZONA · DISPONIBLE':'📍 CUBRIR ESTA ZONA';
   button.setAttribute('aria-pressed',active?'true':'false');
  };
  refreshLabel();

  button.addEventListener('click',()=>{
   const active=window.localStorage.getItem(COVER_KEY)==='1';
   if(active){
    window.localStorage.setItem(COVER_KEY,'0');
    refreshLabel();
    return;
   }
   window.localStorage.setItem(COVER_KEY,'1');
   window.localStorage.setItem(GPS_KEY,'1');
   // Usa el botón oficial para que se respeten permisos, backend y reglas de fila.
   const currentAvailable=Array.from(app.querySelectorAll<HTMLButtonElement>('button')).find(candidate=>text(candidate).includes('disponible'));
   currentAvailable?.click();
   window.dispatchEvent(new Event('focus'));
   window.dispatchEvent(new CustomEvent('centralgo:driver-resync',{detail:{reason:'driver-cover-zone'}}));
   refreshLabel();
  });

  host.appendChild(button);
 };

 const reconcile=()=>{
  install();
  const app=document.querySelector<HTMLElement>('.cg-driver-app');
  if(!app)return;
  const active=window.localStorage.getItem(COVER_KEY)==='1';
  if(!active)return;
  // Si existe una carrera activa no fuerza ningún cambio de estado.
  const hasActiveTrip=Array.from(app.querySelectorAll('p')).some(node=>text(node).startsWith('carrera cg-'));
  if(hasActiveTrip)return;
  const statusText=text(app.querySelector('header'));
  if(statusText.includes('pausa')||statusText.includes('offline')||statusText.includes('fuera')){
   const availableButton=Array.from(app.querySelectorAll<HTMLButtonElement>('button')).find(button=>text(button).includes('disponible'));
   availableButton?.click();
  }
 };

 observer=new MutationObserver(()=>install());
 observer.observe(document.body,{childList:true,subtree:true});
 install();
 timer=window.setInterval(reconcile,30000);

 window.addEventListener('beforeunload',()=>{
  observer?.disconnect();
  if(timer!==null)window.clearInterval(timer);
 },{once:true});
}

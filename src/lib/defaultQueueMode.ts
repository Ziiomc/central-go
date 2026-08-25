let installed=false;

/**
 * Operational safeguard: every time the New Trip modal opens, queue mode starts
 * active. The operator can still explicitly choose automatic dispatch or a
 * specific mobile during that call; the next new trip returns to queue mode.
 */
export function registerDefaultQueueMode(){
 if(installed||typeof window==='undefined'||typeof document==='undefined')return;
 installed=true;
 let currentModal:Element|null=null;
 const ensureDefault=()=>{
  const modal=document.querySelector('.cg-dispatch-modal-backdrop');
  if(!modal){currentModal=null;return;}
  if(modal===currentModal)return;
  currentModal=modal;
  window.setTimeout(()=>{
   const buttons=Array.from(modal.querySelectorAll('button'));
   const queueButton=buttons.find(button=>(button.textContent||'').trim().startsWith('Modo cola')) as HTMLButtonElement|undefined;
   if(queueButton&&(queueButton.textContent||'').includes('INACTIVO'))queueButton.click();
  },0);
 };
 const observer=new MutationObserver(ensureDefault);
 observer.observe(document.documentElement,{childList:true,subtree:true});
 window.addEventListener('pageshow',ensureDefault);
 ensureDefault();
}

const GPS_WANTED_KEY='centralgo-driver-gps-wanted';
const GPS_AUTO_ATTR='data-centralgo-gps-auto';

const isDriverRoute=()=>window.location.pathname.startsWith('/driver');

const forceGpsWanted=()=>{
  if(!isDriverRoute())return;
  try{window.localStorage.setItem(GPS_WANTED_KEY,'1');}catch{/* Storage can be restricted; geolocation still runs normally. */}
};

const hideGpsControl=()=>{
  if(!isDriverRoute())return;
  const buttons=Array.from(document.querySelectorAll<HTMLButtonElement>('.cg-driver-app button'));
  const gpsButton=buttons.find((button)=>{
    const text=(button.textContent||'').trim().toUpperCase();
    return text==='GPS ON'||text==='ACTIVAR GPS';
  });
  if(!gpsButton)return;
  gpsButton.setAttribute(GPS_AUTO_ATTR,'1');
  gpsButton.setAttribute('aria-hidden','true');
  gpsButton.tabIndex=-1;
  gpsButton.hidden=true;
  // The legacy vivid-controls stylesheet used !important to force this button
  // visible as a spinning sync indicator. Inline !important wins over it.
  gpsButton.style.setProperty('display','none','important');

  // Restore the GPS information card to its normal full-width layout. The old
  // spinner stylesheet also collapsed this section to a 38 px floating circle.
  const gpsSection=gpsButton.closest<HTMLElement>('section');
  if(gpsSection){
    gpsSection.style.setProperty('width','auto','important');
    gpsSection.style.setProperty('min-width','0','important');
    gpsSection.style.setProperty('right','auto','important');
  }
};

/**
 * Driver safety policy: while the driver app is open, geolocation is not a
 * driver-selectable work status. React still owns the GPS watcher and the OS
 * owns location permission; this bootstrap keeps GPS requested automatically
 * while removing the obsolete GPS control from the driver interface.
 */
export const registerDriverGpsAlwaysOnPolicy=()=>{
  if(!isDriverRoute())return;

  forceGpsWanted();

  const resume=()=>{
    if(document.visibilityState==='visible')forceGpsWanted();
    window.requestAnimationFrame(hideGpsControl);
  };
  const storage=(event:StorageEvent)=>{
    if(event.key===GPS_WANTED_KEY&&event.newValue!=='1')forceGpsWanted();
  };

  window.addEventListener('focus',resume);
  window.addEventListener('pageshow',resume);
  window.addEventListener('storage',storage);
  document.addEventListener('visibilitychange',resume);

  const observer=new MutationObserver(()=>hideGpsControl());
  observer.observe(document.documentElement,{childList:true,subtree:true});
  window.requestAnimationFrame(hideGpsControl);
};

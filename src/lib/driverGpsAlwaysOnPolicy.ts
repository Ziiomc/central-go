const GPS_WANTED_KEY='centralgo-driver-gps-wanted';
const GPS_AUTO_ATTR='data-centralgo-gps-auto';

const isDriverRoute=()=>window.location.pathname.startsWith('/driver');

const forceGpsWanted=()=>{
  if(!isDriverRoute())return;
  try{window.localStorage.setItem(GPS_WANTED_KEY,'1');}catch{/* Storage can be restricted; geolocation still runs normally. */}
};

const lockGpsControl=()=>{
  if(!isDriverRoute())return;
  const buttons=Array.from(document.querySelectorAll<HTMLButtonElement>('.cg-driver-app button'));
  const gpsButton=buttons.find((button)=>{
    const text=(button.textContent||'').trim().toUpperCase();
    return text==='GPS ON'||text==='ACTIVAR GPS';
  });
  if(!gpsButton)return;
  gpsButton.setAttribute(GPS_AUTO_ATTR,'1');
  gpsButton.setAttribute('aria-label','Ubicación automática sincronizada');
  gpsButton.setAttribute('role','status');
  gpsButton.tabIndex=-1;
  gpsButton.disabled=true;
};

/**
 * Driver safety policy: while the driver app is open, geolocation is not a
 * driver-selectable work status. React still owns the GPS watcher and the OS
 * owns location permission; this bootstrap only makes the app always request
 * GPS and removes the manual on/off affordance from the operational UI.
 */
export const registerDriverGpsAlwaysOnPolicy=()=>{
  if(!isDriverRoute())return;

  forceGpsWanted();

  const resume=()=>{
    if(document.visibilityState==='visible')forceGpsWanted();
    window.requestAnimationFrame(lockGpsControl);
  };
  const storage=(event:StorageEvent)=>{
    if(event.key===GPS_WANTED_KEY&&event.newValue!=='1')forceGpsWanted();
  };

  window.addEventListener('focus',resume);
  window.addEventListener('pageshow',resume);
  window.addEventListener('storage',storage);
  document.addEventListener('visibilitychange',resume);

  const observer=new MutationObserver(()=>lockGpsControl());
  observer.observe(document.documentElement,{childList:true,subtree:true});
  window.requestAnimationFrame(lockGpsControl);
};

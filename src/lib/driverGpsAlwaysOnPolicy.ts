const isDriverRoute=()=>window.location.pathname.startsWith('/driver');

/**
 * Driver GPS is controlled by DriverMobileView and by the browser's real
 * geolocation permission/signal. This bootstrap intentionally does not force
 * localStorage back to "on" and does not mutate or hide React controls.
 *
 * The previous always-on policy could immediately overwrite a permission
 * failure/off state and continuously scan the DOM with a MutationObserver.
 * Keeping this hook lightweight prevents permission loops and lets the header
 * GPS indicator reflect the real signal: blue when active, grey when inactive.
 */
export const registerDriverGpsAlwaysOnPolicy=()=>{
  if(typeof window==='undefined'||typeof document==='undefined'||!isDriverRoute())return;
  document.documentElement.dataset.centralgoGpsPolicy='driver-controlled';
};

import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import 'leaflet/dist/leaflet.css';
import './index.css';
import './driverReadability.css';
import './fontSize.css';
import {registerServiceWorker} from './lib/pwa';
import {registerRegionalPartnerReferralBootstrap} from './lib/regionalPartnerReferralBootstrap';
import {registerGoogleOnboardingRoleBootstrap} from './lib/googleOnboardingRoleBootstrap';
import {registerDriverWakeLock} from './lib/driverWakeLock';

// Registrar PWA, atribuciones y protección de pantalla antes de montar React.
registerServiceWorker();
registerRegionalPartnerReferralBootstrap();
registerGoogleOnboardingRoleBootstrap();
registerDriverWakeLock();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

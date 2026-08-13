import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import 'leaflet/dist/leaflet.css';
import './index.css';
import './driverReadability.css';
import './fontSize.css';
import {registerServiceWorker} from './lib/pwa';
import {registerRegionalPartnerReferralBootstrap} from './lib/regionalPartnerReferralBootstrap';

// Registrar PWA antes de montar React para no perder beforeinstallprompt ni el
// evento load en navegadores móviles rápidos.
registerServiceWorker();
registerRegionalPartnerReferralBootstrap();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
